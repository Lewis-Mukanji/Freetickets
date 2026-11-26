import { NextResponse } from "next/server";
import { COOKIE, passwordMatches, sessionValue } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = sessionValue();
  if (!session) {
    return NextResponse.json({ error: "Admin login is unavailable. Check the server configuration." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.password !== "string" || !passwordMatches(body.password)) {
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}
