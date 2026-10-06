import { convert, displayStep, incrementFor, roundTo } from "./units";
import type { Exercise, Session, SessionEntry, SetLog, Unit } from "./types";

/** Epley estimated 1RM. Reliable up to ~12 reps; beyond that it's a rough guide. */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * The load actually moved, in kg.
 * Assisted: bodyweight minus assistance. Bodyweight: bodyweight plus any added load.
 */
export function effectiveLoadKg(set: SetLog, exercise: Exercise, bodyweightKg: number | null): number | null {
  const w = set.weight === null ? 0 : convert(set.weight, set.unit, "kg");
  switch (exercise.loadMode) {
    case "total":
      return set.weight === null ? null : w;
    case "assisted":
      return bodyweightKg === null ? null : Math.max(0, bodyweightKg - w);
    case "bodyweight":
      return bodyweightKg === null ? (w > 0 ? w : null) : bodyweightKg + w;
  }
}

export function isWorking(set: SetLog): boolean {
  return set.done && (set.kind === "working" || set.kind === "failure");
}

export function setE1RM(set: SetLog, exercise: Exercise, bw: number | null): number {
  if (!set.done || !set.reps || set.kind === "warmup") return 0;
  const load = effectiveLoadKg(set, exercise, bw);
  return load ? estimate1RM(load, set.reps) : 0;
}

export function entryBestE1RM(entry: SessionEntry, exercise: Exercise, bw: number | null): number {
  return Math.max(0, ...entry.sets.map((s) => setE1RM(s, exercise, bw)));
}

/** Total kg × reps across completed non-warm-up sets. */
export function entryVolumeKg(entry: SessionEntry, exercise: Exercise, bw: number | null): number {
  return entry.sets.reduce((acc, s) => {
    if (!s.done || !s.reps || s.kind === "warmup") return acc;
    const load = effectiveLoadKg(s, exercise, bw);
    return acc + (load ?? 0) * s.reps;
  }, 0);
}

export interface HistoryPoint {
  date: string;
  sessionId: string;
  e1rm: number;
  volume: number;
  topWeightKg: number;
  entry: SessionEntry;
}

/** Per-session history for one exercise, oldest first. */
export function exerciseHistory(sessions: Session[], exercise: Exercise, bw: number | null): HistoryPoint[] {
  const points: HistoryPoint[] = [];
  for (const s of [...sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.startedAt - b.startedAt))) {
    for (const entry of s.entries) {
      if (entry.exerciseId !== exercise.id) continue;
      const done = entry.sets.filter((x) => x.done && x.kind !== "warmup");
      if (!done.length) continue;
      points.push({
        date: s.date,
        sessionId: s.id,
        e1rm: entryBestE1RM(entry, exercise, bw),
        volume: entryVolumeKg(entry, exercise, bw),
        topWeightKg: Math.max(0, ...done.map((x) => (x.weight === null ? 0 : convert(x.weight, x.unit, "kg")))),
        entry,
      });
    }
  }
  return points;
}

export type PRKind = "e1rm" | "weight" | "volume";

export interface PR {
  kind: PRKind;
  value: number;
  previous: number;
}

/**
 * PRs a just-logged entry sets against all earlier history for the exercise.
 * Assisted lifts skip the "heaviest weight" PR (less assistance isn't a heavier number).
 */
export function detectPRs(entry: SessionEntry, previous: HistoryPoint[], exercise: Exercise, bw: number | null): PR[] {
  if (!previous.length) return [];
  const prs: PR[] = [];
  const e1 = entryBestE1RM(entry, exercise, bw);
  const prevE1 = Math.max(...previous.map((p) => p.e1rm));
  if (e1 > 0 && e1 > prevE1 + 0.01) prs.push({ kind: "e1rm", value: e1, previous: prevE1 });

  if (exercise.loadMode === "total") {
    const top = Math.max(
      0,
      ...entry.sets.filter((s) => s.done && s.kind !== "warmup" && s.reps).map((s) => convert(s.weight ?? 0, s.unit, "kg")),
    );
    const prevTop = Math.max(...previous.map((p) => p.topWeightKg));
    if (top > prevTop + 0.01) prs.push({ kind: "weight", value: top, previous: prevTop });
  }

  const vol = entryVolumeKg(entry, exercise, bw);
  const prevVol = Math.max(...previous.map((p) => p.volume));
  if (vol > prevVol + 0.01) prs.push({ kind: "volume", value: vol, previous: prevVol });
  return prs;
}

