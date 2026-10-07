import { addDays, compareDates } from "./dates";
import { DAY_GROUPS, DAY_LABEL } from "./muscles";
import type { DayLog, DayType, TrainingDayType } from "./types";

/**
 * The split is two blocks, each followed by a rest day:
 * Push/Pull/Legs in any order, then Upper/Lower in either order.
 * Within a block, unfinished days are suggested in this canonical order.
 */
export const BLOCKS: readonly (readonly TrainingDayType[])[] = [
  ["push", "pull", "legs"],
  ["upper", "lower"],
];

/** Canonical walk through both blocks (used to generate demo history). */
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
  maxConsecutive?: number;
}

interface State {
  block: number;
  done: TrainingDayType[];
  pendingRest: boolean;
  prev: DayType | null;
  consecutive: number;
}

const BLOCK_NAME = ["Push/Pull/Legs", "Upper/Lower"];

function isTraining(t: DayType | null): t is TrainingDayType {
  return t !== null && t !== "rest";
}

function blockOf(t: TrainingDayType): number {
  return BLOCKS.findIndex((b) => b.includes(t));
}

export function conflicts(a: DayType | null, b: DayType | null): boolean {
  if (!isTraining(a) || !isTraining(b)) return false;
  if (a === b) return true;
  const ga = DAY_GROUPS[a];
  return DAY_GROUPS[b].some((g) => ga.includes(g));
}

function applyDay(state: State, type: DayType | "off"): State {
  if (type === "off" || type === "rest") {
    // Any non-training day satisfies a pending rest; owed training days stay owed.
    return { ...state, pendingRest: false, prev: "rest", consecutive: 0 };
  }
  const b = blockOf(type);
  // Training from the other block starts that block fresh; leftovers of the old one are dropped.
  let done = b === state.block ? [...new Set([...state.done, type])] : [type];
  let block = b;
  let pendingRest = false;
  if (BLOCKS[b].every((t) => done.includes(t))) {
    block = (b + 1) % BLOCKS.length;
    done = [];
    pendingRest = true;
  }
  return { block, done, pendingRest, prev: type, consecutive: state.consecutive + 1 };
}

/**
 * Suggest day types for every unplanned date in [today, until].
 *
 * Rules, in priority order:
 * 1. Logged/planned days are fixed; suggestions continue from what you actually did.
 * 2. Push/Pull/Legs is one block and Upper/Lower another; days inside a block can come in any order.
 *    Finishing a block earns a rest day, then the other block starts.
 * 3. A missed or skipped day counts as rest: it clears a pending rest, but owed block days stay owed.
 * 4. Never more than `maxConsecutive` training days in a row (including fixed future days).
 * 5. Never the same major muscle group on consecutive days (including a fixed tomorrow).
 */
export function suggestPlan(input: PlannerInput): Suggestion[] {
  const max = input.maxConsecutive ?? DEFAULT_MAX_CONSECUTIVE;
  const byDate = new Map<string, DayLog>();
  for (const log of input.logs) byDate.set(log.date, log);

  const sorted = [...input.logs].sort((a, b) => compareDates(a.date, b.date));
  let state: State = { block: 0, done: [], pendingRest: false, prev: null, consecutive: 0 };

  if (sorted.length && compareDates(sorted[0].date, input.today) < 0) {
    for (let d = sorted[0].date; compareDates(d, input.today) < 0; d = addDays(d, 1)) {
      const log = byDate.get(d);
      const happened = log && log.status !== "skipped";
      state = applyDay(state, happened ? log.dayType : "off");
    }
  }

  const out: Suggestion[] = [];
  for (let d = input.today; compareDates(d, input.until) <= 0; d = addDays(d, 1)) {
    const fixed = byDate.get(d);
    if (fixed) {
      state = applyDay(state, fixed.status === "skipped" ? "off" : fixed.dayType);
      continue;
    }
    const pick = choose(state, max, fixedTrainingAhead(byDate, d));
    out.push({ date: d, dayType: pick.dayType, reason: pick.reason });
    state = applyDay(state, pick.dayType);
  }
  return out;
}

interface Ahead {
  nextType: DayType | null;
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

function choose(state: State, max: number, ahead: Ahead): { dayType: DayType; reason: string } {
  if (state.consecutive >= max) return { dayType: "rest", reason: `${max} training days in a row. Recover today.` };
  if (state.consecutive + 1 + ahead.run > max) return { dayType: "rest", reason: "Rest now so the planned days ahead don't stack up." };
  if (state.pendingRest)
    return {
      dayType: "rest",
      reason: `${BLOCK_NAME[(state.block + BLOCKS.length - 1) % BLOCKS.length]} done. Recover before the next block.`,
    };

  const ok = (t: DayType) => !conflicts(state.prev, t) && !conflicts(t, ahead.nextType);
  const remaining = BLOCKS[state.block].filter((t) => !state.done.includes(t));
  const pick = remaining.find(ok);
  if (pick) {
    const left = remaining.filter((t) => t !== pick).map((t) => DAY_LABEL[t]);
    const reason = state.done.length
      ? left.length
        ? `Next in your ${BLOCK_NAME[state.block]} block. ${left.join(" and ")} still to go.`
        : `Finishes your ${BLOCK_NAME[state.block]} block.`
      : `Starts your ${BLOCK_NAME[state.block]} block. Any order works.`;
    return { dayType: pick, reason };
  }
  return { dayType: "rest", reason: "Everything left in this block overlaps the muscles next to it." };
}
