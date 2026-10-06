import { describe, expect, it } from "vitest";
import { EXERCISE_BY_ID } from "./catalog";
import {
  detectPRs,
  effectiveLoadKg,
  estimate1RM,
  exerciseHistory,
  plateLoad,
  suggestOverload,
  warmupRamp,
  type HistoryPoint,
} from "./progression";
import type { Session, SetLog, Unit } from "./types";

const press = EXERCISE_BY_ID["chest-press"];
const squat = EXERCISE_BY_ID["squat"];
const assisted = EXERCISE_BY_ID["assisted-pullup"];

let id = 0;
const s = (weight: number, reps: number, over: Partial<SetLog> = {}, unit: Unit = "kg"): SetLog => ({
  id: `set${++id}`,
  kind: "working",
  weight,
  unit,
  reps,
  done: true,
  ...over,
});

function sessionsFor(exerciseId: string, days: SetLog[][]): Session[] {
  return days.map((sets, i) => ({
    id: `sess${i}`,
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    dayType: "push",
    startedAt: i,
    status: "done",
    exerciseIds: [exerciseId],
    entries: [{ id: `e${i}`, exerciseId, repMin: 8, repMax: 8, sets, done: true }],
  }));
}

const hist = (exerciseId: string, days: SetLog[][], bw: number | null = null): HistoryPoint[] =>
  exerciseHistory(sessionsFor(exerciseId, days), EXERCISE_BY_ID[exerciseId], bw);

describe("estimate1RM", () => {
  it("uses Epley and returns the weight itself for singles", () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 1);
    expect(estimate1RM(0, 5)).toBe(0);
  });
});

describe("effectiveLoadKg", () => {
  it("subtracts assistance from bodyweight", () => {
    expect(effectiveLoadKg(s(11.5, 8), assisted, 75)).toBeCloseTo(63.5);
    expect(effectiveLoadKg(s(11.5, 8), assisted, null)).toBeNull();
  });
  it("converts lb sets to kg", () => {
    expect(effectiveLoadKg(s(160, 8, {}, "lb"), press, null)).toBeCloseTo(72.57, 1);
  });
});

describe("suggestOverload", () => {
  const base = {
    exercise: press,
    repMin: 8,
    repMax: 8,
    plannedSets: 3,
    target: { value: 72.5, unit: "kg" as Unit },
    unit: "kg" as Unit,
    bodyweightKg: null,
  };

  it("starts from the template weight with no history", () => {
    const r = suggestOverload({ ...base, history: [] });
    expect(r).toMatchObject({ action: "start", weight: 72.5 });
  });

  it("adds one increment after hitting 3×8 (the 160 → 165 lb example)", () => {
    const r = suggestOverload({
      ...base,
      unit: "lb",
      history: hist("chest-press", [[s(160, 8, {}, "lb"), s(160, 8, {}, "lb"), s(160, 8, {}, "lb")]]),
    });
    expect(r.action).toBe("increase");
    expect(r.weight).toBe(170); // DB total increment: 2 kg/hand ≈ 10 lb total
    expect(r.reason).toMatch(/3×8 at 160 lb/);
  });

  it("uses the top set and ignores drop sets when checking reps", () => {
    const top = s(72.5, 8);
    const r = suggestOverload({
      ...base,
      history: hist("chest-press", [[top, s(72.5, 8), s(72.5, 8), s(60, 10, { kind: "drop", parentId: top.id })]]),
    });
    expect(r.action).toBe("increase");
    expect(r.weight).toBe(76.5);
  });

  it("holds when a set fell short and targets one more rep", () => {
    const r = suggestOverload({ ...base, history: hist("chest-press", [[s(72.5, 8), s(72.5, 7), s(72.5, 6)]]) });
    expect(r).toMatchObject({ action: "hold", weight: 72.5, reps: 8 });
  });

  it("holds when the top was hit at RPE 10", () => {
    const r = suggestOverload({
      ...base,
      history: hist("chest-press", [[s(72.5, 8, { rpe: 10 }), s(72.5, 8, { rpe: 10 }), s(72.5, 8, { rpe: 9.5 })]]),
    });
    expect(r.action).toBe("hold");
  });

  it("does not increase when fewer sets than planned were done", () => {
    const r = suggestOverload({ ...base, history: hist("chest-press", [[s(72.5, 8), s(72.5, 8)]]) });
    expect(r.action).toBe("hold");
  });

  it("holds (doesn't step back) when only one rep short", () => {
    const day = () => [s(80, 8), s(80, 8), s(80, 7)];
    const r = suggestOverload({ ...base, history: hist("chest-press", [day(), day()]) });
    expect(r.action).toBe("hold");
  });

  it("steps back after two sessions well under the rep floor at the same weight", () => {
    const day = () => [s(80, 6), s(80, 5), s(80, 5)];
    const r = suggestOverload({ ...base, history: hist("chest-press", [day(), day()]) });
    expect(r).toMatchObject({ action: "reduce", weight: 76 });
  });

  it("suggests a deload after three sessions without e1RM progress", () => {
    const day = () => [s(80, 7), s(80, 7), s(80, 6)];
    const r = suggestOverload({ ...base, history: hist("chest-press", [day(), day(), day(), day()]) });
    expect(r.action).toBe("deload");
    expect(r.weight).toBe(72);
  });

  it("reduces assistance for assisted pull-ups", () => {
    const r = suggestOverload({
      ...base,
      exercise: assisted,
      target: null,
      bodyweightKg: 75,
      history: hist("assisted-pullup", [[s(11.5, 8), s(11.5, 8), s(11.5, 8)]], 75),
    });
    expect(r.action).toBe("increase");
    expect(r.weight).toBe(6.5);
  });
});

describe("detectPRs", () => {
  it("flags e1RM, top weight and volume PRs against earlier sessions only", () => {
    const previous = hist("squat", [[s(75, 8), s(75, 8), s(75, 8)]]);
    const entry = { id: "new", exerciseId: "squat", repMin: 8, repMax: 8, done: true, sets: [s(77.5, 8), s(77.5, 8), s(77.5, 8)] };
    const kinds = detectPRs(entry, previous, squat, null).map((p) => p.kind);
    expect(kinds).toEqual(["e1rm", "weight", "volume"]);
  });

  it("returns nothing for a first-ever session", () => {
    const entry = { id: "new", exerciseId: "squat", repMin: 8, repMax: 8, done: true, sets: [s(100, 5)] };
    expect(detectPRs(entry, [], squat, null)).toEqual([]);
  });
});

describe("warmupRamp", () => {
  it("ramps a barbell squat from the empty bar", () => {
    expect(warmupRamp(75, "kg", "barbell", 2.5)).toEqual([
      { weight: 20, reps: 10 },
      { weight: 30, reps: 8 },
      { weight: 45, reps: 5 },
      { weight: 60, reps: 3 },
    ]);
  });
  it("skips steps that would be at or under the bar", () => {
    expect(warmupRamp(40, "kg", "barbell", 2.5).every((w) => w.weight > 20 || w.reps === 10)).toBe(true);
  });
});

describe("plateLoad", () => {
  it("loads 100 kg as 25+15 per side on a 20 kg bar", () => {
    expect(plateLoad(100, "kg")).toEqual({ perSide: [25, 15], bar: 20, achieved: 100, remainder: 0 });
  });
  it("loads 225 lb as two 45s per side", () => {
    expect(plateLoad(225, "lb").perSide).toEqual([45, 45]);
  });
  it("reports what can't be loaded", () => {
    const r = plateLoad(101, "kg");
    expect(r.achieved).toBe(100);
    expect(r.remainder).toBe(1);
  });
});
