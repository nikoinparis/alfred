import { addDays, compareDates, startOfWeek, weekDates } from "./dates";
import { DAY_GROUPS } from "./muscles";
import type { DayLog, DayType, TrainingDayType } from "./types";

/**
 * Weekly planner.
 *
 * The ideal week (Mon–Sun) is Push, Pull, Legs, rest, Upper, Lower, rest. Push and Pull are a pair
 * that go back to back; Legs sits either before or after that pair (PPL or LPP). Upper and Lower
 * are a pair in either order. A rest day separates the two blocks. Every Monday starts fresh.
 *
 * When fewer days are left in the week than the full plan needs, the planner fits as much as it
 * can: Push/Pull/Legs first, then Upper ahead of Lower. Days you've logged or planned are fixed;
 * only open days from today on are planned around them.
 */

/** Ideal week, used to generate demo history. */
export const BASE_CYCLE: readonly DayType[] = ["push", "pull", "legs", "rest", "upper", "lower", "rest"];

export const DEFAULT_MAX_CONSECUTIVE = 3;

export interface Suggestion {
  date: string;
  dayType: DayType;
  reason: string;
}

export interface PlannerInput {
  /** First date that may receive a suggestion (usually today). */
  today: string;
  /** Last date to plan, inclusive. */
  until: string;
  /** Everything the user has done, skipped, or explicitly planned. */
  logs: DayLog[];
  maxConsecutive?: number;
}

const TRAINING: TrainingDayType[] = ["push", "pull", "legs", "upper", "lower"];
/** Value of fitting each session into the week; Upper outranks Lower when only one fits. */
const VALUE: Record<TrainingDayType, number> = { push: 10, pull: 10, legs: 10, upper: 9, lower: 6 };
const PPL = new Set<DayType>(["push", "pull", "legs"]);
const UL = new Set<DayType>(["upper", "lower"]);

function isTraining(t: DayType | null | undefined): t is TrainingDayType {
  return t !== null && t !== undefined && t !== "rest";
}

export function conflicts(a: DayType | null, b: DayType | null): boolean {
  if (!isTraining(a) || !isTraining(b)) return false;
  if (a === b) return true;
  const ga = DAY_GROUPS[a];
  return DAY_GROUPS[b].some((g) => ga.includes(g));
}

type Slot = { kind: "past" | "fixed" | "free"; type: DayType | null };

interface Context {
  /** Consecutive training days ending the day before the week starts. */
  streak: number;
  /** Type of the day before the week starts. */
  prev: DayType | null;
}

/** Score a full Mon–Sun assignment. Higher is better. */
function score(seq: (DayType | null)[], slots: Slot[], ctx: Context, max: number): number {
  const free = (i: number) => slots[i].kind === "free";
  const past = (i: number) => slots[i].kind === "past";
  /** Penalty weight for a rule broken between two days: full when we chose it, light when history forces it. */
  const sev = (i: number, j: number) => (!free(i) && !free(j) ? 0 : past(i) || past(j) ? 3 : 30);

  let s = 0;
  const pos: Partial<Record<TrainingDayType, number>> = {};
  for (let i = 0; i < 7; i++) {
    const t = seq[i];
    if (!isTraining(t)) continue;
    if (pos[t] === undefined) {
      pos[t] = i;
      s += VALUE[t];
    } else if (free(i)) {
      s -= 25; // each session once a week
    }
  }
  if (pos.push !== undefined && pos.pull !== undefined && pos.legs !== undefined) s += 5;

  // Push and Pull back to back.
  if (pos.push !== undefined && pos.pull !== undefined && Math.abs(pos.push - pos.pull) !== 1) s -= sev(pos.push, pos.pull);
  // Legs directly before or after the Push/Pull pair.
  if (pos.legs !== undefined) {
    const pair = [pos.push, pos.pull].filter((x): x is number => x !== undefined);
    if (pair.length) {
      const lo = Math.min(...pair);
      const hi = Math.max(...pair);
      const ok = pair.length === 2 ? pos.legs === lo - 1 || pos.legs === hi + 1 : Math.abs(pos.legs - lo) === 1;
      if (!ok) s -= sev(pos.legs, pos.legs < lo ? lo : hi);
    }
  }
  // Upper and Lower back to back.
  if (pos.upper !== undefined && pos.lower !== undefined && Math.abs(pos.upper - pos.lower) !== 1) s -= sev(pos.upper, pos.lower);

  // A rest day between the blocks (this also rules out Upper next to Push/Pull and Lower next to Legs).
  for (let i = 0; i + 1 < 7; i++) {
    const a = seq[i];
    const b = seq[i + 1];
    if (isTraining(a) && isTraining(b) && ((PPL.has(a) && UL.has(b)) || (UL.has(a) && PPL.has(b)))) s -= sev(i, i + 1);
  }
  if (free(0) && conflicts(ctx.prev, seq[0])) s -= 30;

  // Never more than `max` training days in a row (counting the end of last week).
  let run = ctx.streak;
  for (let i = 0; i < 7; i++) {
    run = isTraining(seq[i]) ? run + 1 : 0;
    if (run > max && free(i)) s -= 50;
  }

  // Preferences: Push before Pull, Push/Pull/Legs before Upper/Lower, and train sooner rather than later.
  if (pos.push !== undefined && pos.pull !== undefined && pos.pull < pos.push && free(pos.pull) && free(pos.push)) s -= 2;
  const firstPPL = Math.min(...[pos.push, pos.pull, pos.legs].filter((x): x is number => x !== undefined));
  const firstUL = Math.min(...[pos.upper, pos.lower].filter((x): x is number => x !== undefined));
  if (Number.isFinite(firstPPL) && Number.isFinite(firstUL) && firstUL < firstPPL && free(firstUL)) s -= 1;
  for (let i = 0; i < 7; i++) if (free(i) && isTraining(seq[i])) s -= 0.05 * i;
  return s;
}

