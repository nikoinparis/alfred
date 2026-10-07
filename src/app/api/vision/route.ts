import type { NextRequest } from "next/server";
import { z } from "zod";
import { isOwnerRequest } from "@/lib/server/owner";
import { rateLimit } from "@/lib/server/rate-limit";
import { configuredProvider, estimateMeal, VisionError } from "@/lib/server/vision";

export const maxDuration = 60;

// ~1.5 MB of base64. The client resizes to 1024 px JPEG first, which is ~150–300 KB.
const MAX_BASE64 = 2_000_000;

const Body = z
  .object({
    image: z.string().min(100).max(MAX_BASE64).optional(),
    mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
    note: z.string().max(1500).optional(),
  })
  .refine((b) => (b.image && b.mediaType) || b.note?.trim(), "Send a photo, a description, or both.");

export async function GET() {
  return Response.json({ provider: configuredProvider(), owner: await isOwnerRequest() });
}

export async function POST(request: NextRequest) {
  if (!(await isOwnerRequest())) {
    return Response.json({ error: "Photo logging is owner-only. Unlock this device in Settings → Access." }, { status: 401 });
  }
  if (!rateLimit("vision", 30, 60 * 60_000)) {
    return Response.json({ error: "30 photos an hour is the cap. Try again later." }, { status: 429 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Send a photo (JPEG, PNG or WebP under 1.5 MB), a description, or both." }, { status: 400 });
  const { image, mediaType, note } = parsed.data;
  try {
    const result = await estimateMeal({ image: image && mediaType ? { data: image, mediaType } : undefined, note });
    return Response.json(result);
  } catch (e) {
    if (e instanceof VisionError) return Response.json({ error: e.message }, { status: e.status });
    console.error("vision route failed", e);
    return Response.json({ error: "Something went wrong estimating that photo." }, { status: 500 });
  }
}