export type OverloadAction = "start" | "increase" | "hold" | "reduce" | "deload";

export interface OverloadSuggestion {
  action: OverloadAction;
  /** Suggested working weight in `unit`, or null when there's nothing to go on. */
  weight: number | null;
  unit: Unit;
  reps: number;
  reason: string;
}

export interface OverloadInput {
  exercise: Exercise;
  repMin: number;
  repMax: number;
  plannedSets: number;
  /** This exercise's history, oldest first. */
  history: HistoryPoint[];
  /** Template target, if any. */
  target: { value: number; unit: Unit } | null;
  unit: Unit;
  bodyweightKg: number | null;
}

/**
 * Double progression:
 * - every planned working set at the top of the rep range → add one increment
 *   (assisted lifts: remove one increment of assistance), unless average RPE ≥ 9.5;
 * - 2+ reps under the range on any set, two sessions running at the same weight → drop one increment;
 * - no e1RM progress across the last three sessions → deload ~10%;
 * - otherwise keep the weight and chase reps.
 */
export function suggestOverload(input: OverloadInput): OverloadSuggestion {
  const { exercise, repMin, repMax, plannedSets, history, target, unit } = input;
  const inc = incrementFor(exercise.incrementKg, unit);
  const round = (v: number) => roundTo(v, displayStep(unit));

  if (!history.length) {
    return {
      action: "start",
      weight: target ? round(convert(target.value, target.unit, unit)) : null,
      unit,
      reps: repMin,
      reason: target ? "First session. Starting from your template weight." : "First session. Pick a weight you can do for clean reps.",
    };
  }

  const last = history[history.length - 1];
  const working = last.entry.sets.filter(isWorking);
  const topSet = working.reduce<SetLog | null>((best, s) => {
    if (s.weight === null) return best;
    if (!best || best.weight === null) return s;
    const a = convert(s.weight, s.unit, "kg");
    const b = convert(best.weight, best.unit, "kg");
    // For assisted lifts the "top" set is the one with the least assistance.
    return exercise.loadMode === "assisted" ? (a < b ? s : best) : a > b ? s : best;
  }, null);
  const lastWeight = topSet?.weight != null ? round(convert(topSet.weight, topSet.unit, unit)) : null;
  const direction = exercise.loadMode === "assisted" ? -1 : 1;
  const topSetsAtWeight = working.filter(
    (s) =>
      s.weight !== null &&
      topSet?.weight != null &&
      Math.abs(convert(s.weight, s.unit, "kg") - convert(topSet.weight, topSet.unit, "kg")) < 0.01,
  );

  // Stall → deload
  if (history.length >= 4) {
    const recent = history.slice(-3).map((p) => p.e1rm);
    const before = history[history.length - 4].e1rm;
    if (before > 0 && Math.max(...recent) <= before + 0.01 && lastWeight !== null) {
      const deload = exercise.loadMode === "assisted" ? lastWeight * 1.1 + inc : lastWeight * 0.9;
      return {
        action: "deload",
        weight: round(Math.max(0, deload)),
        unit,
        reps: repMax,
        reason: "No progress across your last 3 sessions. Take ~10% off, rebuild with crisp reps.",
      };
    }
  }

  // Too heavy two sessions running at the same weight → step back
  if (history.length >= 2 && lastWeight !== null) {
    const prev = history[history.length - 2];
    const sameWeight = Math.abs(prev.topWeightKg - last.topWeightKg) < 0.01;
    // Missing a single rep is normal; two or more short on any set means the load is too heavy.
    const under = (h: HistoryPoint) => h.entry.sets.filter(isWorking).some((s) => (s.reps ?? 0) <= repMin - 2);
    if (sameWeight && under(last) && under(prev)) {
      return {
        action: "reduce",
        weight: round(Math.max(0, lastWeight - direction * inc)),
        unit,
        reps: repMin,
        reason: `Well under ${repMin} reps two sessions in a row. Drop one step and own the range.`,
      };
    }
  }

  const allTop = topSetsAtWeight.length >= plannedSets && topSetsAtWeight.every((s) => (s.reps ?? 0) >= repMax);
  if (allTop && lastWeight !== null) {
    const rpes = topSetsAtWeight.map((s) => s.rpe).filter((r): r is number => typeof r === "number");
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    if (avgRpe !== null && avgRpe >= 9.5) {
      return {
        action: "hold",
        weight: lastWeight,
        unit,
        reps: repMax,
        reason: `Hit ${plannedSets}×${repMax} but at RPE ${avgRpe.toFixed(1)}. Repeat once and make it look easier.`,
      };
    }
    const next = round(Math.max(0, lastWeight + direction * inc));
    return {
      action: "increase",
      weight: next,
      unit,
      reps: repMin,
      reason:
        exercise.loadMode === "assisted"
          ? `You hit ${plannedSets}×${repMax} with ${fmt(lastWeight)} ${unit} assist. Try ${fmt(next)} ${unit}.`
          : `You hit ${plannedSets}×${repMax} at ${fmt(lastWeight)} ${unit}. Try ${fmt(next)} ${unit}.`,
    };
  }

  const bestReps = Math.min(repMax, Math.max(repMin, ...topSetsAtWeight.map((s) => (s.reps ?? 0) + 1)));
  return {
    action: "hold",
    weight: lastWeight ?? (target ? round(convert(target.value, target.unit, unit)) : null),
    unit,
    reps: bestReps,
    reason:
      lastWeight !== null
        ? `Stay at ${fmt(lastWeight)} ${unit} and push every set toward ${repMax} reps.`
        : "Log a weight to get suggestions.",
  };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export interface WarmupSet {
  weight: number;
  reps: number;
}

/** Ramp for compound lifts: ~40/60/80% of the working weight, skipping steps below the bar. */
export function warmupRamp(workingWeight: number, unit: Unit, equipment: Exercise["equipment"], incrementKg: number): WarmupSet[] {
  const bar = equipment === "barbell" ? (unit === "kg" ? 20 : 45) : 0;
  const step = incrementFor(incrementKg, unit) || displayStep(unit);
  const scheme: [number, number][] = [
    [0.4, 8],
    [0.6, 5],
    [0.8, 3],
  ];
  const out: WarmupSet[] = [];
  if (bar && workingWeight > bar * 1.5) out.push({ weight: bar, reps: 10 });
  for (const [pct, reps] of scheme) {
    const w = roundTo(workingWeight * pct, step);
    if (w <= bar || w <= 0 || w >= workingWeight) continue;
    if (out.some((o) => o.weight === w)) continue;
    out.push({ weight: w, reps });
  }
  return out;
}

export interface PlateLoad {
  perSide: number[];
  bar: number;
  achieved: number;
  remainder: number;
}

export const PLATES: Record<Unit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

/** Greedy plate loading per side. */
export function plateLoad(total: number, unit: Unit, bar = unit === "kg" ? 20 : 45, plates = PLATES[unit]): PlateLoad {
  let side = Math.max(0, (total - bar) / 2);
  const perSide: number[] = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (side + 1e-9 >= p) {
      perSide.push(p);
      side -= p;
    }
  }
  const achieved = bar + perSide.reduce((a, b) => a + b, 0) * 2;
  return { perSide, bar, achieved: roundTo(achieved, 0.01), remainder: roundTo(Math.max(0, total - achieved), 0.01) };
}
