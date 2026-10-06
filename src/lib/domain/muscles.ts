import type { Muscle, TrainingDayType } from "./types";

export interface MuscleMeta {
  label: string;
  /** Which body views show this muscle. */
  views: ("front" | "back")[];
  /** Default weekly hard-set target. */
  defaultTarget: number;
}

export const MUSCLE_META: Record<Muscle, MuscleMeta> = {
  chest: { label: "Chest", views: ["front"], defaultTarget: 10 },
  frontDelts: { label: "Front delts", views: ["front"], defaultTarget: 6 },
  sideDelts: { label: "Side delts", views: ["front", "back"], defaultTarget: 10 },
  rearDelts: { label: "Rear delts", views: ["back"], defaultTarget: 8 },
  triceps: { label: "Triceps", views: ["back"], defaultTarget: 10 },
  biceps: { label: "Biceps", views: ["front"], defaultTarget: 10 },
  forearms: { label: "Forearms", views: ["front", "back"], defaultTarget: 6 },
  upperBack: { label: "Upper back & traps", views: ["back"], defaultTarget: 10 },
  lats: { label: "Lats", views: ["back"], defaultTarget: 10 },
  lowerBack: { label: "Lower back", views: ["back"], defaultTarget: 4 },
  abs: { label: "Abs", views: ["front"], defaultTarget: 8 },
  obliques: { label: "Obliques", views: ["front"], defaultTarget: 4 },
  glutes: { label: "Glutes", views: ["back"], defaultTarget: 10 },
  quads: { label: "Quads", views: ["front"], defaultTarget: 10 },
  hamstrings: { label: "Hamstrings", views: ["back"], defaultTarget: 10 },
  adductors: { label: "Adductors", views: ["front"], defaultTarget: 4 },
  calves: { label: "Calves", views: ["front", "back"], defaultTarget: 8 },
};

/** Coarse groups used by the planner's "no same group on consecutive days" rule. */
export type MajorGroup = "upperPush" | "upperPull" | "lower";

export const DAY_GROUPS: Record<TrainingDayType, MajorGroup[]> = {
  push: ["upperPush"],
  pull: ["upperPull"],
  legs: ["lower"],
  upper: ["upperPush", "upperPull"],
  lower: ["lower"],
};

export const DAY_LABEL: Record<TrainingDayType | "rest", string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper",
  lower: "Lower",
  rest: "Rest",
};
