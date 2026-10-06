import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./schema";
import { AlfredDB } from "./schema";
import { seedBase } from "./seed";
import { FALLBACK_TARGETS, logFood, logMeal, resolveTargets, sumLogs } from "./nutrition";

describe("resolveTargets", () => {
  it("falls back when no goal is set", () => {
    expect(resolveTargets(DEFAULT_SETTINGS, null)).toEqual({ targets: FALLBACK_TARGETS, source: "fallback" });
  });

  it("prefers a manual override", () => {
    const manual = { kcal: 2000, protein: 160, carbs: 200, fat: 60 };
    expect(resolveTargets({ ...DEFAULT_SETTINGS, macroOverride: manual }, 80).targets).toEqual(manual);
  });

  it("applies check-in adjustments without touching protein", () => {
    const base = {
      ...DEFAULT_SETTINGS,
      profile: { sex: "male" as const, age: 28, heightCm: 180, weightKg: 80, activity: "moderate" as const },
      goal: { preset: "lean" as const, phase: "cut" as const, rateKgPerWeek: 0.5 },
    };
    const a = resolveTargets(base, 80).targets;
    const b = resolveTargets({ ...base, kcalAdjustment: -200 }, 80).targets;
    expect(b.kcal).toBe(a.kcal - 200);
    expect(b.protein).toBe(a.protein);
    expect(b.carbs).toBeLessThan(a.carbs);
  });
});

describe("food logging", () => {
  it("scales servings and logs saved meals item by item", async () => {
    const db = new AlfredDB("nutrition-log");
    await seedBase(db);
    const nasi = (await db.foods.get("nasi-putih"))!;
    await logFood(db, "2026-10-07", nasi, 1.5);
    await logMeal(db, "2026-10-07", {
      id: "m",
      name: "Lunch",
      items: [
        { foodId: "ayam-bakar", servings: 1 },
        { foodId: "tempe-goreng", servings: 1 },
      ],
    });
    const logs = await db.foodLogs.where("date").equals("2026-10-07").toArray();
    expect(logs).toHaveLength(3);
    const t = sumLogs(logs);
    expect(t.kcal).toBe(Math.round(205 * 1.5) + 300 + 280);
    expect((await db.foods.get("nasi-putih"))?.lastUsed).toBeGreaterThan(0);
  });
});
