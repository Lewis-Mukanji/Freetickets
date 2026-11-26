import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatTicket } from "@/lib/config";
import { requireAdmin } from "../_guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const ticket = body?.ticket;
  const text = typeof ticket === "string" ? ticket.trim() : "";
  const n = typeof ticket === "number" ? ticket : /^#?[0-9]+$/.test(text) ? Number(text.replace(/^#/, "")) : NaN;
  if (!Number.isSafeInteger(n) || n <= 0) {
    return NextResponse.json({ error: "Enter a ticket number, such as 7, 007 or #007." }, { status: 400 });
  }

  const c = await db();
  const now = new Date().toISOString();
  // Only succeeds if the ticket has NOT been checked in yet (safe even with two doors at once).
  const upd = await c.execute({
    sql: "UPDATE tickets SET checked_in_at = ? WHERE ticket_number = ? AND checked_in_at IS NULL",
    args: [now, n],
  });
  const r = await c.execute({
    sql: `SELECT t.ticket_number, t.name, t.section, t.checked_in_at, g.name AS group_name
          FROM tickets t LEFT JOIN groups g ON g.id = t.group_id WHERE t.ticket_number = ?`,
    args: [n],
  });
  if (!r.rows.length)
    return NextResponse.json({ status: "not_found", message: `Ticket ${formatTicket(n)} does not exist.` });
  const t = { ...r.rows[0] };
  if (upd.rowsAffected === 1) return NextResponse.json({ status: "checked_in", ticket: t });
  return NextResponse.json({ status: "already", ticket: t });
}
