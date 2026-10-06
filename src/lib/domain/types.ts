export const TRAINING_DAY_TYPES = ["push", "pull", "legs", "upper", "lower"] as const;
export type TrainingDayType = (typeof TRAINING_DAY_TYPES)[number];
export type DayType = TrainingDayType | "rest";

export type Unit = "kg" | "lb";

export const MUSCLES = [
  "chest",
  "frontDelts",
  "sideDelts",
  "rearDelts",
  "triceps",
  "biceps",
  "forearms",
  "upperBack",
  "lats",
  "lowerBack",
  "abs",
  "obliques",
  "glutes",
  "quads",
  "hamstrings",
  "adductors",
  "calves",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export type Equipment = "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight" | "other";

/**
 * How the logged weight relates to the load being moved.
 * - total: the number is the full load (e.g. both dumbbells combined, barbell incl. bar)
 * - assisted: the number is assistance subtracted from bodyweight (assisted pull-up)
 * - bodyweight: no external load; weight field is optional added load
 */
export type LoadMode = "total" | "assisted" | "bodyweight";

export interface Exercise {
  id: string;
  name: string;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: Equipment;
  loadMode: LoadMode;
  /** Smallest sensible jump, in kg. Converted for lb users. */
  incrementKg: number;
  /** Generate warm-up ramps for this lift. */
  compound: boolean;
  /** Cardio / mobility work: no sets/weight, just done or not. */
  isConditioning?: boolean;
  /** Reps are per leg / per side. */
  perSide?: boolean;
  archived?: boolean;
}

export interface Weight {
  value: number;
  unit: Unit;
}

export interface TemplateSlot {
  id: string;
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  target: Weight | null;
  /** Exercises offered in "swap for today". */
  alternates: string[];
  note?: string;
}

export interface DayTemplate {
  dayType: DayType;
  name: string;
  slots: TemplateSlot[];
}

export type SetKind = "warmup" | "working" | "drop" | "failure";

export interface SetLog {
  id: string;
  kind: SetKind;
  weight: number | null;
  unit: Unit;
  reps: number | null;
  rpe?: number | null;
  done: boolean;
  /** For drop sets: the set this drop continues from. */
  parentId?: string;
  completedAt?: number;
}

export interface SessionEntry {
  id: string;
  slotId?: string;
  exerciseId: string;
  swappedFromExerciseId?: string;
  repMin: number;
  repMax: number;
  sets: SetLog[];
  done: boolean;
  note?: string;
}

export interface Session {
  id: string;
  /** Local date, YYYY-MM-DD. */
  date: string;
  dayType: DayType;
  startedAt: number;
  finishedAt?: number;
  status: "active" | "done";
  entries: SessionEntry[];
  /** Multi-entry index helper. */
  exerciseIds: string[];
  notes?: string;
}

export type DayStatus = "done" | "planned" | "skipped";

/** One row per calendar date the user has said something about. */
export interface DayLog {
  date: string;
  dayType: DayType;
  status: DayStatus;
}
