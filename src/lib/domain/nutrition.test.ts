import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { bmrMifflin, computeTargets, goalProgress, tdee, weeklyCheckIn, weeklyRate, weightTrend, type Profile } from "./nutrition";

const me: Profile = { sex: "male", age: 25, heightCm: 178, weightKg: 75, activity: "moderate" };

describe("Mifflin-St Jeor", () => {
  it("matches the published formula", () => {
    // 10×75 + 6.25×178 − 5×25 + 5 = 1742.5
    expect(bmrMifflin(me)).toBeCloseTo(1742.5);
    expect(bmrMifflin({ ...me, sex: "female" })).toBeCloseTo(1576.5);
    expect(tdee(me)).toBeCloseTo(1742.5 * 1.55);
  });
});

describe("computeTargets", () => {
  it("builds a cut: deficit from rate, protein 2.2 g/kg, macros add up", () => {
    const r = computeTargets(me, { preset: "lean", phase: "cut", rateKgPerWeek: 0.5 });
    expect(r.dailyDelta).toBe(-550);
    expect(r.targets.protein).toBe(165);
    const kcalFromMacros = r.targets.protein * 4 + r.targets.carbs * 4 + r.targets.fat * 9;
    expect(Math.abs(kcalFromMacros - r.targets.kcal)).toBeLessThan(15);
  });

  it("forces the sign of the rate from the phase", () => {
    expect(computeTargets(me, { preset: "muscular", phase: "bulk", rateKgPerWeek: -0.25 }).dailyDelta).toBe(275);
    expect(computeTargets(me, { preset: "muscular", phase: "maintain", rateKgPerWeek: 0.5 }).dailyDelta).toBe(0);
  });

  it("never sets calories below BMR", () => {
    const r = computeTargets(me, { preset: "lean", phase: "cut", rateKgPerWeek: 1.5 });
    expect(r.targets.kcal).toBeGreaterThanOrEqual(Math.round(r.bmr / 10) * 10);
    expect(r.notes.join(" ")).toMatch(/BMR/);
  });

  it("keeps fat at or above the floor", () => {
    const r = computeTargets(me, { preset: "lean", phase: "cut", rateKgPerWeek: 0.5 });
    expect(r.targets.fat).toBeGreaterThanOrEqual(0.6 * 75);
    expect(r.targets.fat * 9).toBeGreaterThanOrEqual(r.targets.kcal * 0.2 - 9);
  });

  it("keeps protein within 1.6–2.2 g/kg", () => {
    for (const preset of ["lean", "muscular", "strong"] as const) {
      for (const phase of ["cut", "bulk", "recomp", "maintain"] as const) {
        const r = computeTargets(me, { preset, phase, rateKgPerWeek: 0.25 });
        expect(r.proteinPerKg).toBeGreaterThanOrEqual(1.6);
        expect(r.proteinPerKg).toBeLessThanOrEqual(2.2);
      }
    }
  });
});

const series = (start: string, kgs: number[]) => kgs.map((kg, i) => ({ date: addDays(start, i), kg }));

describe("weightTrend / weeklyRate", () => {
  it("smooths noise", () => {
    const t = weightTrend(series("2026-09-01", [75, 76, 74, 75.5, 74.5]));
    const trends = t.map((p) => p.trend);
    expect(Math.max(...trends) - Math.min(...trends)).toBeLessThan(0.5);
  });

  it("measures a steady loss of 0.5 kg/week", () => {
    const kgs = Array.from({ length: 14 }, (_, i) => 80 - (0.5 / 7) * i);
    expect(weeklyRate(series("2026-09-01", kgs), "2026-09-14")).toBeCloseTo(-0.5, 2);
  });

  it("needs at least 4 weigh-ins", () => {
    expect(weeklyRate(series("2026-09-12", [80, 79.8, 79.9]), "2026-09-14")).toBeNull();
  });
});

describe("weeklyCheckIn", () => {
  const asOf = "2026-09-14";
  const losing = (rate: number) =>
    series(
      "2026-09-01",
      Array.from({ length: 14 }, (_, i) => 80 + (rate / 7) * i),
    );
  const base = { targetRate: -0.5, targetKcal: 2200, intakeDays: [2200, 2180, 2210, 2200, 2190], asOf, bodyweightKg: 80 };

  it("says on track when the trend matches", () => {
    expect(weeklyCheckIn({ ...base, weighIns: losing(-0.5) }).status).toBe("on-track");
  });

  it("cuts calories when weight loss stalls", () => {
    const r = weeklyCheckIn({ ...base, weighIns: losing(-0.1) });
    expect(r.status).toBe("too-slow");
    expect(r.adjustKcal).toBe(-300); // gap 0.4 kg/wk ≈ 440 kcal, capped at 300
  });

  it("adds calories when losing too fast", () => {
    const r = weeklyCheckIn({ ...base, weighIns: losing(-0.8) });
    expect(r.status).toBe("too-fast");
    expect(r.adjustKcal).toBe(300); // gap 0.3 kg/wk ≈ 330 → 350, capped at 300
  });

  it("asks for adherence before changing targets", () => {
    const r = weeklyCheckIn({ ...base, intakeDays: [2600, 2700, 2500, 2650], weighIns: losing(0) });
    expect(r.status).toBe("adherence");
    expect(r.adjustKcal).toBe(0);
  });

  it("refuses to guess with too little data", () => {
    expect(weeklyCheckIn({ ...base, intakeDays: [2200], weighIns: losing(-0.5) }).status).toBe("insufficient-data");
  });
});

describe("Nightwing goal", () => {
  const owner: Profile = { sex: "male", age: 22, heightCm: 179, weightKg: 64.6, activity: "moderate" };
  const goal = { preset: "nightwing" as const, phase: "bulk" as const, rateKgPerWeek: 0.25, targetWeightKg: 72 };

  it("sets a modest surplus with 2 g/kg protein", () => {
    const r = computeTargets(owner, goal);
    expect(r.dailyDelta).toBe(275);
    expect(r.proteinPerKg).toBe(2);
    expect(r.targets.protein).toBe(129);
    expect(r.targets.kcal).toBeGreaterThan(r.tdee);
  });

  it("tracks progress to the target weight", () => {
    expect(goalProgress(64.6, goal)).toMatchObject({ reached: false, weeksLeft: 30 });
    expect(goalProgress(71.9, goal)?.reached).toBe(true);
    expect(goalProgress(70, { ...goal, phase: "maintain" })).toBeNull();
  });

  it("check-in says switch to maintenance once the trend reaches the target", () => {
    const at72 = Array.from({ length: 14 }, (_, i) => ({ date: addDays("2026-09-01", i), kg: 72 + (i % 2) * 0.1 }));
    const r = weeklyCheckIn({
      goal,
      targetRate: 0.25,
      targetKcal: 2850,
      weighIns: at72,
      intakeDays: [2850, 2850, 2850, 2850],
      asOf: "2026-09-14",
      bodyweightKg: 72,
    });
    expect(r.status).toBe("goal-reached");
  });
});
