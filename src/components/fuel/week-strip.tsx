"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { sumLogs } from "@/lib/db/nutrition";
import { addDays, compareDates, parseISODate, startOfWeek, weekDates } from "@/lib/domain/dates";
import { cn } from "@/lib/cn";

/**
 * Mon–Sun strip for Fuel: each day shows what you ate against the target, and tapping a day opens it.
 * Arrows page by week.
 */
export function WeekStrip({
  date,
  today,
  target,
  onSelect,
}: {
  date: string;
  today: string;
  target: number;
  onSelect: (date: string) => void;
}) {
  const { db } = useApp();
  const days = weekDates(date);
  const logs = useLiveQuery(() => db.foodLogs.where("date").between(days[0], days[6], true, true).toArray(), [db, days[0]]);
  const kcal = (d: string) => Math.round(sumLogs((logs ?? []).filter((l) => l.date === d)).kcal);
  const thisWeek = startOfWeek(today) === days[0];
  const range = `${format(parseISODate(days[0]), "d MMM")} – ${format(parseISODate(days[6]), "d MMM")}`;

  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onSelect(addDays(days[0], -7))}
          className="grid size-10 place-items-center rounded-full text-signal active:scale-95"
          aria-label="Previous week"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          disabled={thisWeek && date === today}
          onClick={() => onSelect(today)}
          className={cn("flex-1 text-center text-sm", thisWeek && date === today ? "text-fog" : "text-signal")}
        >
          {thisWeek ? "This week" : range}
          {date !== today && <span className="text-fog-2">, back to today</span>}
        </button>
        <button
          type="button"
          disabled={thisWeek}
          onClick={() => onSelect(compareDates(addDays(days[0], 7), today) > 0 ? today : addDays(days[0], 7))}
          className="grid size-10 place-items-center rounded-full text-signal active:scale-95 disabled:text-fog/40"
          aria-label="Next week"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const future = compareDates(d, today) > 0;
          const k = kcal(d);
          const pct = Math.min(1, k / Math.max(1, target));
          const hit = k >= target * 0.95;
          const selected = d === date;
          return (
            <button
              key={d}
              type="button"
              disabled={future}
              onClick={() => onSelect(d)}
              aria-pressed={selected}
              aria-label={`${format(parseISODate(d), "EEEE d MMMM")}: ${k ? `${k} kcal` : "nothing logged"}`}
              className={cn(
                "flex flex-col items-center gap-1 rounded-[14px] px-0.5 pb-2 pt-1.5 transition-colors active:scale-[0.97]",
                selected ? "bg-signal-soft ring-1 ring-signal/50" : "bg-white/[0.03]",
                future && "opacity-35",
              )}
            >
              <span className={cn("text-[11px]", selected ? "text-signal" : "text-fog")}>{format(parseISODate(d), "EEEEE")}</span>
              <span className={cn("readout text-lg leading-none", d === today ? "text-signal" : "text-bone")}>
                {format(parseISODate(d), "d")}
              </span>
              <span className="h-1 w-8 overflow-hidden rounded-full bg-steel" aria-hidden>
                <span className={cn("block h-full rounded-full", hit ? "bg-signal" : "bg-fog/70")} style={{ width: `${pct * 100}%` }} />
              </span>
              <span className={cn("readout text-[11px] leading-none", k ? "text-fog-2" : "text-fog/50")}>{k || "–"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
