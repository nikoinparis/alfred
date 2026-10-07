"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronRight, Flag, MoreHorizontal, Plus, Share, Trophy, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp, useSettings } from "@/components/providers/app-provider";
import { SectionTitle } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import {
  addExerciseToSession,
  completedWorking,
  deleteSession,
  finishSession,
  reopenSession,
  swapExercise,
  workingSetCount,
} from "@/lib/db/workouts";
import { DAY_LABEL } from "@/lib/domain/muscles";
import type { DayTemplate, DayType, Exercise, Session } from "@/lib/domain/types";
import { displayWeight, formatNumber, formatWeight } from "@/lib/domain/units";
import { computeSessionStats } from "@/lib/session-stats";
import { renderShareCard, shareOrDownload } from "@/lib/share-card";
import { cn } from "@/lib/cn";
import { ExerciseLogger, PR_LABEL } from "./exercise-logger";
import { ExercisePicker } from "./exercise-picker";

interface Props {
  session: Session;
  exercises: Record<string, Exercise>;
  templates: Record<DayType, DayTemplate>;
}

function useElapsed(since: number, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [running]);
  return Math.max(0, Math.round((now - since) / 60_000));
}

export function SessionView({ session, exercises, templates }: Props) {
  const { db } = useApp();
  const settings = useSettings();
  const toast = useToast();
  const unit = settings.unit;
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const active = session.status === "active";
  const elapsed = useElapsed(session.startedAt, active);
  const template = templates[session.dayType];
  const stats = useLiveQuery(() => computeSessionStats(db, session, exercises), [db, session, exercises]);

  const slotFor = (slotId?: string) => template?.slots.find((s) => s.id === slotId);
  const doneCount = session.entries.filter((e) => e.done).length;
  const swapEntry = session.entries.find((e) => e.id === swapFor);

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="readout text-[64px] font-bold uppercase leading-[0.8] tracking-tight md:text-[88px]">
            {DAY_LABEL[session.dayType]}
          </h2>
          <p className="mt-2 text-sm text-fog">
            {active ? `In progress · ${elapsed} min` : `Finished · ${stats?.durationMin ?? "–"} min`} · {doneCount}/{session.entries.length}{" "}
            exercises
          </p>
        </div>
        <Button size="icon" variant="ghost" onClick={() => setMenu(true)} aria-label="Workout options">
          <MoreHorizontal className="size-5" />
        </Button>
      </div>

      <ProgressBar value={session.entries.length ? doneCount / session.entries.length : 0} />

      {!active && stats && <Summary session={session} stats={stats} exercises={exercises} />}

      <ul className="panel divide-steel mt-5">
        {session.entries.map((entry) => {
          const ex = exercises[entry.exerciseId];
          if (!ex) return null;
          const total = workingSetCount(entry);
          const done = completedWorking(entry);
          const top = entry.sets.find((s) => s.kind === "working" && s.weight !== null);
          const hasPr = stats?.prs.some((p) => p.exerciseId === ex.id);
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setOpenEntry(entry.id)}
                className="flex min-h-[68px] w-full items-center gap-3.5 px-4 py-3 text-left hover:bg-gunmetal-2/40"
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors",
                    entry.done ? "border-signal bg-signal text-signal-ink" : done > 0 ? "border-signal/60" : "border-steel-2",
                  )}
                >
                  {entry.done && <Check className="size-4" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("flex items-center gap-1.5 text-base", entry.done && "text-fog-2")}>
                    <span className="truncate">{ex.name}</span>
                    {hasPr && <Trophy className="size-3.5 shrink-0 text-signal" aria-label="Personal record" />}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-sm text-fog">
                    {ex.isConditioning ? (
                      entry.done ? (
                        "Done"
                      ) : (
                        "Recovery"
                      )
                    ) : (
                      <>
                        <SetDots total={total} done={done} />
                        <span>
                          {total} × {entry.repMin === entry.repMax ? entry.repMin : `${entry.repMin}–${entry.repMax}`}
                          {top?.weight != null && ` · ${formatNumber(displayWeight(top.weight, top.unit, unit))} ${unit}`}
                        </span>
                      </>
                    )}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-fog" />
              </button>
            </li>
          );
        })}
      </ul>

      <Button variant="ghost" className="mt-2 w-full" onClick={() => setAdding(true)}>
        <Plus className="size-4" /> Add exercise
      </Button>

      {active && (
        <Button
          variant={doneCount === session.entries.length ? "primary" : "secondary"}
          size="lg"
          className="mt-6 w-full"
          onClick={async () => {
            await finishSession(db, session.id);
            window.scrollTo({ top: 0, behavior: "smooth" });
            toast({ message: "Workout saved.", tone: "signal" });
          }}
        >
          <Flag className="size-5" /> Finish workout
        </Button>
      )}

      <ExerciseLogger
        session={session}
        entryId={openEntry}
        exercises={exercises}
        slot={slotFor(session.entries.find((e) => e.id === openEntry)?.slotId)}
        onClose={() => setOpenEntry(null)}
        onSwap={(id) => {
          setOpenEntry(null);
          setSwapFor(id);
        }}
      />

      <ExercisePicker
        open={swapFor !== null}
        onClose={() => setSwapFor(null)}
        title="Swap for today"
        exercises={exercises}
        replacing={swapEntry ? exercises[swapEntry.swappedFromExerciseId ?? swapEntry.exerciseId] : undefined}
        alternates={slotFor(swapEntry?.slotId)?.alternates}
        onPick={async (ex) => {
          if (!swapFor) return;
          await swapExercise(db, session, swapFor, ex, unit);
          const id = swapFor;
          setSwapFor(null);
          setOpenEntry(id);
        }}
      />

      <ExercisePicker
        open={adding}
        onClose={() => setAdding(false)}
        title="Add exercise"
        exercises={exercises}
        onPick={async (ex) => {
          const entry = await addExerciseToSession(db, session, ex, unit);
          setAdding(false);
          setOpenEntry(entry.id);
        }}
      />

      <Sheet open={menu} onClose={() => setMenu(false)} title="Workout options">
        <div className="grid gap-2">
          {!active && (
            <Button
              onClick={async () => {
                await reopenSession(db, session.id);
                setMenu(false);
              }}
            >
              <Undo2 className="size-4" /> Reopen workout
            </Button>
          )}
          <DeleteWorkout
            onConfirm={async () => {
              await deleteSession(db, session);
              setMenu(false);
              toast({ message: "Workout deleted." });
            }}
          />
        </div>
      </Sheet>
    </>
  );
}

