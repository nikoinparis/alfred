import { addDays, compareDates } from "./dates";
import { DAY_GROUPS, DAY_LABEL } from "./muscles";
import type { DayLog, DayType, TrainingDayType } from "./types";

/** Push → Pull → Legs → Rest → Upper → Lower → Rest, then repeat. */
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
  /** Last date to plan, inclusive (usually end of week). */
  until: string;
  /** Everything the user has done, skipped, or explicitly planned. */
  logs: DayLog[];
  cycle?: readonly DayType[];
  maxConsecutive?: number;
}

interface State {
  cursor: number;
  prev: DayType | null;
  consecutive: number;
}

function isTraining(t: DayType | null): t is TrainingDayType {
  return t !== null && t !== "rest";
}

export function conflicts(a: DayType | null, b: DayType | null): boolean {
  if (!isTraining(a) || !isTraining(b)) return false;
  if (a === b) return true;
  const ga = DAY_GROUPS[a];
  return DAY_GROUPS[b].some((g) => ga.includes(g));
}

function applyDay(state: State, type: DayType | "off", cycle: readonly DayType[]): State {
  if (type === "off" || type === "rest") {
    // Any non-training day satisfies a pending rest slot; training slots wait.
    const cursor = cycle[state.cursor] === "rest" ? (state.cursor + 1) % cycle.length : state.cursor;
    return { cursor, prev: "rest", consecutive: 0 };
  }
  const idx = cycle.indexOf(type);
  const cursor = idx === -1 ? state.cursor : (idx + 1) % cycle.length;
  return { cursor, prev: type, consecutive: state.consecutive + 1 };
}

/**
 * Suggest day types for every unplanned date in [today, until].
 *
 * Rules, in priority order:
 * 1. Logged/planned days are fixed; the cycle position follows the last training day actually done.
 * 2. A missed or skipped past day counts as rest: it fills a pending rest slot,
 *    but the next training day is still owed (the cycle does not skip it).
 * 3. Never more than `maxConsecutive` training days in a row (including fixed future days).
 * 4. Never the same major muscle group on consecutive days (including fixed neighbours);
 *    if the cycle's next pick conflicts, take the next non-conflicting type in cycle order.
 */
export function suggestPlan(input: PlannerInput): Suggestion[] {
  const cycle = input.cycle ?? BASE_CYCLE;
  const max = input.maxConsecutive ?? DEFAULT_MAX_CONSECUTIVE;
  const byDate = new Map<string, DayLog>();
  for (const log of input.logs) byDate.set(log.date, log);

  const sorted = [...input.logs].sort((a, b) => compareDates(a.date, b.date));
  let state: State = { cursor: 0, prev: null, consecutive: 0 };

  // Replay history up to (not including) today.
  if (sorted.length && compareDates(sorted[0].date, input.today) < 0) {
    for (let d = sorted[0].date; compareDates(d, input.today) < 0; d = addDays(d, 1)) {
      const log = byDate.get(d);
      const happened = log && log.status !== "skipped";
      state = applyDay(state, happened ? log.dayType : "off", cycle);
    }
  }

  const out: Suggestion[] = [];
  for (let d = input.today; compareDates(d, input.until) <= 0; d = addDays(d, 1)) {
    const fixed = byDate.get(d);
    if (fixed && fixed.status !== "skipped") {
      state = applyDay(state, fixed.dayType, cycle);
      continue;
    }
    if (fixed?.status === "skipped") {
      state = applyDay(state, "off", cycle);
      continue;
    }

    const next = fixedTrainingAhead(byDate, d);
    const pick = choose(state, cycle, max, next);
    out.push({ date: d, dayType: pick.dayType, reason: pick.reason });
    state = applyDay(state, pick.dayType, cycle);
    if (pick.dayType !== "rest" && pick.cursor !== undefined) state.cursor = pick.cursor;
  }
  return out;
}

interface Ahead {
  /** Type planned for the following day, if fixed. */
  nextType: DayType | null;
  /** Number of consecutive fixed training days starting tomorrow. */
  run: number;
}

function fixedTrainingAhead(byDate: Map<string, DayLog>, date: string): Ahead {
  const first = byDate.get(addDays(date, 1));
  const nextType = first && first.status !== "skipped" ? first.dayType : null;
  let run = 0;
  for (let d = addDays(date, 1); ; d = addDays(d, 1)) {
    const log = byDate.get(d);
    if (!log || log.status === "skipped" || log.dayType === "rest") break;
    run++;
  }
  return { nextType, run };
}

function choose(
  state: State,
  cycle: readonly DayType[],
  max: number,
  ahead: Ahead,
): { dayType: DayType; reason: string; cursor?: number } {
  if (state.consecutive >= max) {
    return { dayType: "rest", reason: `${max} training days in a row. Recover today.` };
  }
  if (state.consecutive + 1 + ahead.run > max) {
    return { dayType: "rest", reason: "Rest now so the planned days ahead don't stack up." };
  }

  const candidate = cycle[state.cursor];
  if (candidate === "rest") {
    return { dayType: "rest", reason: "Scheduled recovery in the cycle." };
  }

  const ok = (t: DayType) => !conflicts(state.prev, t) && !conflicts(t, ahead.nextType);
  if (ok(candidate)) {
    return {
      dayType: candidate,
      reason: state.prev && isTraining(state.prev)
        ? `Follows ${DAY_LABEL[state.prev]} in your cycle.`
        : "Next up in your cycle.",
    };
  }

  for (let k = 1; k < cycle.length; k++) {
    const idx = (state.cursor + k) % cycle.length;
    const t = cycle[idx];
    if (t !== "rest" && ok(t)) {
      return {
        dayType: t,
        reason: `${DAY_LABEL[candidate]} would hit the same muscles back-to-back, so the cycle jumps to ${DAY_LABEL[t]}.`,
        cursor: (idx + 1) % cycle.length,
      };
    }
  }
  return { dayType: "rest", reason: "Every option overlaps yesterday's muscles." };
}
