import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { MealEstimateSchema, sanitize, VISION_PROMPT, type MealEstimate } from "@/lib/vision-schema";

export type VisionProvider = "anthropic" | "gemini";

export interface VisionInput {
  /** Base64 JPEG/PNG/WebP without the data: prefix. Optional: a description alone works too. */
  image?: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };
  note?: string;
}

export class VisionError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export function configuredProvider(): VisionProvider | null {
  const want = (process.env.VISION_PROVIDER ?? "anthropic").toLowerCase() as VisionProvider;
  if (want === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (want === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  // Fall back to whichever key exists.
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

function userText(input: VisionInput) {
  const note = input.note?.trim().slice(0, 1500);
  if (!input.image) return `No photo. Estimate from my description: ${note}`;
  return note ? `Estimate the meal in this photo. What it is, from me: ${note}` : "Estimate the meal in this photo.";
}

/** Models that accept the server-side `fallbacks: "default"` refusal routing. */
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);

async function estimateWithClaude(input: VisionInput): Promise<{ estimate: MealEstimate; model: string }> {
  const model = process.env.ANTHROPIC_VISION_MODEL || "claude-sonnet-5-5";
  const client = new Anthropic({ maxRetries: 1, timeout: 45_000 });
  const isHaiku = model.startsWith("claude-haiku");
  const useFallbacks = FALLBACK_MODELS.has(model);
  try {
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 6000,
      system: VISION_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...(input.image
              ? [{ type: "image" as const, source: { type: "base64" as const, media_type: input.image.mediaType, data: input.image.data } }]
              : []),
            { type: "text" as const, text: userText(input) },
          ],
        },
      ],
      // Low effort keeps per-photo cost down; portion estimation doesn't need long deliberation.
      output_config: { format: betaZodOutputFormat(MealEstimateSchema), ...(isHaiku ? {} : { effort: "low" as const }) },
      ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    if (response.stop_reason === "refusal") throw new VisionError("The model declined to analyse this photo.", 422);
    if (response.stop_reason === "max_tokens") throw new VisionError("The estimate was cut off. Try again.", 502);
    if (!response.parsed_output) throw new VisionError("Couldn't read the model's answer. Try again.", 502);
    return { estimate: response.parsed_output, model: response.model };
  } catch (e) {
    if (e instanceof VisionError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new VisionError("Anthropic rate limit hit. Wait a minute and retry.", 429);
    if (e instanceof Anthropic.AuthenticationError) throw new VisionError("ANTHROPIC_API_KEY is invalid.", 500);
    if (e instanceof Anthropic.BadRequestError) throw new VisionError(`Anthropic rejected the request: ${e.message}`, 400);
    if (e instanceof Anthropic.APIConnectionError) throw new VisionError("Couldn't reach Anthropic. Try again.", 503);
    if (e instanceof Anthropic.APIError) throw new VisionError(`Anthropic error (${e.status}).`, 502);
    throw e;
  }
}

async function estimateWithGemini(input: VisionInput): Promise<{ estimate: MealEstimate; model: string }> {
  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: VISION_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            ...(input.image ? [{ inlineData: { mimeType: input.image.mediaType, data: input.image.data } }] : []),
            {
              text: `${userText(input)}\nReply with JSON only: {"items":[{"name","portion","grams","kcal","protein","carbs","fat","confidence"}],"kcalLow","kcalHigh","confidence","notes"}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (res.status === 429) throw new VisionError("Gemini free-tier limit hit. Wait a minute and retry.", 429);
  if (!res.ok) throw new VisionError(`Gemini error (${res.status}).`, 502);
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new VisionError("Gemini didn't return valid JSON. Try again.", 502);
  }
  const parsed = MealEstimateSchema.safeParse(json);
  if (!parsed.success) throw new VisionError("Gemini's answer didn't match the expected shape. Try again.", 502);
  return { estimate: parsed.data, model };
}

export async function estimateMeal(input: VisionInput): Promise<{ estimate: MealEstimate; provider: VisionProvider; model: string }> {
  const provider = configuredProvider();
  if (!provider) throw new VisionError("No vision API key configured on the server.", 503);
  const out = provider === "anthropic" ? await estimateWithClaude(input) : await estimateWithGemini(input);
  return { ...out, provider, estimate: sanitize(out.estimate) };
}
