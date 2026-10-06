"use client";

import dynamic from "next/dynamic";
import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useApp, updateSettings, useSettings } from "@/components/providers/app-provider";
import { BodyMap2D, type HeatCell } from "@/components/body/body-map-2d";
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
import { cn } from "@/lib/cn";

const BodyMap3D = dynamic(() => import("@/components/body/body-map-3d"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-fog">Loading 3D model…</div>,
});

type View = "front" | "back" | "3d";

export default function BodyPage() {
  return (
    <Suspense>
      <BodyInner />
    </Suspense>
  );
}

function BodyInner() {
  const { db } = useApp();
  const settings = useSettings();
  const t = useToday();
  const exercises = useExercises();
  const params = useSearchParams();
  const [week, setWeek] = useState<"this" | "last">("this");
  const [viewChoice, setView] = useState<View | null>(null);
  // Until the user picks, follow the saved preference (settings load asynchronously).
  const view: View = viewChoice ?? (settings.bodyView === "3d" ? "3d" : "front");
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
  const hitCount = MUSCLES.filter((m) => heat[m].status === "hit").length;

  const changeView = (v: View) => {
    setView(v);
    updateSettings(db, { bodyView: v === "3d" ? "3d" : "2d" });
  };

  const order: Record<VolumeStatus, number> = { untrained: 0, below: 1, hit: 2 };
  const rows = [...MUSCLES].sort((a, b) => order[heat[a].status] - order[heat[b].status] || heat[a].fraction - heat[b].fraction);

  return (
    <Page
      title="Body"
      subtitle={`${hitCount} of ${MUSCLES.length} muscle groups at target`}
      wide
      actions={
        <Button size="icon" variant="ghost" onClick={() => setTargetsOpen(true)} aria-label="Edit weekly targets" className="mb-[-4px]">
          <SlidersHorizontal className="size-5" />
        </Button>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
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
          label="Body view"
          value={view}
          onChange={changeView}
          size="sm"
          options={[
            { value: "front", label: "Front" },
            { value: "back", label: "Back" },
            { value: "3d", label: "3D" },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="panel relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(127_166_201_/_0.10),transparent)]" />
          {view === "3d" ? (
            <div className="h-[460px] md:h-[560px]">
              <BodyMap3D heat={heat} selected={selected} onSelect={setSelected} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 p-4 md:grid-cols-2">
              <div className={cn("mx-auto h-[420px] w-full max-w-[260px] md:h-[500px]", view !== "front" && "hidden md:block")}>
                <BodyMap2D view="front" heat={heat} selected={selected} onSelect={setSelected} />
                <p className="mt-1 hidden text-center text-xs text-fog md:block">Front</p>
              </div>
              <div className={cn("mx-auto h-[420px] w-full max-w-[260px] md:h-[500px]", view !== "back" && "hidden md:block")}>
                <BodyMap2D view="back" heat={heat} selected={selected} onSelect={setSelected} />
                <p className="mt-1 hidden text-center text-xs text-fog md:block">Back</p>
              </div>
            </div>
          )}
          <Legend />
        </div>

        <div>
          <SectionTitle className="mt-0 lg:mt-0">Hard sets vs target</SectionTitle>
          <ul className="panel divide-steel">
            {rows.map((m) => {
              const target = targets[m] ?? MUSCLE_META[m].defaultTarget;
              const cell = heat[m];
              return (
                <li key={m}>
                  <button
                    type="button"
                    onClick={() => setSelected(m)}
                    className={cn(
                      "flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-gunmetal-2/40",
                      selected === m && "bg-gunmetal-2/60",
                    )}
                  >
                    <StatusDot status={cell.status} />
                    <span className="min-w-0 flex-1 truncate text-[15px]">{MUSCLE_META[m].label}</span>
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-steel" aria-hidden>
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          cell.status === "hit" ? "bg-verdigris" : cell.status === "below" ? "bg-ochre" : "bg-crimson",
                        )}
                        style={{ width: `${Math.max(4, cell.fraction * 100)}%` }}
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
          <p className="mt-2 text-xs text-fog">Primary muscle = 1 set, secondary = 0.5, drop sets count half, warm-ups don&apos;t count.</p>
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
      className={cn(
        "size-2.5 shrink-0 rounded-full",
        status === "hit" && "bg-verdigris",
        status === "below" && "bg-ochre",
        status === "untrained" && "bg-crimson",
      )}
      aria-label={status === "hit" ? "Target hit" : status === "below" ? "Below target" : "Not trained"}
    />
  );
}

function Legend() {
  const items: [string, string, boolean][] = [
    ["Not trained", "var(--crimson)", true],
    ["Below target", "var(--ochre)", false],
    ["Target hit", "var(--verdigris)", false],
  ];
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-steel px-4 py-3 text-xs text-fog-2">
      {items.map(([label, color, hatch], i) => (
        <span key={label} className="flex items-center gap-2">
          <svg width="14" height="14" aria-hidden>
            <defs>
              <pattern id={`legend-hatch-${i}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="4" stroke="rgb(0 0 0 / 0.4)" strokeWidth="1.5" />
              </pattern>
            </defs>
            <rect width="14" height="14" rx="3" fill={color} />
            {hatch && <rect width="14" height="14" rx="3" fill={`url(#legend-hatch-${i})`} />}
          </svg>
          {label}
        </span>
      ))}
    </div>
  );
}
