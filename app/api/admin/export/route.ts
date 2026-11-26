import { db } from "@/lib/db";
import { SECTIONS, formatTicket, type Section } from "@/lib/config";
import { requireAdmin } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  // Stop spreadsheet formulas, but keep phone numbers like +254… as they are.
  const safe = /^[=@]/.test(s) || /^[+\-](?![\d\s()]+$)/.test(s) ? "'" + s : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const c = await db();
  const r = await c.execute(`SELECT t.*, g.name AS group_name FROM tickets t
                             LEFT JOIN groups g ON g.id = t.group_id ORDER BY t.ticket_number`);
  const lines = [["Ticket", "Name", "Email", "Phone", "Section", "Link / Group", "Checked in", "Email", "Claimed at"].map(cell).join(",")];
  for (const t of r.rows) {
    lines.push([
      formatTicket(Number(t.ticket_number)), t.name, t.email, t.phone,
      SECTIONS[t.section as Section]?.label ?? t.section, t.group_name ?? "",
      t.checked_in_at ?? "", t.email_status, t.created_at,
    ].map(cell).join(","));
  }
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hba-free-tickets.csv"',
    },
  });
}
