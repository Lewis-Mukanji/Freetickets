import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { maxTickets } from "@/lib/config";
import { requireAdmin } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const c = await db();
  const [tickets, groups] = await Promise.all([
    c.execute(`SELECT t.ticket_number, t.name, t.email, t.phone, t.section, t.group_id, g.name AS group_name,
                      t.checked_in_at, t.email_status, t.created_at
               FROM tickets t LEFT JOIN groups g ON g.id = t.group_id
               ORDER BY t.ticket_number ASC`),
    c.execute(`SELECT g.*, (SELECT COUNT(*) FROM tickets t WHERE t.group_id = g.id) AS used
               FROM groups g ORDER BY g.section, g.name`),
  ]);
  return NextResponse.json({
    max: maxTickets(),
    tickets: tickets.rows.map((r) => ({ ...r })),
    groups: groups.rows.map((r) => ({ ...r })),
  });
}
