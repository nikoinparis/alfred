import { EXERCISES, EXERCISE_BY_ID } from "@/lib/domain/catalog";
import { addDays, parseISODate } from "@/lib/domain/dates";
import { MUSCLE_META } from "@/lib/domain/muscles";
import { BASE_CYCLE } from "@/lib/domain/planner";
import { seedTemplates } from "@/lib/domain/templates";
import { MUSCLES, type DayLog, type Session, type SetLog } from "@/lib/domain/types";
import { roundTo } from "@/lib/domain/units";
import { mulberry32 } from "@/lib/id";
import { seedFoods } from "./foods-seed";
import { DEFAULT_SETTINGS, type AlfredDB, type Bodyweight, type FoodLog, type Settings } from "./schema";

/** Base data every database starts with: catalog, your split, targets, foods. */
export async function seedBase(db: AlfredDB, settings: Partial<Settings> = {}) {
  await db.transaction("rw", [db.settings, db.exercises, db.templates, db.muscleTargets, db.foods], async () => {
    if (!(await db.settings.get("app"))) await db.settings.put({ ...DEFAULT_SETTINGS, ...settings });
    if ((await db.exercises.count()) === 0) await db.exercises.bulkPut(EXERCISES);
    if ((await db.templates.count()) === 0) await db.templates.bulkPut(seedTemplates());
    if ((await db.muscleTargets.count()) === 0)
      await db.muscleTargets.bulkPut(MUSCLES.map((m) => ({ muscle: m, sets: MUSCLE_META[m].defaultTarget })));
    if ((await db.foods.count()) === 0) await db.foods.bulkPut(seedFoods());
  });
}

/** Starting weights (kg) for slots without a template target, used by the demo athlete. */
const DEMO_DEFAULT_KG: Record<string, number> = {
  "biceps-curl": 24,
  "walking-lunge": 24,
  "seated-leg-curl": 45,
  "hamstring-curl": 40,
  rdl: 60,
  "front-squat": 60,
  "hip-thrust": 80,
  "lying-leg-curl": 35,
  "seated-calf-raise": 40,
  "pallof-press": 15,
};

/**
 * Fictional "demo athlete": ~8 weeks of training on the same split, food logs and weigh-ins.
 * Deterministic so screenshots look the same every visit.
 */
