import { MUSCLES, type Exercise, type Muscle, type Session, type SetKind, type SetLog } from "./types";

/** How much a completed set counts as a "hard set". Warm-ups don't count. */
export const SET_KIND_WEIGHT: Record<SetKind, number> = {
  warmup: 0,
  working: 1,
  failure: 1,
  drop: 0.5,
};

export const PRIMARY_FACTOR = 1;
export const SECONDARY_FACTOR = 0.5;

export function hardSetValue(set: SetLog): number {
  if (!set.done) return 0;
  if (set.reps !== null && set.reps <= 0) return 0;
  return SET_KIND_WEIGHT[set.kind];
}

export interface MuscleContribution {
  exerciseId: string;
  sets: number;
  role: "primary" | "secondary";
}

export interface MuscleVolume {
  muscle: Muscle;
  sets: number;
  contributions: MuscleContribution[];
}

export function emptyVolume(): Record<Muscle, MuscleVolume> {
  return Object.fromEntries(MUSCLES.map((m) => [m, { muscle: m, sets: 0, contributions: [] }])) as unknown as Record<
    Muscle,
    MuscleVolume
  >;
}

/**
 * Weekly hard sets per muscle. Primary muscles get 1 per hard set, secondary 0.5.
 * Contributions are merged per exercise so the UI can show "what hit this muscle".
 */
export function weeklyMuscleVolume(
  sessions: Session[],
  exercises: Record<string, Exercise | undefined>,
): Record<Muscle, MuscleVolume> {
  const out = emptyVolume();
  for (const session of sessions) {
    for (const entry of session.entries) {
      const ex = exercises[entry.exerciseId];
      if (!ex) continue;
      const hard = entry.sets.reduce((acc, s) => acc + hardSetValue(s), 0);
      if (hard === 0) continue;
      const add = (muscle: Muscle, factor: number, role: MuscleContribution["role"]) => {
        const v = out[muscle];
        const amount = hard * factor;
        v.sets += amount;
        const existing = v.contributions.find((c) => c.exerciseId === ex.id && c.role === role);
        if (existing) existing.sets += amount;
        else v.contributions.push({ exerciseId: ex.id, sets: amount, role });
      };
      for (const m of ex.primary) add(m, PRIMARY_FACTOR, "primary");
      for (const m of ex.secondary) if (!ex.primary.includes(m)) add(m, SECONDARY_FACTOR, "secondary");
    }
  }
  for (const v of Object.values(out)) v.contributions.sort((a, b) => b.sets - a.sets);
  return out;
}

export type VolumeStatus = "untrained" | "below" | "hit";

export function volumeStatus(sets: number, target: number): VolumeStatus {
  if (sets <= 0) return "untrained";
  return sets >= target ? "hit" : "below";
}

/**
 * Exercises from upcoming templates that would close the gap for a muscle,
 * with how many sets of each would do it.
 */
export function remainingFor(
  muscle: Muscle,
  sets: number,
  target: number,
  candidates: Exercise[],
): { remaining: number; suggestions: { exerciseId: string; setsNeeded: number }[] } {
  const remaining = Math.max(0, target - sets);
  if (remaining === 0) return { remaining, suggestions: [] };
  const suggestions = candidates
    .filter((e) => e.primary.includes(muscle) || e.secondary.includes(muscle))
    .map((e) => {
      const factor = e.primary.includes(muscle) ? PRIMARY_FACTOR : SECONDARY_FACTOR;
      return { exerciseId: e.id, setsNeeded: Math.ceil(remaining / factor), factor };
    })
    .sort((a, b) => b.factor - a.factor || a.setsNeeded - b.setsNeeded)
    .slice(0, 4)
    .map(({ exerciseId, setsNeeded }) => ({ exerciseId, setsNeeded }));
  return { remaining, suggestions };
}
