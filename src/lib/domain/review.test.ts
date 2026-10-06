import { describe, expect, it } from "vitest";
import { EXERCISE_BY_ID } from "./catalog";
import { addDays } from "./dates";
import { weekStreak, weeklyReview } from "./review";
import type { DayLog, Session } from "./types";

const session = (date: string, exerciseId: string, sets: number): Session => ({
  id: `${date}-${exerciseId}`,
  date,
  dayType: "push",
  startedAt: 0,
  status: "done",
  exerciseIds: [exerciseId],
  entries: [
    {
      id: "e",
      exerciseId,
      repMin: 8,
      repMax: 8,
      done: true,
      sets: Array.from({ length: sets }, (_, i) => ({
        id: `s${i}`,
        kind: "working" as const,
        weight: 50,
        unit: "kg" as const,
        reps: 8,
        done: true,
      })),
    },
  ],
});

describe("weeklyReview", () => {
  it("flags a push-heavy week", () => {
    const r = weeklyReview([session("2026-10-05", "chest-press", 9), session("2026-10-06", "face-pull", 3)], EXERCISE_BY_ID);
    expect(r.trainingDays).toBe(2);
    expect(r.notes.join(" ")).toMatch(/Pushing/);
  });

  it("flags quad dominance and missing hamstrings", () => {
    const r = weeklyReview([session("2026-10-07", "leg-extension", 6)], EXERCISE_BY_ID);
    expect(r.notes.join(" ")).toMatch(/No hamstring/);
  });
});

describe("weekStreak", () => {
  const days = (start: string, n: number): DayLog[] =>
    Array.from({ length: n }, (_, i) => ({ date: addDays(start, i), dayType: "push", status: "done" }));

  it("counts consecutive weeks with ≥4 training days", () => {
    const logs = [...days("2026-09-21", 4), ...days("2026-09-28", 5)];
    expect(weekStreak(logs, "2026-10-07")).toBe(2);
  });

  it("includes the current week once it qualifies", () => {
    const logs = [...days("2026-09-28", 4), ...days("2026-10-05", 4)];
    expect(weekStreak(logs, "2026-10-09")).toBe(2);
  });

  it("breaks on a light week", () => {
    const logs = [...days("2026-09-21", 4), ...days("2026-09-28", 2)];
    expect(weekStreak(logs, "2026-10-07")).toBe(0);
  });
});