function DeleteWorkout({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <div className="rounded-[12px] border border-crimson/40 p-3">
      <p className="text-sm text-fog-2">Delete this workout and every set in it? This can&apos;t be undone.</p>
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
        <Button variant="danger" className="flex-1" onClick={onConfirm}>
          Delete workout
        </Button>
      </div>
    </div>
  ) : (
    <Button variant="danger" onClick={() => setConfirming(true)}>
      Delete workout
    </Button>
  );
}

function SetDots({ total, done }: { total: number; done: number }) {
  return (
    <span className="flex gap-1" aria-label={`${done} of ${total} sets done`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-1.5 w-3 rounded-full", i < done ? "bg-signal" : "bg-steel-2")} />
      ))}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-steel" aria-hidden>
      <div className="h-full rounded-full bg-signal transition-[width] duration-500 ease-out" style={{ width: `${value * 100}%` }} />
    </div>
  );
}

function Summary({
  session,
  stats,
  exercises,
}: {
  session: Session;
  stats: NonNullable<Awaited<ReturnType<typeof computeSessionStats>>>;
  exercises: Record<string, Exercise>;
}) {
  const { unit } = useSettings();
  const [sharing, setSharing] = useState(false);
  const items: [string, string][] = [
    [String(stats.durationMin), "min"],
    [formatNumber(Math.round(stats.hardSets * 10) / 10), "hard sets"],
    [formatNumber(Math.round(displayWeight(stats.volumeKg, "kg", unit))), `${unit} volume`],
  ];
  return (
    <>
      <SectionTitle>Summary</SectionTitle>
      <div className="panel p-4">
        <div className="grid grid-cols-3 gap-2">
          {items.map(([v, l]) => (
            <div key={l}>
              <p className="readout text-[34px] font-semibold">{v}</p>
              <p className="text-xs text-fog">{l}</p>
            </div>
          ))}
        </div>
        {stats.prs.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-separator pt-3">
            {stats.prs.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Trophy className="size-4 text-signal" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="text-fog">{PR_LABEL[p.pr.kind]}</span>
                <span className="readout text-lg">{formatWeight(p.pr.value, "kg", unit)}</span>
              </li>
            ))}
          </ul>
        )}
        <Button
          className="mt-4 w-full"
          disabled={sharing}
          onClick={async () => {
            setSharing(true);
            try {
              const blob = await renderShareCard(session, stats, exercises, unit);
              await shareOrDownload(blob, `alfred-${session.date}-${session.dayType}.png`);
            } finally {
              setSharing(false);
            }
          }}
        >
          <Share className="size-4" /> Save session card
        </Button>
      </div>
    </>
  );
}
