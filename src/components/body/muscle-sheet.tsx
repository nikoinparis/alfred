"use client";

import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { useTemplates } from "@/lib/db/hooks";
import { DAY_LABEL, MUSCLE_META } from "@/lib/domain/muscles";
import { remainingFor, volumeStatus, type MuscleVolume } from "@/lib/domain/volume";
import { MUSCLES, type DayType, type Exercise, type Muscle } from "@/lib/domain/types";
import { formatNumber } from "@/lib/domain/units";
import { cn } from "@/lib/cn";

export function MuscleSheet({
  muscle,
  volume,
  target,
  exercises,
  onClose,
  onTarget,
}: {
  muscle: Muscle | null;
  volume: MuscleVolume | null;
  target: number;
  exercises: Record<string, Exercise>;
  onClose: () => void;
  onTarget: (sets: number) => void;
}) {
  const templates = useTemplates();
  const daysFor = new Map<string, DayType[]>();
  for (const tpl of Object.values(templates ?? {})) {
    for (const slot of tpl.slots) daysFor.set(slot.exerciseId, [...(daysFor.get(slot.exerciseId) ?? []), tpl.dayType]);
  }
  const candidates = [...daysFor.keys()].map((id) => exercises[id]).filter((e): e is Exercise => Boolean(e));
  const sets = volume?.sets ?? 0;
  const status = volumeStatus(sets, target);
  const left = muscle ? remainingFor(muscle, sets, target, candidates) : null;

  return (
    <Sheet
      open={muscle !== null}
      onClose={onClose}
      title={muscle ? MUSCLE_META[muscle].label : ""}
      description={
        status === "hit" ? "Target hit this week." : status === "below" ? "Trained, but below target." : "Not trained yet this week."
      }
    >
      {muscle && volume && (
        <div className="space-y-5">
          <div>
            <p className="readout text-[56px] font-semibold">
              {formatNumber(sets)}
              <span className="text-2xl text-fog"> / {target} sets</span>
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-steel">
              <div
                className={cn("h-full rounded-full", status === "hit" ? "bg-verdigris" : status === "below" ? "bg-ochre" : "bg-crimson")}
                style={{ width: `${Math.min(100, (sets / Math.max(1, target)) * 100)}%` }}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-fog-2">What hit it</p>
            {volume.contributions.length ? (
              <ul className="panel divide-steel">
                {volume.contributions.map((c) => (
                  <li key={`${c.exerciseId}-${c.role}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-base">{exercises[c.exerciseId]?.name ?? c.exerciseId}</span>
                    <span className="text-xs text-fog">{c.role === "primary" ? "primary" : "secondary ×0.5"}</span>
                    <span className="readout w-10 text-right text-lg">{formatNumber(c.sets)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fog">Nothing yet this week.</p>
            )}
          </div>

          {left && left.remaining > 0 && (
            <div>
              <p className="mb-2 text-sm text-fog-2">
                {formatNumber(left.remaining)} set{left.remaining === 1 ? "" : "s"} to go. Any one of these closes the gap:
              </p>
              <ul className="panel divide-steel">
                {left.suggestions.map((s) => (
                  <li key={s.exerciseId} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base">{exercises[s.exerciseId]?.name}</span>
                      <span className="text-xs text-fog">{(daysFor.get(s.exerciseId) ?? []).map((d) => DAY_LABEL[d]).join(", ")} day</span>
                    </span>
                    <span className="readout text-lg">{s.setsNeeded} sets</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-end gap-3">
            <label className="flex-1">
              <span className="mb-1.5 block text-sm text-fog-2">Weekly target</span>
              <NumberField label="Weekly set target" value={target} min={0} max={40} onChange={(v) => v !== null && onTarget(v)} />
            </label>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function TargetsSheet({ open, onClose, targets }: { open: boolean; onClose: () => void; targets: Record<Muscle, number> }) {
  const { db } = useApp();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Weekly set targets"
      description="Hard sets per muscle per week. ~10 is a solid default for growth; smaller muscles need less."
      footer={
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => db.muscleTargets.bulkPut(MUSCLES.map((m) => ({ muscle: m, sets: MUSCLE_META[m].defaultTarget })))}
          >
            Reset defaults
          </Button>
          <Button variant="primary" className="flex-1" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <ul className="divide-steel">
        {MUSCLES.map((m) => (
          <li key={m} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1 text-base">{MUSCLE_META[m].label}</span>
            <NumberField
              label={`${MUSCLE_META[m].label} target`}
              value={targets[m] ?? MUSCLE_META[m].defaultTarget}
              min={0}
              max={40}
              dense
              className="w-32"
              onChange={(v) => v !== null && db.muscleTargets.put({ muscle: m, sets: v })}
            />
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
