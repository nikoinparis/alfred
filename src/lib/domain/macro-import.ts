import type { MealEstimate } from "@/lib/vision-schema";

/**
 * Import macros worked out elsewhere (e.g. in a Claude chat) without an API call.
 *
 * One food per line, in this shape (case and spacing are forgiving):
 *   Triple meat supreme kebab | 780 kcal | P 42 | C 60 | F 40
 */

export const MACRO_PROMPT = `You're estimating macros for my food log app (Alfred). I live in Indonesia: when a dish has no size, assume a typical Indonesian street-food, warung or mall food-court portion. If I name a brand, use its nutrition label. Count hidden calories (cooking oil, sauces, sugar, milk, alcohol).

Reply with ONLY these lines, one food per line, nothing else:
Name (portion) | 000 kcal | P 00 | C 00 | F 00

Protein, carbs and fat are in grams. Here's what I ate:
`;

const LINE =
  /^\s*(?:[-*•]\s*|\d+[.)]\s*)?(.+?)\s*\|\s*(\d+(?:[.,]\d+)?)\s*(?:kcal|cal|calories)?\s*\|\s*p(?:rotein)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?\s*\|\s*c(?:arbs?)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?\s*\|\s*f(?:at)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*g?\s*\|?\s*$/i;

const num = (s: string) => Number(s.replace(",", "."));

/** Parse a pasted macro list. Returns null when the text isn't one (so it goes to the AI as usual). */
export function parseMacroList(text: string): MealEstimate | null {
  const lines = text
    .replace(/```[a-z]*/gi, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const items: MealEstimate["items"] = [];
  for (const line of lines) {
    const m = LINE.exec(line);
    if (!m) continue;
    const [, name, kcal, p, c, f] = m;
    const portion = /\(([^)]+)\)\s*$/.exec(name)?.[1] ?? "";
    items.push({
      name: name.replace(/\s*\(([^)]+)\)\s*$/, "").slice(0, 80) || "Food",
      portion,
      grams: 0,
      kcal: Math.min(5000, num(kcal)),
      protein: Math.min(500, num(p)),
      carbs: Math.min(1000, num(c)),
      fat: Math.min(500, num(f)),
      confidence: 0.7,
    });
  }
  if (!items.length || items.length > 40) return null;
  const total = items.reduce((a, i) => a + i.kcal, 0);
  return {
    items,
    kcalLow: Math.round(total * 0.85),
    kcalHigh: Math.round(total * 1.15),
    confidence: 0.7,
    notes: "Pasted from your Claude chat. Adjust anything that looks off before saving.",
  };
}
