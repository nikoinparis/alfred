"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { LazyAnatomy, PRIMARY_COLOR, SECONDARY_COLOR, workColor } from "@/components/body/lazy-anatomy";
import { Sheet } from "@/components/ui/sheet";
import { useTemplates } from "@/lib/db/hooks";
import { DAY_LABEL, MUSCLE_META } from "@/lib/domain/muscles";
import type { DayType, Exercise, Muscle } from "@/lib/domain/types";

/** Front + back figure with the given exercises' muscles lit: primary strong, secondary soft. */
export function WorksFigure({ exercises, className = "h-72" }: { exercises: Exercise[]; className?: string }) {
  return <LazyAnatomy className={className} colorOf={workColor(exercises)} tone="muted" />;
}

export function MuscleLegend() {
  return (
    <div className="flex justify-center gap-5 text-xs text-fog">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full" style={{ background: PRIMARY_COLOR }} /> Main target
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full" style={{ background: SECONDARY_COLOR }} /> Also works
      </span>
    </div>
  );
}

function muscleNames(ms: Muscle[]) {
  return ms.map((m) => MUSCLE_META[m].label).join(", ");
}

/** What one exercise works, plus the days it's programmed on. */
export function ExerciseWorks({ exercise }: { exercise: Exercise }) {
  const templates = useTemplates();
  const days = Object.values(templates ?? {})
    .filter((t) => t.slots.some((s) => s.exerciseId === exercise.id))
    .map((t) => DAY_LABEL[t.dayType]);
  return (
    <div className="grid gap-4">
      {exercise.isConditioning ? (
        <p className="text-base text-fog-2">Recovery work: blood flow and mobility, not counted toward muscle volume.</p>
      ) : (
        <>
          <WorksFigure exercises={[exercise]} className="h-80" />
          <MuscleLegend />
          <ul className="panel divide-steel">
            <li className="flex gap-3 px-4 py-3">
              <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: PRIMARY_COLOR }} />
              <span>
                <span className="block text-base">{muscleNames(exercise.primary)}</span>
                <span className="text-sm text-fog">Main target: each set counts as one hard set</span>
              </span>
            </li>
            {exercise.secondary.length > 0 && (
              <li className="flex gap-3 px-4 py-3">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: SECONDARY_COLOR }} />
                <span>
                  <span className="block text-base">{muscleNames(exercise.secondary)}</span>
                  <span className="text-sm text-fog">Also works: each set counts as half</span>
                </span>
              </li>
            )}
          </ul>
        </>
      )}
      {days.length > 0 && <p className="px-1 text-sm text-fog">Programmed on {days.join(" and ")} day.</p>}
    </div>
  );
}

export function ExerciseInfoSheet({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  return (
    <Sheet open={exercise !== null} onClose={onClose} title={exercise?.name ?? ""} closeLabel="Done" largeTitle>
      {exercise && <ExerciseWorks exercise={exercise} />}
    </Sheet>
  );
}

/**
 * A day type's exercises with a figure of everything the day trains. Tapping an exercise drills in
 * (inside the same sheet, so there's only ever one sheet open).
 */
export function DayWorks({ dayType, exercises }: { dayType: DayType; exercises: Record<string, Exercise> }) {
  const templates = useTemplates();
  const [open, setOpen] = useState<Exercise | null>(null);
  const slots = templates?.[dayType]?.slots ?? [];
  const list = slots
    .map((s) => ({ slot: s, ex: exercises[s.exerciseId] }))
    .filter((x): x is { slot: typeof x.slot; ex: Exercise } => Boolean(x.ex));

  if (open) {
    return (
      <div className="grid gap-3">
        <button type="button" onClick={() => setOpen(null)} className="justify-self-start text-base text-signal">
          ‹ {DAY_LABEL[dayType]}
        </button>
        <p className="text-xl font-bold">{open.name}</p>
        <ExerciseWorks exercise={open} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {dayType !== "rest" && (
        <>
          <WorksFigure exercises={list.map((x) => x.ex)} className="h-72" />
          <MuscleLegend />
        </>
      )}
      <ul className="panel divide-steel">
        {list.map(({ slot, ex }) => (
          <li key={slot.id}>
            <button type="button" onClick={() => setOpen(ex)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">{ex.name}</span>
                <span className="block truncate text-sm text-fog">{ex.isConditioning ? "Recovery" : muscleNames(ex.primary)}</span>
              </span>
              <ChevronRight className="size-5 text-fog/70" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
