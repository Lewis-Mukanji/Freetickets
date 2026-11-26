import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { GROUP_SECTIONS, SECTIONS, type Section } from "@/lib/config";
import { requireAdmin } from "../_guard";

export const runtime = "nodejs";

function newCode() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const c = await db();

  if (body.action === "delete") {
    const id = Number(body.id);
    const used = await c.execute({ sql: "SELECT COUNT(*) AS n FROM tickets WHERE group_id = ?", args: [id] });
    if (Number(used.rows[0].n) > 0)
      return NextResponse.json({ error: "This link already has tickets, so it can't be deleted." }, { status: 400 });
    await c.execute({ sql: "DELETE FROM groups WHERE id = ?", args: [id] });
    return NextResponse.json({ ok: true });
  }

  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  const section = String(body.section ?? "") as Section;
  if (name.length < 2) return NextResponse.json({ error: "Enter a name." }, { status: 400 });
  if (!GROUP_SECTIONS.includes(section)) return NextResponse.json({ error: "Choose a section." }, { status: 400 });

  const code = newCode();
  await c.execute({
    sql: "INSERT INTO groups (code, name, section, max_tickets) VALUES (?, ?, ?, ?)",
    args: [code, name, section, SECTIONS[section].max],
  });
  return NextResponse.json({ ok: true, code });
}
