import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const OWNER_COOKIE = "alfred_owner";
const MAX_AGE_S = 60 * 60 * 24 * 180;

function secret(): string | null {
  return process.env.OWNER_PASSPHRASE || null;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function ownerConfigured(): boolean {
  return secret() !== null;
}

export function checkPassphrase(input: string): boolean {
  const key = secret();
  if (!key) return false;
  // Compare HMACs so length differences don't leak through timing.
  return safeEqual(sign(input, "cmp"), sign(key, "cmp"));
}

export function mintToken(): string {
  const key = secret()!;
  const exp = String(Date.now() + MAX_AGE_S * 1000);
  return `${exp}.${sign(exp, key)}`;
}

export function verifyToken(token: string | undefined): boolean {
  const key = secret();
  if (!key || !token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp, key));
}

export async function isOwnerRequest(): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(OWNER_COOKIE)?.value);
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: MAX_AGE_S,
};
