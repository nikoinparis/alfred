import { describe, expect, it } from "vitest";
import { DEMO_ESTIMATE, MealEstimateSchema, sanitize } from "./vision-schema";

describe("sanitize", () => {
  it("clamps nonsense values and widens the range to include the item total", () => {
    const out = sanitize({
      items: [{ name: "x", portion: "?", grams: -5, kcal: 900, protein: Number.NaN, carbs: 99999, fat: 10, confidence: 4 }],
      kcalLow: 1000,
      kcalHigh: 500,
      confidence: -1,
      notes: "",
    });
    expect(out.items[0]).toMatchObject({ grams: 0, protein: 0, carbs: 800, confidence: 1 });
    expect(out.kcalLow).toBeLessThanOrEqual(900);
    expect(out.kcalHigh).toBeGreaterThanOrEqual(900);
    expect(out.confidence).toBe(0);
  });

  it("accepts the demo estimate as valid output", () => {
    expect(MealEstimateSchema.safeParse(DEMO_ESTIMATE).success).toBe(true);
    const total = DEMO_ESTIMATE.items.reduce((a, i) => a + i.kcal, 0);
    expect(total).toBeGreaterThanOrEqual(DEMO_ESTIMATE.kcalLow);
    expect(total).toBeLessThanOrEqual(DEMO_ESTIMATE.kcalHigh);
  });
});
