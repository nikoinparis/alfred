import { daysBetween } from "./dates";

export type Sex = "male" | "female";
export type Activity = "sedentary" | "light" | "moderate" | "very" | "athlete";
export type Phase = "cut" | "bulk" | "recomp" | "maintain";
export type GoalPreset = "lean" | "muscular" | "strong";

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  athlete: 1.9,
};

export const ACTIVITY_LABEL: Record<Activity, string> = {
  sedentary: "Desk job, little walking",
  light: "Light: training 2–3×/week",
  moderate: "Moderate: training 4–5×/week",
  very: "Very active: training 6×/week or physical job",
  athlete: "Athlete: twice-daily or heavy labour",
};

export interface PresetMeta {
  label: string;
  blurb: string;
  proteinPerKg: number;
  fatPerKg: number;
  defaultPhase: Phase;
  /** Default rate as % of bodyweight per week (negative = loss). */
  defaultRatePct: number;
}

export const PRESETS: Record<GoalPreset, PresetMeta> = {
  lean: {
    label: "Lean / athletic",
    blurb: "Visible abs, athletic shape. Prioritises staying lean while keeping strength.",
    proteinPerKg: 2.0,
    fatPerKg: 0.8,
    defaultPhase: "cut",
    defaultRatePct: -0.5,
  },
  muscular: {
    label: "Muscular",
    blurb: "More size with minimal fat gain. Slow, controlled surplus.",
    proteinPerKg: 1.8,
    fatPerKg: 0.9,
    defaultPhase: "bulk",
    defaultRatePct: 0.25,
  },
  strong: {
    label: "Strong",
    blurb: "Performance first. Generous carbs to fuel heavy sessions.",
    proteinPerKg: 1.8,
    fatPerKg: 1.0,
    defaultPhase: "bulk",
    defaultRatePct: 0.4,
  },
};

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
}

export interface GoalSettings {
  preset: GoalPreset;
  phase: Phase;
  /** kg per week; negative for loss. */
  rateKgPerWeek: number;
}

/** Energy in 1 kg of body mass change (mixed tissue), kcal. */
export const KCAL_PER_KG = 7700;

export function bmrMifflin(p: Pick<Profile, "sex" | "age" | "heightCm" | "weightKg">): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "male" ? 5 : -161);
}

export function tdee(p: Profile): number {
  return bmrMifflin(p) * ACTIVITY_FACTOR[p.activity];
}

export interface MacroTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface TargetBreakdown {
  bmr: number;
  tdee: number;
  dailyDelta: number;
  proteinPerKg: number;
  fatPerKg: number;
  targets: MacroTargets;
  notes: string[];
}

export function phaseRate(phase: Phase, rate: number): number {
  if (phase === "maintain" || phase === "recomp") return phase === "recomp" ? Math.min(0, Math.max(rate, -0.15)) : 0;
  if (phase === "cut") return -Math.abs(rate);
  return Math.abs(rate);
}

/**
 * Calorie and macro targets.
 * kcal = TDEE + rate × 7700 / 7, floored at BMR so a cut never undershoots resting needs.
 * Protein 1.6–2.2 g/kg (top of the range in a cut); fat ≥ 0.6 g/kg and ≥ 20% of kcal; carbs fill the rest.
 */
export function computeTargets(profile: Profile, goal: GoalSettings): TargetBreakdown {
  const notes: string[] = [];
  const preset = PRESETS[goal.preset];
  const bmr = bmrMifflin(profile);
  const t = tdee(profile);
  const rate = phaseRate(goal.phase, goal.rateKgPerWeek);
  let delta = (rate * KCAL_PER_KG) / 7;
  let kcal = t + delta;
  if (kcal < bmr) {
    notes.push("Deficit capped so intake stays at or above your BMR.");
    kcal = bmr;
    delta = kcal - t;
  }

  let proteinPerKg = preset.proteinPerKg;
  if (goal.phase === "cut") proteinPerKg = 2.2;
  if (goal.phase === "recomp") proteinPerKg = Math.max(proteinPerKg, 2.0);
  proteinPerKg = Math.min(2.2, Math.max(1.6, proteinPerKg));
  const protein = proteinPerKg * profile.weightKg;

  let fatPerKg = Math.max(0.6, preset.fatPerKg);
  let fat = fatPerKg * profile.weightKg;
  const fatFloorByKcal = (kcal * 0.2) / 9;
  if (fat < fatFloorByKcal) {
    fat = fatFloorByKcal;
    fatPerKg = fat / profile.weightKg;
    notes.push("Fat raised to 20% of calories (hormonal health floor).");
  }

  let carbs = (kcal - protein * 4 - fat * 9) / 4;
  if (carbs < 50) {
    notes.push("Very low carb at this intake. Consider a slower rate.");
    carbs = Math.max(0, carbs);
  }

  const r = (v: number, step = 1) => Math.round(v / step) * step;
  return {
    bmr: r(bmr),
    tdee: r(t),
    dailyDelta: r(delta),
    proteinPerKg: Math.round(proteinPerKg * 10) / 10,
    fatPerKg: Math.round(fatPerKg * 100) / 100,
    targets: { kcal: r(kcal, 10), protein: r(protein), carbs: r(carbs), fat: r(fat) },
    notes,
  };
}

