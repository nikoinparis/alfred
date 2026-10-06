import { addDays, startOfWeek } from "./dates";
import { weeklyMuscleVolume } from "./volume";
import type { DayLog, Exercise, Muscle, Session } from "./types";

const PUSH_MUSCLES: Muscle[] = ["chest", "frontDelts", "sideDelts", "triceps"];
const PULL_MUSCLES: Muscle[] = ["lats", "upperBack", "rearDelts", "biceps"];

export interface WeeklyReview {
  trainingDays: number;
  hardSets: number;
  pushSets: number;
  pullSets: number;
  quadSets: number;
  hamstringSets: number;
  notes: string[];
}

function sum(v: Record<Muscle, { sets: number }>, ms: Muscle[]) {
  return ms.reduce((a, m) => a + v[m].sets, 0);
}

/**
 * Volume balance for a week. Flags push:pull outside 0.75–1.33 and
 * quads:hamstrings above 2:1, which are common imbalance signals for this split.
 */
export function weeklyReview(sessions: Session[], exercises: Record<string, Exercise | undefined>): WeeklyReview {
  const v = weeklyMuscleVolume(sessions, exercises);
  const trainingDays = new Set(
    sessions.filter((s) => s.dayType !== "rest" && s.entries.some((e) => e.sets.some((x) => x.done))).map((s) => s.date),
  ).size;
  const pushSets = sum(v, PUSH_MUSCLES);
  const pullSets = sum(v, PULL_MUSCLES);
  const quadSets = v.quads.sets;
  const hamstringSets = v.hamstrings.sets;
  const hardSets = sessions.reduce(
    (a, s) => a + s.entries.reduce((b, e) => b + e.sets.filter((x) => x.done && (x.kind === "working" || x.kind === "failure")).length, 0),
    0,
  );
  const notes: string[] = [];
  if (pushSets > 0 && pullSets > 0) {
    const r = pushSets / pullSets;
    if (r > 1.33) notes.push(`Pushing ${r.toFixed(1)}× more than pulling. Add a set of rows or face pulls.`);
    else if (r < 0.75) notes.push(`Pulling ${(1 / r).toFixed(1)}× more than pushing. Fine short-term; watch chest volume.`);
  }
  if (quadSets > 0 && hamstringSets > 0 && quadSets / hamstringSets > 2) {
    notes.push("Quads are getting over twice the hamstring work. An extra curl or RDL set would balance it.");
  }
  if (quadSets > 0 && hamstringSets === 0) notes.push("No hamstring work yet this week.");
  return { trainingDays, hardSets, pushSets, pullSets, quadSets, hamstringSets, notes };
}

/**
 * Consecutive weeks (ending with the last completed week, plus this week if it already qualifies)
 * with at least `minDays` training days.
 */
export function weekStreak(logs: DayLog[], today: string, minDays = 4): number {
  const trainingByWeek = new Map<string, number>();
  for (const l of logs) {
    if (l.status !== "done" || l.dayType === "rest") continue;
    const w = startOfWeek(l.date);
    trainingByWeek.set(w, (trainingByWeek.get(w) ?? 0) + 1);
  }
  const thisWeek = startOfWeek(today);
  let streak = (trainingByWeek.get(thisWeek) ?? 0) >= minDays ? 1 : 0;
  for (let w = addDays(thisWeek, -7); (trainingByWeek.get(w) ?? 0) >= minDays; w = addDays(w, -7)) streak++;
  return streak;
}
