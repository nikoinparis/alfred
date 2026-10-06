import type { Exercise } from "./types";

/**
 * Muscle mapping lives here as data. To add an exercise, add an entry:
 * primary muscles count 1 hard set per set, secondary muscles count 0.5.
 */
export const EXERCISES: Exercise[] = [
  // Push
  { id: "chest-press", name: "Chest Press (DB or Barbell)", primary: ["chest"], secondary: ["frontDelts", "triceps"], equipment: "dumbbell", loadMode: "total", incrementKg: 4, compound: true },
  { id: "db-chest-press", name: "DB Chest Press", primary: ["chest"], secondary: ["frontDelts", "triceps"], equipment: "dumbbell", loadMode: "total", incrementKg: 4, compound: true },
  { id: "bench-press", name: "Barbell Bench Press", primary: ["chest"], secondary: ["frontDelts", "triceps"], equipment: "barbell", loadMode: "total", incrementKg: 2.5, compound: true },
  { id: "incline-db-press", name: "Incline DB Press", primary: ["chest", "frontDelts"], secondary: ["triceps"], equipment: "dumbbell", loadMode: "total", incrementKg: 4, compound: true },
  { id: "incline-cable-fly", name: "Incline Cable Fly", primary: ["chest"], secondary: ["frontDelts"], equipment: "cable", loadMode: "total", incrementKg: 2.5, compound: false },
  { id: "cable-chest-fly", name: "Cable Chest Fly", primary: ["chest"], secondary: ["frontDelts"], equipment: "cable", loadMode: "total", incrementKg: 2.5, compound: false },
  { id: "pec-deck", name: "Pec Deck", primary: ["chest"], secondary: [], equipment: "machine", loadMode: "total", incrementKg: 5, compound: false },
  { id: "lateral-raise", name: "Lateral Raise", primary: ["sideDelts"], secondary: [], equipment: "dumbbell", loadMode: "total", incrementKg: 2, compound: false },
  { id: "cable-lateral-raise", name: "Cable Lateral Raise", primary: ["sideDelts"], secondary: [], equipment: "cable", loadMode: "total", incrementKg: 1.25, compound: false },
  { id: "shoulder-press", name: "Seated DB Shoulder Press", primary: ["frontDelts"], secondary: ["sideDelts", "triceps"], equipment: "dumbbell", loadMode: "total", incrementKg: 4, compound: true },
  { id: "cable-triceps-ext", name: "Cable Triceps Extension", primary: ["triceps"], secondary: [], equipment: "cable", loadMode: "total", incrementKg: 2.5, compound: false },
  { id: "overhead-triceps-ext", name: "Overhead Cable Triceps Extension", primary: ["triceps"], secondary: [], equipment: "cable", loadMode: "total", incrementKg: 2.5, compound: false },
  { id: "forearm-work", name: "Forearm Work (Wrist Curls)", primary: ["forearms"], secondary: [], equipment: "barbell", loadMode: "total", incrementKg: 2.5, compound: false },

  // Pull
  { id: "cable-row", name: "Cable Row", primary: ["upperBack", "lats"], secondary: ["biceps", "rearDelts"], equipment: "cable", loadMode: "total", incrementKg: 5, compound: true },
  { id: "seated-cable-row", name: "Seated Cable Row", primary: ["upperBack", "lats"], secondary: ["biceps", "rearDelts"], equipment: "cable", loadMode: "total", incrementKg: 5, compound: true },
  { id: "lat-pulldown", name: "Lat Pulldown", primary: ["lats"], secondary: ["biceps", "upperBack"], equipment: "cable", loadMode: "total", incrementKg: 5, compound: true },
  { id: "wide-lat-pulldown", name: "Wide-Grip Lat Pulldown", primary: ["lats"], secondary: ["biceps", "upperBack"], equipment: "cable", loadMode: "total", incrementKg: 5, compound: true },
  { id: "assisted-pullup", name: "Assisted Pull-up", primary: ["lats"], secondary: ["biceps", "upperBack"], equipment: "machine", loadMode: "assisted", incrementKg: 5, compound: true },
  { id: "pullup", name: "Pull-up", primary: ["lats"], secondary: ["biceps", "upperBack"], equipment: "bodyweight", loadMode: "bodyweight", incrementKg: 2.5, compound: true },
  { id: "face-pull", name: "Face Pull", primary: ["rearDelts"], secondary: ["upperBack"], equipment: "cable", loadMode: "total", incrementKg: 2.5, compound: false },
  { id: "biceps-curl", name: "Biceps Curl", primary: ["biceps"], secondary: ["forearms"], equipment: "dumbbell", loadMode: "total", incrementKg: 2, compound: false },
  { id: "hammer-curl", name: "Hammer Curl", primary: ["biceps", "forearms"], secondary: [], equipment: "dumbbell", loadMode: "total", incrementKg: 2, compound: false },
  { id: "hanging-leg-raise", name: "Hanging Leg Raise", primary: ["abs"], secondary: ["obliques"], equipment: "bodyweight", loadMode: "bodyweight", incrementKg: 2.5, compound: false },

  // Legs
  { id: "squat", name: "Squat", primary: ["quads", "glutes"], secondary: ["adductors", "lowerBack"], equipment: "barbell", loadMode: "total", incrementKg: 2.5, compound: true },
  { id: "walking-lunge", name: "Walking Lunge", primary: ["quads", "glutes"], secondary: ["adductors", "hamstrings"], equipment: "dumbbell", loadMode: "total", incrementKg: 4, compound: true, perSide: true },
  { id: "leg-press", name: "Leg Press", primary: ["quads", "glutes"], secondary: ["adductors"], equipment: "machine", loadMode: "total", incrementKg: 10, compound: true },
  { id: "leg-extension", name: "Leg Extension", primary: ["quads"], secondary: [], equipment: "machine", loadMode: "total", incrementKg: 5, compound: false },
  { id: "seated-leg-curl", name: "Seated Leg Curl", primary: ["hamstrings"], secondary: [], equipment: "machine", loadMode: "total", incrementKg: 5, compound: false },
  { id: "hamstring-curl", name: "Hamstring Curl", primary: ["hamstrings"], secondary: [], equipment: "machine", loadMode: "total", incrementKg: 5, compound: false },
  { id: "lying-leg-curl", name: "Lying Leg Curl", primary: ["hamstrings"], secondary: [], equipment: "machine", loadMode: "total", incrementKg: 5, compound: false },
  { id: "standing-calf-raise", name: "Standing Calf Raise", primary: ["calves"], secondary: [], equipment: "machine", loadMode: "total", incrementKg: 5, compound: false },
  { id: "seated-calf-raise", name: "Seated Calf Raise", primary: ["calves"], secondary: [], equipment: "machine", loadMode: "total", incrementKg: 5, compound: false },
  { id: "rdl", name: "Romanian Deadlift", primary: ["hamstrings", "glutes"], secondary: ["lowerBack"], equipment: "barbell", loadMode: "total", incrementKg: 2.5, compound: true },
  { id: "front-squat", name: "Front Squat", primary: ["quads"], secondary: ["glutes", "upperBack"], equipment: "barbell", loadMode: "total", incrementKg: 2.5, compound: true },
  { id: "bulgarian-split-squat", name: "Bulgarian Split Squat", primary: ["quads", "glutes"], secondary: ["adductors"], equipment: "dumbbell", loadMode: "total", incrementKg: 4, compound: true, perSide: true },
  { id: "hip-thrust", name: "Hip Thrust", primary: ["glutes"], secondary: ["hamstrings"], equipment: "barbell", loadMode: "total", incrementKg: 5, compound: true },

  // Core
  { id: "ab-wheel", name: "Ab-Wheel Roll-Out", primary: ["abs"], secondary: ["obliques", "lats"], equipment: "bodyweight", loadMode: "bodyweight", incrementKg: 2.5, compound: false },
  { id: "cable-crunch", name: "Cable Crunch", primary: ["abs"], secondary: [], equipment: "cable", loadMode: "total", incrementKg: 2.5, compound: false },
  { id: "pallof-press", name: "Pallof Press", primary: ["obliques"], secondary: ["abs"], equipment: "cable", loadMode: "total", incrementKg: 2.5, compound: false, perSide: true },

  // Conditioning / mobility (no muscle volume)
  { id: "incline-walk", name: "Incline Walk or Light Jog (20–30 min)", primary: [], secondary: [], equipment: "other", loadMode: "bodyweight", incrementKg: 0, compound: false, isConditioning: true },
  { id: "stretch-foam", name: "Stretching / Foam Rolling", primary: [], secondary: [], equipment: "other", loadMode: "bodyweight", incrementKg: 0, compound: false, isConditioning: true },
  { id: "light-walk", name: "Light Walk, Yoga or Mobility (optional)", primary: [], secondary: [], equipment: "other", loadMode: "bodyweight", incrementKg: 0, compound: false, isConditioning: true },
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
