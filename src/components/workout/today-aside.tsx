"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { useApp, useSettings } from "@/components/providers/app-provider";
import { useExercises, useLatestBodyweight } from "@/lib/db/hooks";
import { resolveTargets, sumLogs } from "@/lib/db/nutrition";
import { addDays, parseISODate, startOfWeek, weekDates } from "@/lib/domain/dates";
import { DAY_LABEL, MUSCLE_META } from "@/lib/domain/muscles";
import { suggestPlan } from "@/lib/domain/planner";
import { volumeStatus, weeklyMuscleVolume } from "@/lib/domain/volume";
import { MUSCLES } from "@/lib/domain/types";
import { cn } from "@/lib/cn";

/** Desktop-only command panel next to the workout: week strip, fuel, muscle coverage. */
export function TodayAside({ date }: { date: string }) {
  const { db } = useApp();
  const settings = useSettings();
  const bw = useLatestBodyweight();
  const exercises = useExercises();
  const week = weekDates(date);
  const data = useLiveQuery(async () => {
    const logs = await db.dayLogs.where("date").between(addDays(date, -42), week[6], true, true).toArray();
    const sessions = await db.sessions.where("date").between(week[0], week[6], true, true).toArray();
    const food = await db.foodLogs.where("date").equals(date).toArray();
    const targets = await db.muscleTargets.toArray();
    return { logs, sessions, food, targets };
  }, [db, date]);
  if (!data || !exercises) return null;

  const suggestions = new Map(
    suggestPlan({ today: date, until: week[6], logs: data.logs, maxConsecutive: settings.maxConsecutive }).map((s) => [s.date, s]),
  );
  const logByDate = new Map(data.logs.map((l) => [l.date, l]));
  const totals = sumLogs(data.food);
  const { targets } = resolveTargets(settings, bw);
  const volume = weeklyMuscleVolume(data.sessions, exercises);
  const targetOf = Object.fromEntries(data.targets.map((t) => [t.muscle, t.sets]));
  const behind = MUSCLES.filter((m) => volumeStatus(volume[m].sets, targetOf[m] ?? MUSCLE_META[m].defaultTarget) !== "hit")
    .sort((a, b) => volume[a].sets / (targetOf[a] ?? 10) - volume[b].sets / (targetOf[b] ?? 10))
    .slice(0, 4);
  const hit =
    MUSCLES.length - MUSCLES.filter((m) => volumeStatus(volume[m].sets, targetOf[m] ?? MUSCLE_META[m].defaultTarget) !== "hit").length;

  return (
    <aside className="hidden space-y-4 lg:block">
      <Card title={`Week of ${format(parseISODate(startOfWeek(date)), "d MMM")}`} href="/plan">
        <ol className="grid grid-cols-7 gap-1">
          {week.map((d) => {
            const log = logByDate.get(d);
            const sug = suggestions.get(d);
            const type = log && log.status !== "skipped" ? log.dayType : sug?.dayType;
            const done = log?.status === "done";
            return (
              <li
                key={d}
                className={cn(
                  "flex flex-col items-center rounded-[8px] border py-2",
                  done ? "border-steel-2 bg-gunmetal-2" : sug ? "border-dashed border-steel-2" : "border-steel/60",
                  d === date && "ring-1 ring-signal/70",
                )}
              >
                <span className="text-[10px] text-fog">{format(parseISODate(d), "EEEEE")}</span>
                <span
                  className={cn(
                    "mt-0.5 font-display text-[13px] font-semibold",
                    !done && "text-fog-2",
                    log?.status === "skipped" && "line-through",
                  )}
                >
                  {type ? DAY_LABEL[type].slice(0, 4) : "–"}
                </span>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card title="Fuel today" href="/fuel">
        <div className="flex items-end justify-between">
          <div>
            <p className="readout text-[40px] font-semibold">{Math.max(0, Math.round(targets.kcal - totals.kcal))}</p>
            <p className="text-xs text-fog">kcal left of {targets.kcal}</p>
          </div>
          <div className="text-right">
            <p className="readout text-[28px] font-semibold">
              {Math.round(totals.protein)}
              <span className="text-base text-fog">/{targets.protein}g</span>
            </p>
            <p className="text-xs text-fog">protein</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-steel">
          <div
            className="h-full rounded-full bg-signal"
            style={{ width: `${Math.min(100, (totals.kcal / Math.max(1, targets.kcal)) * 100)}%` }}
          />
        </div>
      </Card>

      <Card title={`Muscles at target: ${hit}/${MUSCLES.length}`} href="/body">
        {behind.length ? (
          <ul className="space-y-2">
            {behind.map((m) => {
              const t = targetOf[m] ?? MUSCLE_META[m].defaultTarget;
              return (
                <li key={m} className="flex items-center gap-3 text-sm">
                  <span className="w-28 truncate text-fog-2">{MUSCLE_META[m].label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-steel">
                    <span
                      className={cn("block h-full rounded-full", volume[m].sets > 0 ? "bg-ochre" : "bg-crimson")}
                      style={{ width: `${Math.max(4, (volume[m].sets / t) * 100)}%` }}
                    />
                  </span>
                  <span className="readout w-12 text-right">
                    {volume[m].sets}/{t}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-fog-2">Every muscle group is at target this week.</p>
        )}
      </Card>
    </aside>
  );
}

function Card({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="panel p-4">
      <Link href={href} className="mb-3 flex items-center justify-between text-sm text-fog-2 hover:text-bone">
        {title}
        <ChevronRight className="size-4" />
      </Link>
      {children}
    </section>
  );
}
