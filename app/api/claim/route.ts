import { NextResponse } from "next/server";
import { claimTickets, ClaimError } from "@/lib/tickets";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { code?: unknown; attendees?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const code = typeof body.code === "string" && body.code ? body.code : undefined;
  const attendees = Array.isArray(body.attendees) ? body.attendees.slice(0, 25) : [];
  try {
    const tickets = await claimTickets({ code, attendees });
    return NextResponse.json({ tickets });
  } catch (e) {
    if (e instanceof ClaimError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
