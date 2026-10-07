import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { backupDue, exportBackup, exportSetsCsv, importBackup, parseBackup } from "./backup";
import { AlfredDB } from "./schema";
import { seedDemo } from "./seed";

describe("backup round-trip", () => {
  it("exports, parses and re-imports every table", async () => {
    const a = new AlfredDB("backup-a");
    await seedDemo(a, "2026-10-07");
    const backup = await exportBackup(a);
    const text = JSON.stringify(backup);

    const b = new AlfredDB("backup-b");
    await importBackup(b, parseBackup(text));
    expect(await b.sessions.count()).toBe(await a.sessions.count());
    expect(await b.foodLogs.count()).toBe(await a.foodLogs.count());
    expect((await b.settings.get("app"))?.unit).toBe("kg");
  });

  it("rejects files that aren't Alfred backups", () => {
    expect(() => parseBackup("{}")).toThrow(/isn't an Alfred backup/);
    expect(() => parseBackup("nope")).toThrow(/valid JSON/);
  });

  it("writes a CSV row per set", async () => {
    const db = new AlfredDB("backup-csv");
    await seedDemo(db, "2026-10-07");
    const csv = await exportSetsCsv(db);
    const [header, first] = csv.split("\n");
    expect(header).toBe("date,day,exercise,set,kind,weight,unit,reps,rpe,done");
    expect(first.split(",").length).toBeGreaterThanOrEqual(10);
  });
});

describe("demo seed", () => {
  it("produces ~8 weeks of plausible training that respects the cycle", async () => {
    const db = new AlfredDB("demo-check");
    await seedDemo(db, "2026-10-07");
    const sessions = await db.sessions.toArray();
    expect(sessions.length).toBeGreaterThan(25);
    expect(sessions.every((s) => s.date < "2026-10-07")).toBe(true);
    expect(await db.bodyweights.count()).toBeGreaterThan(40);
  });
});

describe("demo seed idempotency", () => {
  it("seeding twice doesn't duplicate anything", async () => {
    const db = new AlfredDB("demo-twice");
    await seedDemo(db, "2026-10-07");
    const n = await db.sessions.count();
    const f = await db.foodLogs.count();
    await seedDemo(db, "2026-10-07");
    expect(await db.sessions.count()).toBe(n);
    expect(await db.foodLogs.count()).toBe(f);
  });
});

describe("backupDue", () => {
  const day = 86_400_000;
  const now = 100 * day;
  it("waits until there's something worth backing up", () => {
    expect(backupDue({ sessions: 1, now })).toBe(false);
    expect(backupDue({ sessions: 3, now })).toBe(true);
  });
  it("nudges weekly and respects snooze", () => {
    expect(backupDue({ sessions: 9, lastBackupAt: now - 3 * day, now })).toBe(false);
    expect(backupDue({ sessions: 9, lastBackupAt: now - 8 * day, now })).toBe(true);
    expect(backupDue({ sessions: 9, lastBackupAt: now - 8 * day, snoozeUntil: now + day, now })).toBe(false);
  });
});

describe("owner defaults", () => {
  it("fills profile, goal and a first weigh-in without overwriting", async () => {
    const { ensureOwnerDefaults, seedBase } = await import("./seed");
    const db = new AlfredDB("owner-defaults");
    await seedBase(db);
    await ensureOwnerDefaults(db, "2026-10-07");
    const s = (await db.settings.get("app"))!;
    expect(s.profile).toMatchObject({ heightCm: 179, weightKg: 64.6, age: 22 });
    expect(s.goal).toMatchObject({ preset: "nightwing", targetWeightKg: 72 });
    expect(await db.bodyweights.get("2026-10-07")).toMatchObject({ kg: 64.6 });
    await db.settings.put({ ...s, profile: { ...s.profile!, age: 30 } });
    await ensureOwnerDefaults(db, "2026-10-08");
    expect((await db.settings.get("app"))!.profile!.age).toBe(30);
    expect(await db.bodyweights.count()).toBe(1);
  });
});
