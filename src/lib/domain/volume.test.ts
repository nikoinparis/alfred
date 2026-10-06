import { describe, expect, it } from "vitest";
import { EXERCISE_BY_ID, EXERCISES } from "./catalog";
import { hardSetValue, remainingFor, volumeStatus, weeklyMuscleVolume } from "./volume";
import type { SetLog, Session } from "./types";

const set = (over: Partial<SetLog> = {}): SetLog => ({
  id: Math.random().toString(36),
  kind: "working",
  weight: 50,
  unit: "kg",
  reps: 8,
  done: true,
  ...over,
});

const session = (entries: { exerciseId: string; sets: SetLog[] }[]): Session => ({
  id: "s",
  date: "2026-10-05",
  dayType: "push",
  startedAt: 0,
  status: "done",
  exerciseIds: entries.map((e) => e.exerciseId),
  entries: entries.map((e, i) => ({ id: `e${i}`, repMin: 8, repMax: 8, done: true, ...e })),
});

describe("hardSetValue", () => {
  it("counts working and failure sets as 1, drops as 0.5, warm-ups and undone sets as 0", () => {
    expect(hardSetValue(set())).toBe(1);
    expect(hardSetValue(set({ kind: "failure" }))).toBe(1);
    expect(hardSetValue(set({ kind: "drop" }))).toBe(0.5);
    expect(hardSetValue(set({ kind: "warmup" }))).toBe(0);
    expect(hardSetValue(set({ done: false }))).toBe(0);
    expect(hardSetValue(set({ reps: 0 }))).toBe(0);
  });
});

describe("weeklyMuscleVolume", () => {
  it("credits primary muscles 1 and secondary muscles 0.5 per hard set", () => {
    const v = weeklyMuscleVolume([session([{ exerciseId: "chest-press", sets: [set(), set(), set()] }])], EXERCISE_BY_ID);
    expect(v.chest.sets).toBe(3);
    expect(v.triceps.sets).toBe(1.5);
    expect(v.frontDelts.sets).toBe(1.5);
    expect(v.quads.sets).toBe(0);
  });

  it("sums across sessions and merges contributions per exercise", () => {
    const s1 = session([{ exerciseId: "chest-press", sets: [set(), set()] }]);
    const s2 = session([
      { exerciseId: "chest-press", sets: [set()] },
      { exerciseId: "incline-cable-fly", sets: [set(), set(), set()] },
    ]);
    const v = weeklyMuscleVolume([s1, s2], EXERCISE_BY_ID);
    expect(v.chest.sets).toBe(6);
    expect(v.chest.contributions).toEqual([
      { exerciseId: "chest-press", sets: 3, role: "primary" },
      { exerciseId: "incline-cable-fly", sets: 3, role: "primary" },
    ]);
  });

  it("counts a 160 → 130 → 100 drop chain as 1 + 0.5 + 0.5", () => {
    const top = set({ weight: 72.5 });
    const v = weeklyMuscleVolume(
      [
        session([
          {
            exerciseId: "chest-press",
            sets: [top, set({ kind: "drop", parentId: top.id }), set({ kind: "drop", parentId: top.id })],
          },
        ]),
      ],
      EXERCISE_BY_ID,
    );
    expect(v.chest.sets).toBe(2);
  });

  it("ignores conditioning work and unknown exercises", () => {
    const v = weeklyMuscleVolume(
      [
        session([
          { exerciseId: "incline-walk", sets: [set()] },
          { exerciseId: "nope", sets: [set()] },
        ]),
      ],
      EXERCISE_BY_ID,
    );
    expect(Object.values(v).every((m) => m.sets === 0)).toBe(true);
  });
});

describe("volumeStatus", () => {
  it("maps sets to red/yellow/green buckets", () => {
    expect(volumeStatus(0, 10)).toBe("untrained");
    expect(volumeStatus(4.5, 10)).toBe("below");
    expect(volumeStatus(10, 10)).toBe("hit");
    expect(volumeStatus(12, 10)).toBe("hit");
  });
});

describe("remainingFor", () => {
  it("prefers exercises where the muscle is primary", () => {
    const r = remainingFor("triceps", 4, 10, EXERCISES);
    expect(r.remaining).toBe(6);
    expect(r.suggestions[0].setsNeeded).toBe(6);
    expect(EXERCISE_BY_ID[r.suggestions[0].exerciseId].primary).toContain("triceps");
  });

  it("returns nothing once the target is met", () => {
    expect(remainingFor("chest", 12, 10, EXERCISES)).toEqual({ remaining: 0, suggestions: [] });
  });
});
