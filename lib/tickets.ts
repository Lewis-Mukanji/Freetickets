import { db } from "./db";
import { maxTickets, SECTIONS, type Section } from "./config";
import { sendTicketEmail } from "./email";

export type AttendeeInput = { name: string; email: string; phone: string };

export class ClaimError extends Error {}

export function cleanAttendee(a: Partial<AttendeeInput>): AttendeeInput {
  const name = String(a.name ?? "").trim().replace(/\s+/g, " ");
  const email = String(a.email ?? "").trim().toLowerCase();
  const phone = String(a.phone ?? "").trim();
  if (name.length < 2) throw new ClaimError("Please enter a full name for every ticket.");
  if (name.length > 100) throw new ClaimError("Name is too long.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200)
    throw new ClaimError(`"${a.email ?? ""}" is not a valid email address.`);
  const digits = phone.replace(/\D/g, "");
  if (!/^\+?[\d\s()-]+$/.test(phone) || digits.length < 9 || digits.length > 15)
    throw new ClaimError(`"${phone}" is not a valid phone number.`);
  return { name, email, phone };
}

export async function getGroupByCode(code: string) {
  const c = await db();
  const r = await c.execute({
    sql: `SELECT g.*, (SELECT COUNT(*) FROM tickets t WHERE t.group_id = g.id) AS used
          FROM groups g WHERE g.code = ?`,
    args: [code],
  });
  if (!r.rows.length) return null;
  const g = r.rows[0];
  const names = await c.execute({
    sql: "SELECT name FROM tickets WHERE group_id = ? ORDER BY ticket_number",
    args: [g.id as number],
  });
  return {
    id: Number(g.id),
    code: String(g.code),
    name: String(g.name),
    section: String(g.section) as Section,
    max_tickets: Number(g.max_tickets),
    used: Number(g.used),
    guests: names.rows.map((x) => String(x.name)),
  };
}

export async function totalIssued(): Promise<number> {
  const c = await db();
  const r = await c.execute("SELECT COUNT(*) AS n FROM tickets");
  return Number(r.rows[0].n);
}

/**
 * Claim tickets. All checks + inserts run in one write transaction so limits
 * and ticket numbers stay correct even if many people submit at once.
 */
export async function claimTickets(opts: { code?: string; attendees: Partial<AttendeeInput>[] }) {
  const list = (opts.attendees ?? []).map(cleanAttendee);
  if (!list.length) throw new ClaimError("Add at least one person.");

  const emails = list.map((a) => a.email);
  const dup = emails.find((e, i) => emails.indexOf(e) !== i);
  if (dup) throw new ClaimError(`${dup} is entered more than once. Each person needs their own email.`);

  // If several people submit at the same moment, wait our turn and retry.
  let created: Created[] = [];
  for (let attempt = 0; ; attempt++) {
    try {
      created = await saveClaim(opts.code, list, emails);
      break;
    } catch (e) {
      const busy = e instanceof Error && /SQLITE_BUSY|database is locked/i.test(e.message);
      if (!busy || attempt >= 15) throw e;
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 150 * (attempt + 1)));
    }
  }

  // Tickets are already committed, so delivery errors must preserve the claim confirmation.
  return Promise.all(created.map(async ({ ticket_number, name, email }) => {
    const email_status = await deliver(ticket_number).catch((error) => {
      console.error("Could not complete delivery for ticket", ticket_number, error);
      return "failed" as const;
    });
    return { ticket_number, name, email, email_status };
  }));
}

type Created = { ticket_number: number; name: string; email: string; section: Section; group_name: string | null };

async function saveClaim(code: string | undefined, list: AttendeeInput[], emails: string[]): Promise<Created[]> {
  const opts = { code };
  const c = await db();
  const tx = await c.transaction("write");
  const created: { ticket_number: number; name: string; email: string; section: Section; group_name: string | null }[] = [];
  try {
    let section: Section = "solo";
    let groupId: number | null = null;
    let groupName: string | null = null;

    if (opts.code) {
      const g = await tx.execute({
        sql: `SELECT g.id, g.name, g.section, g.max_tickets,
                (SELECT COUNT(*) FROM tickets t WHERE t.group_id = g.id) AS used
              FROM groups g WHERE g.code = ?`,
        args: [opts.code],
      });
      if (!g.rows.length) throw new ClaimError("This ticket link is not valid.");
      const row = g.rows[0];
      section = String(row.section) as Section;
      groupId = Number(row.id);
      groupName = String(row.name);
      const left = Number(row.max_tickets) - Number(row.used);
      if (left <= 0) throw new ClaimError("All tickets for this link have already been claimed.");
      if (list.length > left)
        throw new ClaimError(`Only ${left} ticket${left === 1 ? "" : "s"} left on this link.`);
    } else if (list.length > SECTIONS.solo.max) {
      throw new ClaimError("Solo free tickets are limited to 1 per person.");
    }

    const existing = await tx.execute({
      sql: `SELECT email FROM tickets WHERE email IN (${emails.map(() => "?").join(",")})`,
      args: emails,
    });
    if (existing.rows.length) {
      const used = existing.rows.map((r) => String(r.email)).join(", ");
      throw new ClaimError(`Already used for a free ticket: ${used}. Each email can only get one ticket.`);
    }

    const stats = await tx.execute("SELECT COUNT(*) AS n, COALESCE(MAX(ticket_number), 0) AS top FROM tickets");
    const issued = Number(stats.rows[0].n);
    let next = Number(stats.rows[0].top) + 1;
    const cap = maxTickets();
    if (issued >= cap) throw new ClaimError("Sorry, all free tickets have been given out.");
    if (issued + list.length > cap)
      throw new ClaimError(`Only ${cap - issued} free ticket${cap - issued === 1 ? "" : "s"} left in total.`);

    for (const a of list) {
      await tx.execute({
        sql: `INSERT INTO tickets (ticket_number, name, email, phone, section, group_id) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [next, a.name, a.email, a.phone, section, groupId],
      });
      created.push({ ticket_number: next, name: a.name, email: a.email, section, group_name: groupName });
      next++;
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback().catch(() => {});
    if (e instanceof Error && /UNIQUE constraint failed: tickets\.email/i.test(e.message))
      throw new ClaimError("One of these emails has already been used for a free ticket.");
    throw e;
  } finally {
    tx.close();
  }
  return created;
}

type DeliveryStatus = Awaited<ReturnType<typeof sendTicketEmail>> | "failed" | "missing";

/** Send (or re-send) the email for one ticket and record the result. */
export async function deliver(ticketNumber: number): Promise<DeliveryStatus> {
  const c = await db();
  const r = await c.execute({
    sql: `SELECT t.ticket_number, t.name, t.email, t.section, g.name AS group_name
          FROM tickets t LEFT JOIN groups g ON g.id = t.group_id WHERE t.ticket_number = ?`,
    args: [ticketNumber],
  });
  if (!r.rows.length) return "missing";
  const t = r.rows[0];
  let status: DeliveryStatus;
  try {
    status = await sendTicketEmail({
      ticketNumber: Number(t.ticket_number),
      name: String(t.name),
      email: String(t.email),
      section: String(t.section) as Section,
      groupName: t.group_name ? String(t.group_name) : null,
    });
  } catch (e) {
    console.error("Email failed for ticket", ticketNumber, e);
    status = "failed";
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await c.execute({ sql: "UPDATE tickets SET email_status = ? WHERE ticket_number = ?", args: [status, ticketNumber] });
      break;
    } catch (e) {
      if (attempt === 9) console.error("Could not save email status", ticketNumber, e);
      else await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
    }
  }
  return status;
}
