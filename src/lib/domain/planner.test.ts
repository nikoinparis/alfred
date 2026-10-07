import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { conflicts, suggestPlan } from "./planner";
import type { DayLog, DayType } from "./types";

// 2026-10-05 is a Monday.
const MON = "2026-10-05";
const day = (n: number) => addDays(MON, n);
const SUN = day(6);

const done = (date: string, dayType: DayType): DayLog => ({ date, dayType, status: "done" });
const types = (s: { dayType: DayType }[]) => s.map((x) => x.dayType);
const week = (today: string, logs: DayLog[] = []) => types(suggestPlan({ today, until: SUN, logs }));

describe("suggestPlan: the ideal week", () => {
  it("plans Push, Pull, Legs, rest, Upper, Lower, rest from Monday", () => {
    expect(week(MON)).toEqual(["push", "pull", "legs", "rest", "upper", "lower", "rest"]);
  });

  it("starts every new week fresh on Monday", () => {
    const plan = suggestPlan({ today: MON, until: addDays(SUN, 7), logs: [] });
    expect(types(plan.slice(7))).toEqual(["push", "pull", "legs", "rest", "upper", "lower", "rest"]);
  });
});

describe("suggestPlan: pairs", () => {
  it("Legs first means Push then Pull next", () => {
    expect(week(day(1), [done(MON, "legs")])).toEqual(["push", "pull", "rest", "upper", "lower", "rest"]);
  });

  it("Push today means Pull tomorrow, then Legs", () => {
    expect(week(day(1), [done(MON, "push")]).slice(0, 2)).toEqual(["pull", "legs"]);
  });

  it("Upper first means Lower next, then rest, then Push/Pull/Legs", () => {
    expect(week(day(1), [done(MON, "upper")])).toEqual(["lower", "rest", "push", "pull", "legs", "rest"]);
  });

  it("Lower first means Upper next", () => {
    expect(week(day(1), [done(MON, "lower")])[0]).toBe("upper");
  });
});

describe("suggestPlan: fitting a short week", () => {
  it("starting Thursday fits Push, Pull, Legs and rests Sunday", () => {
    expect(week(day(3))).toEqual(["push", "pull", "legs", "rest"]);
  });

  it("starting Wednesday fits Push/Pull/Legs plus Upper (Upper beats Lower)", () => {
    expect(week(day(2))).toEqual(["push", "pull", "legs", "rest", "upper"]);
  });

  it("starting Tuesday still fits the whole week", () => {
    expect(week(day(1))).toEqual(["push", "pull", "legs", "rest", "upper", "lower"]);
  });
});

describe("suggestPlan: real life", () => {
  it("a missed day doesn't drop the owed session", () => {
    // Push Monday, nothing Tuesday: Pull is still next on Wednesday.
    expect(week(day(2), [done(MON, "push")])[0]).toBe("pull");
  });

  it("works around a fixed planned day", () => {
    const logs: DayLog[] = [{ date: day(4), dayType: "upper", status: "planned" }];
    const plan = suggestPlan({ today: MON, until: SUN, logs });
    expect(plan.find((s) => s.date === day(4))).toBeUndefined();
    expect(types(plan)).toEqual(["push", "pull", "legs", "rest", "lower", "rest"]);
  });

  it("never more than three training days in a row, and never overlapping neighbours", () => {
    const plan = suggestPlan({ today: MON, until: addDays(MON, 41), logs: [] });
    let run = 0;
    plan.forEach((s, i) => {
      run = s.dayType === "rest" ? 0 : run + 1;
      expect(run).toBeLessThanOrEqual(3);
      if (i > 0) expect(conflicts(plan[i - 1].dayType, s.dayType)).toBe(false);
    });
  });

  it("explains each day", () => {
    const plan = suggestPlan({ today: MON, until: SUN, logs: [] });
    expect(plan[0].reason).toMatch(/Pull tomorrow/);
    expect(plan[3].reason).toMatch(/between/);
    expect(plan[6].reason).toMatch(/Monday/);
  });
});

describe("conflicts", () => {
  it("flags shared major groups", () => {
    expect(conflicts("push", "upper")).toBe(true);
    expect(conflicts("legs", "lower")).toBe(true);
    expect(conflicts("push", "pull")).toBe(false);
    expect(conflicts("rest", "push")).toBe(false);
  });
});