export interface WeighIn {
  date: string;
  kg: number;
}

export interface TrendPoint extends WeighIn {
  trend: number;
}

/** Exponentially smoothed trend (10%/day), gap-aware so missed days don't distort it. */
export function weightTrend(weighIns: WeighIn[], alpha = 0.1): TrendPoint[] {
  const sorted = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : 1));
  const out: TrendPoint[] = [];
  let prev: TrendPoint | null = null;
  for (const w of sorted) {
    if (!prev) {
      prev = { ...w, trend: w.kg };
    } else {
      const gap = Math.max(1, daysBetween(prev.date, w.date));
      const k = 1 - Math.pow(1 - alpha, gap);
      prev = { ...w, trend: prev.trend + k * (w.kg - prev.trend) };
    }
    out.push(prev);
  }
  return out;
}

/** Least-squares slope of raw weigh-ins over the last `days` days, in kg/week. */
export function weeklyRate(weighIns: WeighIn[], asOf: string, days = 14): number | null {
  const pts = weighIns.filter((w) => {
    const d = daysBetween(w.date, asOf);
    return d >= 0 && d < days;
  });
  if (pts.length < 4) return null;
  const xs = pts.map((p) => -daysBetween(p.date, asOf));
  const ys = pts.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return (num / den) * 7;
}

export type CheckInStatus = "on-track" | "too-fast" | "too-slow" | "adherence" | "insufficient-data";

export interface CheckIn {
  status: CheckInStatus;
  actualRate: number | null;
  targetRate: number;
  avgIntake: number | null;
  adjustKcal: number;
  message: string;
}

export interface CheckInInput {
  targetRate: number;
  targetKcal: number;
  weighIns: WeighIn[];
  /** Daily kcal totals for days with food logged in the review window. */
  intakeDays: number[];
  asOf: string;
  bodyweightKg: number;
}

/**
 * Weekly check-in:
 * 1. Need ≥4 weigh-ins and ≥4 logged days in the last 14 days.
 * 2. If average intake is >150 kcal off target, fix adherence before changing targets.
 * 3. Otherwise compare actual vs target rate; outside ±max(0.1 kg, 0.1% BW)/wk,
 *    adjust by the gap × 7700 / 7, rounded to 50 and capped at ±300 kcal.
 */
export function weeklyCheckIn(input: CheckInInput): CheckIn {
  const actualRate = weeklyRate(input.weighIns, input.asOf);
  const avgIntake = input.intakeDays.length
    ? input.intakeDays.reduce((a, b) => a + b, 0) / input.intakeDays.length
    : null;
  const base = { actualRate, targetRate: input.targetRate, avgIntake, adjustKcal: 0 };

  if (actualRate === null || input.intakeDays.length < 4) {
    return {
      ...base,
      status: "insufficient-data",
      message: "Log at least 4 weigh-ins and 4 days of food in the last two weeks to get a check-in.",
    };
  }
  if (avgIntake !== null && Math.abs(avgIntake - input.targetKcal) > 150) {
    return {
      ...base,
      status: "adherence",
      message: `You averaged ${Math.round(avgIntake)} kcal vs a ${input.targetKcal} kcal target. Hit the target for a week before changing it.`,
    };
  }
  const tolerance = Math.max(0.1, input.bodyweightKg * 0.001);
  const gap = input.targetRate - actualRate;
  if (Math.abs(gap) <= tolerance) {
    return { ...base, status: "on-track", message: "Right on pace. Keep everything the same." };
  }
  const raw = (gap * KCAL_PER_KG) / 7;
  const adjustKcal = Math.max(-300, Math.min(300, Math.round(raw / 50) * 50));
  const losing = input.targetRate < 0;
  const tooFast = losing ? actualRate < input.targetRate : actualRate > input.targetRate;
  return {
    ...base,
    status: tooFast ? "too-fast" : "too-slow",
    adjustKcal,
    message: `Trend ${fmtRate(actualRate)} vs target ${fmtRate(input.targetRate)}. ${
      adjustKcal >= 0 ? "Add" : "Cut"
    } ${Math.abs(adjustKcal)} kcal/day.`,
  };
}

function fmtRate(r: number): string {
  return `${r >= 0 ? "+" : ""}${r.toFixed(2)} kg/wk`;
}
