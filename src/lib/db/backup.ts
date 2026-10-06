import { z } from "zod";
import { EXERCISE_BY_ID } from "@/lib/domain/catalog";
import { TABLES, type AlfredDB, type TableName } from "./schema";

export const BACKUP_FORMAT = "alfred-backup";
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Partial<Record<TableName, unknown[]>>;
}

export async function exportBackup(db: AlfredDB): Promise<Backup> {
  const data: Backup["data"] = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

const BackupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().max(BACKUP_VERSION),
  exportedAt: z.string(),
  data: z.record(z.string(), z.array(z.unknown())),
});

export function parseBackup(text: string): Backup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const parsed = BackupSchema.safeParse(json);
  if (!parsed.success) throw new Error("That file isn't an Alfred backup.");
  return parsed.data as Backup;
}

/** Replaces every table with the backup's contents. */
export async function importBackup(db: AlfredDB, backup: Backup) {
  await db.transaction("rw", TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const rows = backup.data[t];
      if (!rows) continue;
      await db.table(t).clear();
      await db.table(t).bulkPut(rows);
    }
  });
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

export async function exportSetsCsv(db: AlfredDB): Promise<string> {
  const sessions = await db.sessions.orderBy("date").toArray();
  const exercises = Object.fromEntries((await db.exercises.toArray()).map((e) => [e.id, e]));
  const rows: unknown[][] = [];
  for (const s of sessions) {
    for (const e of s.entries) {
      e.sets.forEach((set, i) => {
        rows.push([
          s.date,
          s.dayType,
          exercises[e.exerciseId]?.name ?? EXERCISE_BY_ID[e.exerciseId]?.name ?? e.exerciseId,
          i + 1,
          set.kind,
          set.weight,
          set.unit,
          set.reps,
          set.rpe ?? "",
          set.done ? "yes" : "no",
        ]);
      });
    }
  }
  return toCsv(["date", "day", "exercise", "set", "kind", "weight", "unit", "reps", "rpe", "done"], rows);
}

export async function exportFoodCsv(db: AlfredDB): Promise<string> {
  const logs = await db.foodLogs.orderBy("createdAt").toArray();
  return toCsv(
    ["date", "name", "servings", "kcal", "protein_g", "carbs_g", "fat_g", "source"],
    logs.map((l) => [l.date, l.name, l.servings, l.kcal, l.protein, l.carbs, l.fat, l.source]),
  );
}

export function downloadText(filename: string, text: string, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
