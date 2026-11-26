import crypto from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE = "hba_admin";

export function sessionValue(): string | null {
  const secret = process.env.SESSION_SECRET;
  const password = process.env.ADMIN_PASSWORD;
  if (!secret?.trim() || !password?.trim()) return null;
  // Changing either setting automatically logs everyone out.
  return crypto.createHmac("sha256", secret).update("admin:" + password).digest("hex");
}

export function passwordMatches(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(pw).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const expected = sessionValue();
  if (!expected) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return false;
  return crypto.timingSafeEqual(Buffer.from(value, "hex"), Buffer.from(expected, "hex"));
}
