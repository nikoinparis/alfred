import Dexie, { type EntityTable } from "dexie";
import type { DayLog, DayTemplate, Exercise, Muscle, Session, Unit } from "@/lib/domain/types";
import type { GoalSettings, MacroTargets, Profile } from "@/lib/domain/nutrition";

export interface Settings {
  id: "app";
  unit: Unit;
  maxConsecutive: number;
  profile: Profile | null;
  goal: GoalSettings | null;
  /** Manual macro targets; when null, targets come from the goal engine. */
  macroOverride: MacroTargets | null;
  /** Calorie tweak applied by accepted weekly check-ins. */
  kcalAdjustment: number;
  lastCheckIn?: string;
  /** When the last JSON backup was exported (ms). */
  lastBackupAt?: number;
  /** "Remind me later" on the backup nudge (ms). */
  backupSnoozeUntil?: number;
  /** "2d" | "3d" body view preference. */
  bodyView: "2d" | "3d";
}

export interface MuscleTarget {
  muscle: Muscle;
  sets: number;
}

export interface Food {
  id: string;
  name: string;
  serving: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  favorite: boolean;
  tags?: string[];
  lastUsed?: number;
}

export interface SavedMeal {
  id: string;
  name: string;
  items: { foodId: string; servings: number }[];
  lastUsed?: number;
}

export type FoodSource = "manual" | "food" | "meal" | "photo" | "ai";

export interface FoodLog {
  id: string;
  date: string;
  createdAt: number;
  name: string;
  servings: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  source: FoodSource;
  foodId?: string;
  mealId?: string;
  /** Photo estimates: 0–1 confidence and a kcal range. */
  confidence?: number;
  kcalRange?: [number, number];
}

export interface Bodyweight {
  date: string;
  kg: number;
}

export class AlfredDB extends Dexie {
  settings!: EntityTable<Settings, "id">;
  exercises!: EntityTable<Exercise, "id">;
  templates!: EntityTable<DayTemplate, "dayType">;
  sessions!: EntityTable<Session, "id">;
  dayLogs!: EntityTable<DayLog, "date">;
  muscleTargets!: EntityTable<MuscleTarget, "muscle">;
  foods!: EntityTable<Food, "id">;
  meals!: EntityTable<SavedMeal, "id">;
  foodLogs!: EntityTable<FoodLog, "id">;
  bodyweights!: EntityTable<Bodyweight, "date">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      settings: "id",
      exercises: "id, name",
      templates: "dayType",
      sessions: "id, date, status, *exerciseIds",
      dayLogs: "date",
      muscleTargets: "muscle",
      foods: "id, name, favorite, lastUsed",
      meals: "id, name, lastUsed",
      foodLogs: "id, date, createdAt",
      bodyweights: "date",
    });
    // v2: booleans can't be IndexedDB keys, so the favourite index never worked.
    this.version(2).stores({ foods: "id, name, lastUsed" });
  }
}

export const TABLES = [
  "settings",
  "exercises",
  "templates",
  "sessions",
  "dayLogs",
  "muscleTargets",
  "foods",
  "meals",
  "foodLogs",
  "bodyweights",
] as const;
export type TableName = (typeof TABLES)[number];

export const DEFAULT_SETTINGS: Settings = {
  id: "app",
  unit: "kg",
  maxConsecutive: 3,
  profile: null,
  goal: null,
  macroOverride: null,
  kcalAdjustment: 0,
  bodyView: "2d",
};
