import { describe, expect, it } from "vitest";
import { conflicts, suggestPlan } from "./planner";
import type { DayLog, DayType } from "./types";

// 2026-10-05 is a Monday.
const MON = "2026-10-05";
const SUN = "2026-10-11";

const done = (date: string, dayType: DayType): DayLog => ({ date, dayType, status: "done" });
const types = (s: { dayType: DayType }[]) => s.map((x) => x.dayType);

describe("suggestPlan", () => {
  it("starts at Push with an empty history", () => {
    const plan = suggestPlan({ today: MON, until: SUN, logs: [] });
    expect(types(plan)).toEqual(["push", "pull", "legs", "rest", "upper", "lower", "rest"]);
  });

  it("continues from wherever the week actually started (Upper example from the brief)", () => {
    const plan = suggestPlan({ today: "2026-10-06", until: "2026-10-12", logs: [done(MON, "upper")] });
    expect(types(plan)).toEqual(["lower", "rest", "push", "pull", "legs", "rest", "upper"]);
  });

  it("does not suggest anything for days already logged or planned", () => {
    const logs = [done(MON, "push"), { date: "2026-10-07", dayType: "legs", status: "planned" } as DayLog];
    const plan = suggestPlan({ today: "2026-10-06", until: SUN, logs });
    expect(plan.map((s) => s.date)).not.toContain("2026-10-07");
    expect(plan[0]).toMatchObject({ date: "2026-10-06" });
  });

  it("resumes the owed day after a missed day instead of skipping it", () => {
    // Mon Push, Tue missed → Wed should still be Pull.
    const plan = suggestPlan({ today: "2026-10-07", until: SUN, logs: [done(MON, "push")] });
    expect(plan[0].dayType).toBe("pull");
  });

  it("treats an explicitly skipped day like a missed day", () => {
    const logs: DayLog[] = [done(MON, "push"), { date: "2026-10-06", dayType: "pull", status: "skipped" }];
    const plan = suggestPlan({ today: "2026-10-07", until: SUN, logs });
    expect(plan[0].dayType).toBe("pull");
  });

  it("a missed day fills a pending rest slot", () => {
    // Push, Pull, Legs, then Thu missed → Fri goes straight to Upper.
    const logs = [done(MON, "push"), done("2026-10-06", "pull"), done("2026-10-07", "legs")];
    const plan = suggestPlan({ today: "2026-10-09", until: SUN, logs });
    expect(types(plan)).toEqual(["upper", "lower", "rest"]);
  });

  it("forces rest after three consecutive training days even if the user overrode the rest day", () => {
    const logs = [done(MON, "push"), done("2026-10-06", "pull"), done("2026-10-07", "legs"), done("2026-10-08", "upper")];
    const plan = suggestPlan({ today: "2026-10-09", until: SUN, logs });
    expect(plan[0].dayType).toBe("rest");
    expect(plan[0].reason).toMatch(/in a row/);
  });

  it("never produces more than three training days in a row", () => {
    const plan = suggestPlan({ today: MON, until: "2026-11-30", logs: [] });
    let run = 0;
    for (const s of plan) {
      run = s.dayType === "rest" ? 0 : run + 1;
      expect(run).toBeLessThanOrEqual(3);
    }
  });

  it("never suggests overlapping muscle groups on consecutive days", () => {
    const plan = suggestPlan({ today: MON, until: "2026-11-30", logs: [] });
    for (let i = 1; i < plan.length; i++) {
      expect(conflicts(plan[i - 1].dayType, plan[i].dayType)).toBe(false);
    }
  });

  it("respects a fixed future day: rests before a planned run would exceed the cap", () => {
    // Mon Push done; Wed, Thu planned training. Tue training would make 4 in a row.
    const logs: DayLog[] = [
      done(MON, "push"),
      { date: "2026-10-07", dayType: "legs", status: "planned" },
      { date: "2026-10-08", dayType: "upper", status: "planned" },
    ];
    const plan = suggestPlan({ today: "2026-10-06", until: "2026-10-06", logs });
    expect(plan[0].dayType).toBe("rest");
  });

  it("avoids a conflict with a fixed next day by jumping ahead in the cycle", () => {
    // Today's cycle pick is Pull, but tomorrow is planned Upper (shares pull muscles).
    const logs: DayLog[] = [done(MON, "push"), { date: "2026-10-07", dayType: "upper", status: "planned" }];
    const plan = suggestPlan({ today: "2026-10-06", until: "2026-10-06", logs });
    expect(plan[0].dayType).toBe("legs");
    expect(plan[0].reason).toMatch(/jumps to Legs/);
  });

  it("re-plans after a swap: doing Lower on a Legs day keeps the cycle moving", () => {
    const logs = [done(MON, "push"), done("2026-10-06", "pull"), done("2026-10-07", "lower")];
    const plan = suggestPlan({ today: "2026-10-08", until: SUN, logs });
    expect(types(plan)).toEqual(["rest", "push", "pull", "legs"]);
  });
});

describe("conflicts", () => {
  it("flags shared major groups", () => {
    expect(conflicts("push", "upper")).toBe(true);
    expect(conflicts("legs", "lower")).toBe(true);
    expect(conflicts("push", "push")).toBe(true);
    expect(conflicts("push", "pull")).toBe(false);
    expect(conflicts("rest", "push")).toBe(false);
  });
});