export async function seedDemo(db: AlfredDB, todayISO: string) {
  await seedBase(db, {
    profile: { sex: "male", age: 28, heightCm: 180, weightKg: 79, activity: "moderate" },
    goal: { preset: "lean", phase: "cut", rateKgPerWeek: 0.35 },
  });
  const rand = mulberry32(42);
  const templates = await db.templates.toArray();
  const byType = Object.fromEntries(templates.map((t) => [t.dayType, t]));

  const sessions: Session[] = [];
  const dayLogs: DayLog[] = [];
  const state: Record<string, { kg: number; reps: number }> = {};
  let cursor = 0;
  const start = addDays(todayISO, -56);

  for (let d = start; d < todayISO; d = addDays(d, 1)) {
    const type = BASE_CYCLE[cursor];
    if (type !== "rest" && rand() < 0.07) {
      dayLogs.push({ date: d, dayType: type, status: "skipped" });
      continue;
    }
    cursor = (cursor + 1) % BASE_CYCLE.length;
    dayLogs.push({ date: d, dayType: type, status: "done" });
    const tpl = byType[type];
    if (!tpl || type === "rest") continue;

    const startedAt = parseISODate(d).getTime() + (17 + Math.floor(rand() * 3)) * 3_600_000;
    let clock = startedAt;
    const sessionId = `demo-ses-${d}`;
    const entries = tpl.slots.map((slot, ei) => {
      const ex = EXERCISE_BY_ID[slot.exerciseId];
      const inc = ex.incrementKg || 2.5;
      const st = (state[slot.exerciseId] ??= {
        kg: slot.target ? roundTo(slot.target.value * 0.88, inc) : (DEMO_DEFAULT_KG[slot.exerciseId] ?? 0),
        reps: slot.repMin,
      });
      const sets: SetLog[] = [];
      for (let i = 0; i < slot.sets; i++) {
        const fatigue = i === slot.sets - 1 && rand() < 0.35 ? 1 : 0;
        clock += 150_000 + Math.floor(rand() * 60_000);
        sets.push({
          id: `${sessionId}-${ei}-${i}`,
          kind: "working",
          weight: ex.loadMode === "bodyweight" ? null : st.kg,
          unit: "kg",
          reps: Math.max(1, Math.min(slot.repMax, st.reps) - fatigue),
          rpe: Math.round((7 + rand() * 2.5) * 2) / 2,
          done: true,
          completedAt: clock,
        });
      }
      if (slot.exerciseId === "chest-press" && rand() < 0.5) {
        const parent = sets[sets.length - 1];
        sets.push({
          ...parent,
          id: `${sessionId}-${ei}-drop`,
          kind: "drop",
          weight: roundTo(st.kg * 0.8, inc),
          reps: 8,
          parentId: parent.id,
        });
      }
      const allTop = sets.filter((s) => s.kind === "working").every((s) => (s.reps ?? 0) >= slot.repMax);
      if (allTop && ex.loadMode !== "bodyweight") {
        st.kg = roundTo(st.kg + inc, 0.25);
        st.reps = slot.repMin;
      } else {
        st.reps = Math.min(slot.repMax, st.reps + 1);
      }
      return {
        id: `${sessionId}-${ei}`,
        slotId: slot.id,
        exerciseId: slot.exerciseId,
        repMin: slot.repMin,
        repMax: slot.repMax,
        sets,
        done: true,
      };
    });
    sessions.push({
      id: sessionId,
      date: d,
      dayType: type,
      startedAt,
      finishedAt: clock + 60_000,
      status: "done",
      entries,
      exerciseIds: entries.map((e) => e.exerciseId),
    });
  }

  const bodyweights: Bodyweight[] = [];
  for (let i = 0; i < 56; i++) {
    if (rand() < 0.12) continue;
    const date = addDays(start, i);
    bodyweights.push({ date, kg: Math.round((80.6 - (0.35 / 7) * i + (rand() - 0.5) * 0.8) * 10) / 10 });
  }

  const foods = Object.fromEntries((await db.foods.toArray()).map((f) => [f.id, f]));
  const foodLogs: FoodLog[] = [];
  const day = [
    [
      ["oats", 1],
      ["whey", 1],
      ["pisang", 1],
    ],
    [
      ["nasi-putih", 1],
      ["ayam-bakar", 1],
      ["tempe-goreng", 1],
    ],
    [
      ["greek-yogurt", 1],
      ["telur-rebus", 2],
    ],
    [
      ["nasi-putih", 1],
      ["dada-ayam", 2],
      ["tahu-goreng", 0.5],
    ],
  ] as const;
  const swaps = ["nasi-padang", "soto-ayam", "bakso", "sate-ayam", "gado-gado"];
  for (let i = 1; i <= 21; i++) {
    const date = addDays(todayISO, -i);
    if (rand() < 0.1) continue;
    day.forEach((meal, mi) => {
      const items = mi === 3 && rand() < 0.4 ? [[swaps[Math.floor(rand() * swaps.length)], 1] as const] : meal;
      items.forEach(([fid, servings], k) => {
        const f = foods[fid];
        if (!f) return;
        const s = servings * (1.1 + rand() * 0.3);
        foodLogs.push({
          id: `demo-fl-${date}-${mi}-${k}`,
          date,
          createdAt: parseISODate(date).getTime() + (7 + mi * 4) * 3_600_000,
          name: f.name,
          servings: Math.round(s * 100) / 100,
          kcal: Math.round(f.kcal * s),
          protein: Math.round(f.protein * s * 10) / 10,
          carbs: Math.round(f.carbs * s * 10) / 10,
          fat: Math.round(f.fat * s * 10) / 10,
          source: "food",
          foodId: f.id,
        });
      });
    });
  }

  await db.transaction("rw", [db.sessions, db.dayLogs, db.bodyweights, db.foodLogs, db.meals], async () => {
    await db.sessions.bulkPut(sessions);
    await db.dayLogs.bulkPut(dayLogs);
    await db.bodyweights.bulkPut(bodyweights);
    await db.foodLogs.bulkPut(foodLogs);
    await db.meals.bulkPut([
      {
        id: "meal-breakfast",
        name: "Gym breakfast",
        items: [
          { foodId: "oats", servings: 1 },
          { foodId: "whey", servings: 1 },
          { foodId: "pisang", servings: 1 },
        ],
      },
      {
        id: "meal-lunch",
        name: "Nasi + ayam bakar + tempe",
        items: [
          { foodId: "nasi-putih", servings: 1 },
          { foodId: "ayam-bakar", servings: 1 },
          { foodId: "tempe-goreng", servings: 1 },
        ],
      },
    ]);
  });
}

/** The owner's real starting point (Oct 2026): 179 cm (5'10.5"), 64.6 kg, 22, Nightwing lean bulk to 72 kg. */
export const OWNER_PROFILE = { sex: "male", age: 22, heightCm: 179, weightKg: 64.6, activity: "moderate" } as const;
export const OWNER_GOAL = { preset: "nightwing", phase: "bulk", rateKgPerWeek: 0.25, targetWeightKg: 72 } as const;

/**
 * Fill in the owner's profile and goal if they're missing (new device, or a database created
 * before these existed). Never overwrites anything the owner has already set.
 */
export async function ensureOwnerDefaults(db: AlfredDB, todayISO: string) {
  await db.transaction("rw", [db.settings, db.bodyweights, db.muscleTargets], async () => {
    const s = await db.settings.get("app");
    if (s && (!s.profile || !s.goal)) {
      await db.settings.put({ ...s, profile: s.profile ?? { ...OWNER_PROFILE }, goal: s.goal ?? { ...OWNER_GOAL } });
    }
    if ((await db.bodyweights.count()) === 0) await db.bodyweights.put({ date: todayISO, kg: OWNER_PROFILE.weightKg });
  });
}
