import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { EXERCISE_BY_ID } from "@/lib/domain/catalog";
import { AlfredDB } from "./schema";
import { seedBase } from "./seed";
import { addSet, finishSession, prefillSets, startSession, swapExercise, updateSet } from "./workouts";

describe("prefillSets", () => {
  const press = EXERCISE_BY_ID["chest-press"];
  it("uses the template target with no history", () => {
    const sets = prefillSets(press, 3, 8, { value: 72.5, unit: "kg" }, [], "kg");
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([
      [72.5, 8],
      [72.5, 8],
      [72.5, 8],
    ]);
  });

  it("converts the target into lb for lb users", () => {
    const sets = prefillSets(press, 1, 8, { value: 72.5, unit: "kg" }, [], "lb");
    expect(sets[0].weight).toBe(160);
  });
});

describe("session lifecycle", () => {
  it("starts from the template, carries per-set weights into the next session, and logs drop sets", async () => {
    const db = new AlfredDB("lifecycle");
    await seedBase(db);
    const s1 = await startSession(db, "2026-10-05", "push");
    expect(s1.entries[0].exerciseId).toBe("chest-press");
    expect(s1.entries[0].sets[0].weight).toBe(72.5);

    const entry = s1.entries[0];
    await updateSet(db, s1.id, entry.id, entry.sets[0].id, { weight: 75, reps: 8, done: true });
    await updateSet(db, s1.id, entry.id, entry.sets[1].id, { weight: 72.5, reps: 8, done: true });
    await updateSet(db, s1.id, entry.id, entry.sets[2].id, { weight: 70, reps: 8, done: true });
    await addSet(db, s1.id, entry.id, "drop", "kg", 4);
    const after = (await db.sessions.get(s1.id))!;
    const drop = after.entries[0].sets[3];
    expect(drop.kind).toBe("drop");
    expect(drop.parentId).toBe(entry.sets[2].id);
    expect(drop.weight).toBe(56);
    await finishSession(db, s1.id);

    const s2 = await startSession(db, "2026-10-12", "push");
    expect(s2.entries[0].sets.map((s) => s.weight)).toEqual([75, 72.5, 70]);
    expect(await db.dayLogs.get("2026-10-12")).toMatchObject({ dayType: "push", status: "done" });
  });

  it("swaps an exercise for today and remembers what it replaced", async () => {
    const db = new AlfredDB("swap");
    await seedBase(db);
    const s = await startSession(db, "2026-10-06", "pull");
    const pulldown = s.entries.find((e) => e.exerciseId === "lat-pulldown")!;
    await swapExercise(db, s, pulldown.id, EXERCISE_BY_ID["assisted-pullup"], "kg");
    const after = (await db.sessions.get(s.id))!;
    const swapped = after.entries.find((e) => e.id === pulldown.id)!;
    expect(swapped.exerciseId).toBe("assisted-pullup");
    expect(swapped.swappedFromExerciseId).toBe("lat-pulldown");
    expect(after.exerciseIds).toContain("assisted-pullup");
  });
});
