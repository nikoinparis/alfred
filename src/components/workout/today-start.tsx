"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { ArrowUp, BedDouble, Play } from "lucide-react";
import { useState } from "react";
import { useApp, useSettings } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { historyFor, latestBodyweightKg, logRestDay, overloadFor, startSession } from "@/lib/db/workouts";
import { DAY_LABEL } from "@/lib/domain/muscles";
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
  const recommended = planned?.dayType ?? suggestion?.dayType ?? "push";
  const [selected, setSelected] = useState<DayType>(recommended);
  const [starting, setStarting] = useState(false);
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

  const start = async () => {
    setStarting(true);
    try {
      await startSession(db, date, selected);
    } finally {
      setStarting(false);
    }
  };

  const reason =
    selected === recommended
      ? planned
        ? "You planned this one."
        : suggestion?.reason
      : `Off-plan is fine. The planner will re-plan the rest of the week around ${DAY_LABEL[selected]}.`;

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
              onClick={() => setSelected(d)}
              className={cn(
                "relative h-11 shrink-0 rounded-full border px-4 text-base font-semibold transition-colors",
                active
                  ? "border-transparent bg-signal-soft text-signal"
                  : "border-transparent bg-white/[0.07] text-fog-2 hover:bg-white/[0.1]",
              )}
            >
              {DAY_LABEL[d]}
              {d === recommended && (
                <span
                  className={cn("absolute right-1.5 top-1.5 size-1.5 rounded-full", active ? "bg-signal" : "bg-fog")}
                  aria-label="Suggested"
                />
              )}
            </button>
          );
        })}
      </div>

      <motion.section
        key={selected}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6"
      >
        <h2 className="readout text-[84px] font-bold uppercase leading-[0.8] tracking-tight md:text-[112px]">{DAY_LABEL[selected]}</h2>
        {reason && <p className="mt-3 max-w-md text-base text-fog-2">{reason}</p>}

        <ul className="panel divide-steel mt-6">
          {template?.slots.map((slot, i) => {
            const p = previews?.[i];
            const ex = exercises[slot.exerciseId];
            const s = p?.suggestion;
            return (
              <li key={slot.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base">{ex?.name ?? slot.exerciseId}</p>
                  <p className="text-sm text-fog">
                    {ex?.isConditioning
                      ? "Recovery"
                      : `${slot.sets} × ${slot.repMin === slot.repMax ? slot.repMin : `${slot.repMin}–${slot.repMax}`}${ex?.perSide ? " per side" : ""}`}
                    {slot.note ? ` · ${slot.note}` : ""}
                  </p>
                </div>
                {s?.weight != null && (
                  <div className="text-right">
                    <p
                      className={cn(
                        "readout flex items-center justify-end gap-1 text-[22px] font-semibold",
                        s.action === "increase" && "text-signal",
                      )}
                    >
                      {s.action === "increase" && <ArrowUp className="size-4" strokeWidth={2.5} />}
                      {formatNumber(s.weight)}
                      <span className="text-sm font-normal text-fog">{s.unit}</span>
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </motion.section>

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
