import { computeTargets, type MacroTargets } from "@/lib/domain/nutrition";
import { uid } from "@/lib/id";
import type { AlfredDB, Food, FoodLog, SavedMeal, Settings } from "./schema";

export const FALLBACK_TARGETS: MacroTargets = { kcal: 2400, protein: 150, carbs: 270, fat: 75 };

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function sumLogs(logs: Pick<FoodLog, "kcal" | "protein" | "carbs" | "fat">[]): Totals {
  return logs.reduce((a, l) => ({ kcal: a.kcal + l.kcal, protein: a.protein + l.protein, carbs: a.carbs + l.carbs, fat: a.fat + l.fat }), {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
}

/** Targets in priority order: manual override → goal engine (+ accepted check-in tweaks) → sensible fallback. */
export function resolveTargets(
  settings: Settings,
  latestWeightKg: number | null,
): { targets: MacroTargets; source: "manual" | "goal" | "fallback" } {
  if (settings.macroOverride) return { targets: settings.macroOverride, source: "manual" };
  if (settings.profile && settings.goal) {
    const profile = { ...settings.profile, weightKg: latestWeightKg ?? settings.profile.weightKg };
    const t = computeTargets(profile, settings.goal).targets;
    if (!settings.kcalAdjustment) return { targets: t, source: "goal" };
    // Check-in adjustments move carbs (and fat a little) and keep protein fixed.
    const kcal = t.kcal + settings.kcalAdjustment;
    const carbs = Math.max(0, Math.round(t.carbs + (settings.kcalAdjustment * 0.75) / 4));
    const fat = Math.max(0, Math.round(t.fat + (settings.kcalAdjustment * 0.25) / 9));
    return { targets: { kcal, protein: t.protein, carbs, fat }, source: "goal" };
  }
  return { targets: FALLBACK_TARGETS, source: "fallback" };
}

export function scaleFood(food: Pick<Food, "kcal" | "protein" | "carbs" | "fat">, servings: number) {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    kcal: Math.round(food.kcal * servings),
    protein: r1(food.protein * servings),
    carbs: r1(food.carbs * servings),
    fat: r1(food.fat * servings),
  };
}

export async function logFood(db: AlfredDB, date: string, food: Food, servings = 1): Promise<FoodLog> {
  const entry: FoodLog = {
    id: uid("fl"),
    date,
    createdAt: Date.now(),
    name: food.name,
    servings,
    ...scaleFood(food, servings),
    source: "food",
    foodId: food.id,
  };
  await db.transaction("rw", [db.foodLogs, db.foods], async () => {
    await db.foodLogs.put(entry);
    await db.foods.update(food.id, { lastUsed: Date.now() });
  });
  return entry;
}

export async function logMeal(db: AlfredDB, date: string, meal: SavedMeal): Promise<FoodLog[]> {
  const foods = await db.foods.bulkGet(meal.items.map((i) => i.foodId));
  const now = Date.now();
  const entries: FoodLog[] = [];
  meal.items.forEach((item, i) => {
    const f = foods[i];
    if (!f) return;
    entries.push({
      id: uid("fl"),
      date,
      createdAt: now + i,
      name: f.name,
      servings: item.servings,
      ...scaleFood(f, item.servings),
      source: "meal",
      foodId: f.id,
      mealId: meal.id,
    });
  });
  await db.transaction("rw", [db.foodLogs, db.meals], async () => {
    await db.foodLogs.bulkPut(entries);
    await db.meals.update(meal.id, { lastUsed: now });
  });
  return entries;
}

export async function logManual(
  db: AlfredDB,
  date: string,
  entry: Omit<FoodLog, "id" | "date" | "createdAt" | "source"> & { source?: FoodLog["source"] },
) {
  const log: FoodLog = { id: uid("fl"), date, createdAt: Date.now(), source: "manual", ...entry };
  await db.foodLogs.put(log);
  return log;
}

export function mealTotals(meal: SavedMeal, foods: Record<string, Food>): Totals {
  return sumLogs(
    meal.items.map((i) => (foods[i.foodId] ? scaleFood(foods[i.foodId], i.servings) : { kcal: 0, protein: 0, carbs: 0, fat: 0 })),
  );
}
