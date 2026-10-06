import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { checkPassphrase, cookieOptions, isOwnerRequest, mintToken, OWNER_COOKIE, ownerConfigured } from "@/lib/server/owner";
import { rateLimit } from "@/lib/server/rate-limit";

export async function GET() {
  return Response.json({ owner: await isOwnerRequest(), configured: ownerConfigured() });
}

const Body = z.object({ passphrase: z.string().min(1).max(200) });

export async function POST(request: NextRequest) {
  if (!ownerConfigured()) {
    return Response.json({ error: "OWNER_PASSPHRASE isn't set on the server." }, { status: 503 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`owner:${ip}`, 5, 15 * 60_000)) {
    return Response.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !checkPassphrase(parsed.data.passphrase)) {
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ error: "That passphrase doesn't match." }, { status: 401 });
  }
  const jar = await cookies();
  jar.set(OWNER_COOKIE, mintToken(), cookieOptions);
  return Response.json({ owner: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(OWNER_COOKIE);
  return Response.json({ owner: false });
}
