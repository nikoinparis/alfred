import { z } from "zod";

/** Shape returned by /api/vision. Shared by the server route, the client draft and the demo sample. */
export const MealEstimateSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe("Food item, specific (e.g. 'white rice', 'ayam bakar thigh')"),
      portion: z.string().describe("Human portion guess, e.g. '1 cup (~160 g)'"),
      grams: z.number().describe("Estimated grams on the plate"),
      kcal: z.number(),
      protein: z.number().describe("grams"),
      carbs: z.number().describe("grams"),
      fat: z.number().describe("grams"),
      confidence: z.number().describe("0-1 confidence in this item's identity and portion"),
    }),
  ),
  kcalLow: z.number().describe("Plausible low end for the whole meal"),
  kcalHigh: z.number().describe("Plausible high end for the whole meal"),
  confidence: z.number().describe("0-1 overall confidence"),
  notes: z.string().describe("Key assumptions, e.g. cooking oil, hidden sauces, what to check"),
});

export type MealEstimate = z.infer<typeof MealEstimateSchema>;

export const VISION_PROMPT = `You estimate nutrition for a lifter tracking macros, from a meal photo, a short description, or both.

Treat the person's description as authoritative: if they name a brand or product (e.g. "Kellogg's Corn Flakes", "Indomie goreng", "Optimum Nutrition whey"), use that product's published nutrition label per serving and scale it to the amount shown or stated. If they state an amount (grams, cups, pieces, ml of milk), use it instead of guessing.
Otherwise identify each distinct food item and estimate the portion in grams from visual cues (plate ~26 cm, bowl, spoon, hand, packaging).
Be realistic about hidden calories: cooking oil, coconut milk, sambal, peanut sauce, butter, sugar in drinks, milk added to cereal. Indonesian dishes are common (nasi, ayam goreng/bakar, tempe, tahu, rendang, sate, gado-gado, mie): use typical warung preparations.
Give each item a 0-1 confidence and the whole meal a calorie range (kcalLow-kcalHigh) that would contain the true value ~80% of the time. Narrow the range when a brand and amount are given; widen it when portions are hidden or the photo is unclear.
If there is no food, return an empty items list, confidence 0, and say so in notes.
Keep notes to one or two short sentences, and mention the one detail that would most improve the estimate if it's missing.`;

/** Example used in demo mode so the flow can be tried without spending API credits. */
export const DEMO_ESTIMATE: MealEstimate = {
  items: [
    { name: "White rice", portion: "1 cup (~170 g)", grams: 170, kcal: 220, protein: 4.5, carbs: 48, fat: 0.5, confidence: 0.85 },
    { name: "Ayam bakar (thigh)", portion: "1 piece (~140 g)", grams: 140, kcal: 290, protein: 28, carbs: 6, fat: 17, confidence: 0.75 },
    { name: "Tempe goreng", portion: "2 slices (~80 g)", grams: 80, kcal: 225, protein: 14, carbs: 8, fat: 15, confidence: 0.7 },
    { name: "Sambal + lalapan", portion: "small side", grams: 40, kcal: 45, protein: 1, carbs: 5, fat: 2.5, confidence: 0.5 },
  ],
  kcalLow: 680,
  kcalHigh: 880,
  confidence: 0.72,
  notes: "Demo estimate. Frying oil on the tempe and the glaze on the chicken are the biggest unknowns.",
};

/** Clamp model output into sane ranges so a bad estimate can't poison the log. */
export function sanitize(e: MealEstimate): MealEstimate {
  const n = (v: number, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0);
  const items = e.items.slice(0, 15).map((i) => ({
    ...i,
    name: i.name.slice(0, 80),
    portion: i.portion.slice(0, 80),
    grams: n(i.grams, 3000),
    kcal: n(i.kcal, 5000),
    protein: n(i.protein, 400),
    carbs: n(i.carbs, 800),
    fat: n(i.fat, 400),
    confidence: n(i.confidence, 1),
  }));
  const total = items.reduce((a, i) => a + i.kcal, 0);
  const low = n(Math.min(e.kcalLow, total), 10000);
  const high = n(Math.max(e.kcalHigh, total), 10000);
  return { items, kcalLow: Math.round(low), kcalHigh: Math.round(high), confidence: n(e.confidence, 1), notes: e.notes.slice(0, 400) };
}
