"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { ArrowUp, BedDouble, ChevronRight, Play } from "lucide-react";
import { useState } from "react";
import { useApp, useSettings } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { historyFor, latestBodyweightKg, logRestDay, overloadFor, startSession } from "@/lib/db/workouts";
import { DAY_LABEL, MUSCLE_META } from "@/lib/domain/muscles";
import { ExerciseInfoSheet, MuscleLegend, WorksFigure } from "./muscle-info";
import type { Suggestion } from "@/lib/domain/planner";
import type { DayLog, DayTemplate, DayType, Exercise } from "@/lib/domain/types";
import { formatNumber } from "@/lib/domain/units";
import { cn } from "@/lib/cn";

export const DAY_CHOICES: DayType[] = ["push", "pull", "legs", "upper", "lower", "rest"];

interface Props {
  date: string;
  planned: DayLog | undefined;
  suggestion: Suggestion | undefined;
  templates: Record<DayType, DayTemplate>;
  exercises: Record<string, Exercise>;
  restLogged: boolean;
}

export function TodayStart({ date, planned, suggestion, templates, exercises, restLogged }: Props) {
  const { db } = useApp();
  const settings = useSettings();
  const toast = useToast();
  const suggested = suggestion?.dayType ?? "push";
  const [choice, setChoice] = useState<DayType | null>(null);
  const selected = choice ?? planned?.dayType ?? suggested;
  const [starting, setStarting] = useState(false);
  const [info, setInfo] = useState<Exercise | null>(null);
  const template = templates[selected];

  const previews = useLiveQuery(async () => {
    if (!template) return [];
    const bw = await latestBodyweightKg(db);
    return Promise.all(
      template.slots.map(async (slot) => {
        const ex = exercises[slot.exerciseId];
        if (!ex || ex.isConditioning) return { slot, ex, suggestion: null };
        const history = await historyFor(db, ex);
        return { slot, ex, suggestion: overloadFor(ex, slot, slot.sets, history, slot.target, settings.unit, bw) };
      }),
    );
  }, [db, template, exercises, settings.unit]);

  /** Picking a day type plans it for today, so reopening the app keeps your choice. */
  const choose = async (d: DayType) => {
    setChoice(d);
    if (!restLogged) await db.dayLogs.put({ date, dayType: d, status: "planned" });
  };

  const start = async () => {
    setStarting(true);
    try {
      await startSession(db, date, selected);
    } finally {
      setStarting(false);
    }
  };

  const status = planned?.dayType === selected || choice === selected ? "Planned for today" : "Suggested";
  const reason =
    selected === suggested
      ? (suggestion?.reason ?? "")
      : `Off the suggested plan is fine. The rest of the week re-plans around ${DAY_LABEL[selected]}.`;
  const dayExercises = (template?.slots ?? []).map((s) => exercises[s.exerciseId]).filter((e): e is Exercise => Boolean(e));

  return (
    <>
      <div role="radiogroup" aria-label="Day type" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {DAY_CHOICES.map((d) => {
          const active = d === selected;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(d)}
              className={cn(
                "h-11 shrink-0 rounded-full px-[18px] text-base font-semibold transition-colors active:scale-[0.97]",
                active ? "bg-signal text-signal-ink" : "bg-white/[0.07] text-fog-2 hover:bg-white/[0.1]",
              )}
            >
              {DAY_LABEL[d]}
            </button>
          );
        })}
      </div>

      <motion.section
        key={selected}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5"
      >
        <div className="panel relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(70%_100%_at_30%_0%,rgb(58_134_255_/_0.16),transparent)]" />
          <div className={cn("relative grid", selected !== "rest" && "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]")}>
            <div className="p-5 pb-2 sm:pb-5">
              <p className="text-sm font-semibold text-signal">{status}</p>
              <h2 className="readout mt-1 text-[88px] font-bold uppercase leading-[0.8] tracking-tight md:text-[112px]">
                {DAY_LABEL[selected]}
              </h2>
              {reason && <p className="mt-3 max-w-sm text-base text-fog-2">{reason}</p>}
              {selected !== "rest" && (
                <p className="mt-3 text-sm text-fog">
                  {dayExercises.length} exercises · {template?.slots.reduce((a, s) => a + s.sets, 0)} working sets
                </p>
              )}
            </div>
            {selected !== "rest" && (
              <div>
                <WorksFigure exercises={dayExercises} className="h-64 sm:h-80" />
                <div className="pb-3">
                  <MuscleLegend />
                </div>
              </div>
            )}
          </div>
        </div>

        <ul className="panel divide-steel mt-4">
          {template?.slots.map((slot, i) => {
            const p = previews?.[i];
            const ex = exercises[slot.exerciseId];
            const s = p?.suggestion;
            return (
              <li key={slot.id}>
                <button
                  type="button"
                  onClick={() => ex && setInfo(ex)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base">{ex?.name ?? slot.exerciseId}</span>
                    <span className="block truncate text-sm text-fog">
                      {ex?.isConditioning
                        ? "Recovery"
                        : `${slot.sets} × ${slot.repMin === slot.repMax ? slot.repMin : `${slot.repMin}–${slot.repMax}`}${ex?.perSide ? " per side" : ""} · ${ex ? ex.primary.map((m) => MUSCLE_META[m].label).join(", ") : ""}`}
                    </span>
                  </span>
                  {s?.weight != null && (
                    <span
                      className={cn(
                        "readout flex items-center justify-end gap-1 text-[22px] font-semibold",
                        s.action === "increase" && "text-signal",
                      )}
                    >
                      {s.action === "increase" && <ArrowUp className="size-4" strokeWidth={2.5} />}
                      {formatNumber(s.weight)}
                      <span className="text-sm font-normal text-fog">{s.unit}</span>
                    </span>
                  )}
                  <ChevronRight className="size-5 shrink-0 text-fog/60" />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 px-4 text-xs text-fog">Tap an exercise to see the muscles it works.</p>
      </motion.section>

      <ExerciseInfoSheet exercise={info} onClose={() => setInfo(null)} />

      <StickyAction>
        {selected === "rest" ? (
          <div className="flex gap-2">
            <Button
              size="lg"
              className="min-w-0 flex-1 px-3"
              disabled={restLogged}
              onClick={async () => {
                await logRestDay(db, date);
                toast({ message: "Rest day logged. Recover well." });
              }}
            >
              <BedDouble className="size-5" /> {restLogged ? "Rest logged" : "Log rest"}
            </Button>
            <Button size="lg" variant="primary" className="min-w-0 flex-1 px-3" onClick={start} disabled={starting}>
              <Play className="size-5" /> Start recovery
            </Button>
          </div>
        ) : (
          <Button size="lg" variant="primary" className="w-full" onClick={start} disabled={starting}>
            <Play className="size-5" fill="currentColor" /> Start {DAY_LABEL[selected]}
          </Button>
        )}
      </StickyAction>
    </>
  );
}

/** Thumb-zone action bar that sits above the tab bar on phones. */
export function StickyAction({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 z-30 bg-gradient-to-t from-night via-night/90 to-transparent px-4 pb-3 pt-6 md:static md:mt-6 md:bg-none md:p-0"
      style={{ bottom: "calc(var(--tabbar-h) + var(--safe-bottom))" }}
    >
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}