/** Best assignment for the free days of one week (exhaustive search; at most 7 free days). */
function solveWeek(slots: Slot[], ctx: Context, max: number): (DayType | null)[] {
  const seq = slots.map((x) => x.type);
  const used = new Set(slots.filter((x) => x.kind !== "free" && isTraining(x.type)).map((x) => x.type));
  const freeIdx = slots.map((x, i) => (x.kind === "free" ? i : -1)).filter((i) => i >= 0);
  let best: (DayType | null)[] = seq.slice();
  let bestScore = -Infinity;

  const dfs = (k: number) => {
    if (k === freeIdx.length) {
      const sc = score(seq, slots, ctx, max);
      if (sc > bestScore) {
        bestScore = sc;
        best = seq.slice();
      }
      return;
    }
    const i = freeIdx[k];
    for (const t of [...TRAINING.filter((x) => !used.has(x)), "rest" as const]) {
      seq[i] = t;
      if (t !== "rest") used.add(t);
      dfs(k + 1);
      if (t !== "rest") used.delete(t);
    }
    seq[i] = null;
  };
  dfs(0);
  return best;
}

function reasonFor(seq: (DayType | null)[], i: number): string {
  const t = seq[i];
  const prev = i > 0 ? seq[i - 1] : null;
  const next = i < 6 ? seq[i + 1] : null;
  const later = seq.slice(i + 1);
  const has = (x: DayType) => seq.includes(x);
  switch (t) {
    case "push":
      return next === "pull" ? "Push today, Pull tomorrow." : prev === "pull" ? "Push pairs with yesterday's Pull." : "Push.";
    case "pull":
      return prev === "push" ? "Pull follows yesterday's Push." : next === "push" ? "Pull today, Push tomorrow." : "Pull.";
    case "legs":
      return later.includes("push") || later.includes("pull") ? "Legs first, then Push and Pull." : "Legs completes Push/Pull/Legs.";
    case "upper":
      if (next === "lower") return "Upper today, Lower tomorrow.";
      if (prev === "lower") return "Upper completes Upper/Lower.";
      return has("lower") ? "Upper." : "Upper takes priority when the week is too short for both Upper and Lower.";
    case "lower":
      return prev === "upper" ? "Lower pairs with yesterday's Upper." : next === "upper" ? "Lower today, Upper tomorrow." : "Lower.";
    default: {
      if (!later.some(isTraining)) return "This week's sessions are done. Rest up for Monday.";
      if (isTraining(prev) && later.some(isTraining)) {
        const nextT = later.find(isTraining)!;
        if ((PPL.has(prev) && UL.has(nextT)) || (UL.has(prev) && PPL.has(nextT))) return "Rest between Push/Pull/Legs and Upper/Lower.";
      }
      return "Recovery day.";
    }
  }
}

export function suggestPlan(input: PlannerInput): Suggestion[] {
  const max = input.maxConsecutive ?? DEFAULT_MAX_CONSECUTIVE;
  const byDate = new Map<string, DayLog>();
  for (const log of input.logs) byDate.set(log.date, log);
  const typeOn = (d: string): DayType | null => {
    const log = byDate.get(d);
    return log && log.status !== "skipped" ? log.dayType : null;
  };

  let weekStart = startOfWeek(input.today);
  // Context from the days before the first planned week.
  let ctx: Context = { streak: 0, prev: typeOn(addDays(weekStart, -1)) };
  for (let d = addDays(weekStart, -1); isTraining(typeOn(d)); d = addDays(d, -1)) ctx.streak++;

  const out: Suggestion[] = [];
  for (; compareDates(weekStart, input.until) <= 0; weekStart = addDays(weekStart, 7)) {
    const dates = weekDates(weekStart);
    const slots: Slot[] = dates.map((d) => {
      const log = byDate.get(d);
      if (log) return { kind: compareDates(d, input.today) < 0 ? "past" : "fixed", type: log.status === "skipped" ? null : log.dayType };
      if (compareDates(d, input.today) < 0) return { kind: "past", type: null };
      return { kind: "free", type: null };
    });
    const seq = solveWeek(slots, ctx, max);
    dates.forEach((d, i) => {
      if (slots[i].kind !== "free" || compareDates(d, input.until) > 0) return;
      out.push({ date: d, dayType: seq[i] ?? "rest", reason: reasonFor(seq, i) });
    });
    let streak = 0;
    for (let i = 6; i >= 0 && isTraining(seq[i]); i--) streak++;
    ctx = { streak: streak === 7 ? ctx.streak + 7 : streak, prev: seq[6] };
  }
  return out;
}
