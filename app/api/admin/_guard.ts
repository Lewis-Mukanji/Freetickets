import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";

export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdmin()) return null;
  return NextResponse.json({ error: "Please log in again." }, { status: 401 });
}
