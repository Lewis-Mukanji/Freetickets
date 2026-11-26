import { NextResponse } from "next/server";
import { deliver } from "@/lib/tickets";
import { requireAdmin } from "../_guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { ticket } = await req.json().catch(() => ({}));
  const status = await deliver(Number(ticket));
  return NextResponse.json({ status });
}
