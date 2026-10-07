"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { LazyAnatomy, HEAT_COLOR, ANATOMY_COLOR } from "@/components/body/lazy-anatomy";
import type { HeatCell } from "@/components/body/anatomy-figure";
import { MuscleSheet, TargetsSheet } from "@/components/body/muscle-sheet";
import { Page, SectionTitle } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { useExercises, useToday } from "@/lib/db/hooks";
import { addDays, startOfWeek } from "@/lib/domain/dates";
import { MUSCLE_META } from "@/lib/domain/muscles";
import { volumeStatus, weeklyMuscleVolume, type VolumeStatus } from "@/lib/domain/volume";
import { MUSCLES, type Muscle } from "@/lib/domain/types";
import { formatNumber } from "@/lib/domain/units";

export default function BodyPage() {
  return (
    <Suspense>
      <BodyInner />
    </Suspense>
  );
}

type ColorMode = "volume" | "anatomy";

function BodyInner() {
  const { db } = useApp();
  const t = useToday();
  const exercises = useExercises();
  const params = useSearchParams();
  const [week, setWeek] = useState<"this" | "last">("this");
  const [mode, setMode] = useState<ColorMode>("volume");
  const [selected, setSelected] = useState<Muscle | null>(null);
  const [targetsOpen, setTargetsOpen] = useState(params.get("targets") === "1");

  const start = week === "this" ? startOfWeek(t) : addDays(startOfWeek(t), -7);
  const end = addDays(start, 6);
  const sessions = useLiveQuery(() => db.sessions.where("date").between(start, end, true, true).toArray(), [db, start, end]);
  const targetRows = useLiveQuery(() => db.muscleTargets.toArray(), [db]);

  if (!sessions || !exercises || !targetRows) return <Page title="Body">{null}</Page>;

  const targets = Object.fromEntries(targetRows.map((r) => [r.muscle, r.sets])) as Record<Muscle, number>;
  const volume = weeklyMuscleVolume(sessions, exercises);
  const heat = Object.fromEntries(
    MUSCLES.map((m) => {
      const target = targets[m] ?? MUSCLE_META[m].defaultTarget;
      const sets = volume[m].sets;
      return [m, { status: volumeStatus(sets, target), fraction: Math.min(1, sets / Math.max(1, target)) } satisfies HeatCell];
    }),
  ) as Record<Muscle, HeatCell>;
  const counts: Record<VolumeStatus, number> = { untrained: 0, below: 0, hit: 0 };
  for (const m of MUSCLES) counts[heat[m].status] += 1;

  const order: Record<VolumeStatus, number> = { untrained: 0, below: 1, hit: 2 };
  const rows = [...MUSCLES].sort((a, b) => order[heat[a].status] - order[heat[b].status] || heat[a].fraction - heat[b].fraction);

  return (
    <Page
      title="Body"
      subtitle={`${counts.hit} of ${MUSCLES.length} muscle groups at target`}
      wide
      actions={
        <Button size="icon" variant="ghost" onClick={() => setTargetsOpen(true)} aria-label="Edit weekly targets">
          <SlidersHorizontal className="size-5" />
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="panel overflow-hidden">
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            <Segmented
              label="Week"
              value={week}
              onChange={setWeek}
              size="sm"
              options={[
                { value: "this", label: "This week" },
                { value: "last", label: "Last week" },
              ]}
            />
            <Segmented
              label="Colours"
              value={mode}
              onChange={setMode}
              size="sm"
              options={[
                { value: "volume", label: "Volume" },
                { value: "anatomy", label: "Anatomy" },
              ]}
            />
          </div>
          <LazyAnatomy
            className="h-[min(118vw,520px)] md:h-[600px]"
            colorOf={(m) => (mode === "volume" ? HEAT_COLOR[heat[m].status] : ANATOMY_COLOR[m])}
            selected={selected}
            onSelect={setSelected}
          />
          {mode === "volume" ? (
            <div className="grid grid-cols-3 border-t border-separator">
              {(
                [
                  ["untrained", "Not trained"],
                  ["below", "Below target"],
                  ["hit", "At target"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="flex flex-col items-center gap-1 py-3">
                  <span className="flex items-center gap-1.5 text-xs text-fog">
                    <span className="size-2 rounded-full" style={{ background: HEAT_COLOR[k] }} />
                    {label}
                  </span>
                  <span className="readout text-2xl font-semibold">{counts[k]}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="border-t border-separator px-4 py-3 text-center text-xs text-fog">
              Each muscle group in its own colour. Tap one to see its week.
            </p>
          )}
        </section>

        <div>
          <SectionTitle className="mt-0">Hard sets vs target</SectionTitle>
          <ul className="panel divide-steel">
            {rows.map((m) => {
              const target = targets[m] ?? MUSCLE_META[m].defaultTarget;
              const cell = heat[m];
              return (
                <li key={m}>
                  <button
                    type="button"
                    onClick={() => setSelected(m)}
                    className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left"
                  >
                    <StatusDot status={cell.status} />
                    <span className="min-w-0 flex-1 truncate text-base">{MUSCLE_META[m].label}</span>
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${Math.max(4, cell.fraction * 100)}%`, background: HEAT_COLOR[cell.status] }}
                      />
                    </span>
                    <span className="readout w-14 text-right text-lg">
                      {formatNumber(volume[m].sets)}
                      <span className="text-sm text-fog">/{target}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 px-4 text-xs text-fog">
            Primary muscle = 1 set, secondary = 0.5, drop sets count half, warm-ups don&apos;t count.
          </p>
        </div>
      </div>

      <MuscleSheet
        muscle={selected}
        volume={selected ? volume[selected] : null}
        target={selected ? (targets[selected] ?? MUSCLE_META[selected].defaultTarget) : 0}
        exercises={exercises}
        onClose={() => setSelected(null)}
        onTarget={(sets) => selected && db.muscleTargets.put({ muscle: selected, sets })}
      />
      <TargetsSheet open={targetsOpen} onClose={() => setTargetsOpen(false)} targets={targets} />
    </Page>
  );
}

export function StatusDot({ status }: { status: VolumeStatus }) {
  return (
    <span
      className="size-2.5 shrink-0 rounded-full"
      style={{ background: HEAT_COLOR[status] }}
      aria-label={status === "hit" ? "At target" : status === "below" ? "Below target" : "Not trained"}
    />
  );
}
