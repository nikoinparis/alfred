"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { addWeeks, format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { useApp, useSettings } from "@/components/providers/app-provider";
import { goalProgress, PRESETS, weightTrend, type MacroTargets } from "@/lib/domain/nutrition";
import { convert, formatNumber, roundTo } from "@/lib/domain/units";

const PHASE_LABEL = { bulk: "Lean bulk", cut: "Cut", recomp: "Recomp", maintain: "Maintain" } as const;

/** Where you are on the way to the goal weight: start → trend → target, with today's targets. */
export function GoalCard({ targets }: { targets: MacroTargets }) {
  const { db } = useApp();
  const settings = useSettings();
  const weights = useLiveQuery(() => db.bodyweights.orderBy("date").toArray(), [db]);
  const goal = settings.goal;
  if (!goal || !weights?.length) return null;

  const unit = settings.unit;
  const show = (kg: number) => formatNumber(roundTo(convert(kg, "kg", unit), 0.1));
  const trend = weightTrend(weights);
  const now = trend[trend.length - 1].trend;
  const startKg = weights[0].kg;
  const target = goal.targetWeightKg;
  const progress = goalProgress(now, goal);
  const span = target ? target - startKg : 0;
  const pct = target && span !== 0 ? Math.min(1, Math.max(0, (now - startKg) / span)) : goal.phase === "maintain" ? 1 : 0;

  return (
    <Link href="/fuel/goals" className="panel pressable relative block overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(80%_80%_at_100%_0%,rgb(58_134_255_/_0.14),transparent)]" />
      <div className="relative flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-signal">
            {PRESETS[goal.preset].label} · {PHASE_LABEL[goal.phase]}
          </p>
          <p className="mt-1 text-sm text-fog-2">
            {progress
              ? progress.reached
                ? "Target reached. Time to switch to maintenance."
                : `${show(Math.abs(progress.remainingKg))} ${unit} to go${progress.weeksLeft ? ` · ~${format(addWeeks(new Date(), progress.weeksLeft), "MMM yyyy")}` : ""}`
              : goal.phase === "maintain"
                ? "Holding your weight. Eat to target and keep training hard."
                : "Set a target weight to see your timeline."}
          </p>
        </div>
        <ChevronRight className="mt-0.5 size-5 shrink-0 text-fog/60" />
      </div>

      {target && goal.phase !== "maintain" && (
        <div className="relative mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full bg-signal" style={{ width: `${Math.max(3, pct * 100)}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-fog">
            <span>
              Start <span className="readout text-sm text-fog-2">{show(startKg)}</span>
            </span>
            <span>
              Now <span className="readout text-sm text-bone">{show(now)}</span>
            </span>
            <span>
              Goal <span className="readout text-sm text-signal">{show(target)}</span> {unit}
            </span>
          </div>
        </div>
      )}

      <div className="relative mt-4 grid grid-cols-4 gap-2 border-t border-separator pt-3 text-center">
        {(
          [
            ["kcal", targets.kcal, ""],
            ["protein", targets.protein, "g"],
            ["carbs", targets.carbs, "g"],
            ["fat", targets.fat, "g"],
          ] as const
        ).map(([label, v, u]) => (
          <div key={label}>
            <p className="readout text-xl font-semibold">
              {v}
              <span className="text-xs font-normal text-fog">{u}</span>
            </p>
            <p className="text-[11px] text-fog">{label}/day</p>
          </div>
        ))}
      </div>
    </Link>
  );
}
