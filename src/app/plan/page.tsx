"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { Check, ChevronLeft, ChevronRight, Flame, Info } from "lucide-react";
import { useState } from "react";
import { useApp, useSettings } from "@/components/providers/app-provider";
import { Page, SectionTitle } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { DAY_CHOICES } from "@/components/workout/today-start";
import { useExercises, useToday } from "@/lib/db/hooks";
import { addDays, compareDates, parseISODate, startOfWeek, weekDates } from "@/lib/domain/dates";
import { DAY_LABEL } from "@/lib/domain/muscles";
import { conflicts, suggestPlan, type Suggestion } from "@/lib/domain/planner";
import { weekStreak, weeklyReview } from "@/lib/domain/review";
import type { DayLog, DayType, Exercise } from "@/lib/domain/types";
import { DayWorks } from "@/components/workout/muscle-info";
import { formatNumber } from "@/lib/domain/units";
import { cn } from "@/lib/cn";

type DayState =
  | { kind: "done"; dayType: DayType; sets: number }
  | { kind: "planned"; dayType: DayType }
  | { kind: "skipped"; dayType: DayType }
  | { kind: "missed" }
  | { kind: "ghost"; suggestion: Suggestion }
  | { kind: "empty" };

export default function PlanPage() {
  const { db } = useApp();
  const settings = useSettings();
  const toast = useToast();
  const t = useToday();
  const exercises = useExercises();
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const weekStart = addDays(startOfWeek(t), offset * 7);
  const dates = weekDates(weekStart);
  const weekEnd = dates[6];

  const logs = useLiveQuery(() => db.dayLogs.where("date").between(addDays(t, -120), addDays(t, 60), true, true).toArray(), [db, t]);
  const sessions = useLiveQuery(
    () => db.sessions.where("date").between(weekStart, weekEnd, true, true).toArray(),
    [db, weekStart, weekEnd],
  );

  // Only the current and future weeks get suggestions, always planned forward from today.
  const suggestions =
    logs && compareDates(weekEnd, t) >= 0 ? suggestPlan({ today: t, until: weekEnd, logs, maxConsecutive: settings.maxConsecutive }) : [];

  if (!logs || !sessions || !exercises) return <Page title="Plan">{null}</Page>;

  const logByDate = new Map(logs.map((l) => [l.date, l]));
  const firstLogged = logs
    .filter((l) => l.status === "done")
    .map((l) => l.date)
    .sort()[0];
  const sugByDate = new Map(suggestions.map((s) => [s.date, s]));

  const stateFor = (date: string): DayState => {
    const log = logByDate.get(date);
    if (log?.status === "done") {
      const sets = sessions
        .filter((s) => s.date === date)
        .reduce((a, s) => a + s.entries.reduce((b, e) => b + e.sets.filter((x) => x.done && x.kind !== "warmup").length, 0), 0);
      return { kind: "done", dayType: log.dayType, sets };
    }
    if (log?.status === "skipped") return { kind: "skipped", dayType: log.dayType };
    if (log?.status === "planned" && compareDates(date, t) >= 0) return { kind: "planned", dayType: log.dayType };
    const sug = sugByDate.get(date);
    if (sug) return { kind: "ghost", suggestion: sug };
    // Before your first logged day nothing was "missed"; you just hadn't started yet.
    if (compareDates(date, t) < 0) return firstLogged && compareDates(date, firstLogged) >= 0 ? { kind: "missed" } : { kind: "empty" };
    return { kind: "empty" };
  };

  const setDay = async (date: string, dayType: DayType, status: DayLog["status"]) => {
    await db.dayLogs.put({ date, dayType, status });
  };
  const ghosts = dates.map((d) => stateFor(d)).filter((s): s is Extract<DayState, { kind: "ghost" }> => s.kind === "ghost");
  const review = weeklyReview(sessions, exercises);
  const streak = weekStreak(logs, t);
  const editingState = editing ? stateFor(editing) : null;

  return (
    <Page title="Plan" subtitle={`Week of ${format(parseISODate(weekStart), "d MMMM")}`}>
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => setOffset((o) => o - 1)} aria-label="Previous week">
          <ChevronLeft className="size-5" />
        </Button>
        <button
          type="button"
          onClick={() => setOffset(0)}
          className={cn("flex-1 text-center text-sm", offset === 0 ? "text-fog" : "text-signal")}
          disabled={offset === 0}
        >
          {offset === 0
            ? "This week"
            : offset > 0
              ? `${offset} week${offset > 1 ? "s" : ""} ahead · back to this week`
              : `${-offset} week${offset < -1 ? "s" : ""} ago · back to this week`}
        </button>
        <Button size="icon" variant="ghost" onClick={() => setOffset((o) => o + 1)} aria-label="Next week">
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <ol className="panel mt-3 py-2">
        {dates.map((date, i) => {
          const st = stateFor(date);
          return (
            <DayRow
              key={date}
              date={date}
              state={st}
              isToday={date === t}
              first={i === 0}
              last={i === dates.length - 1}
              onOpen={() => setEditing(date)}
              onAccept={st.kind === "ghost" ? () => setDay(date, st.suggestion.dayType, "planned") : undefined}
            />
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ghosts.length > 1 && (
          <Button
            variant="tinted"
            onClick={async () => {
              await db.dayLogs.bulkPut(
                ghosts.map((g) => ({ date: g.suggestion.date, dayType: g.suggestion.dayType, status: "planned" as const })),
              );
              toast({ message: `Planned ${ghosts.length} days.` });
            }}
          >
            <Check className="size-4" /> Accept all suggestions
          </Button>
        )}
        <Button variant="ghost" onClick={() => setRulesOpen(true)}>
          <Info className="size-4" /> How suggestions work
        </Button>
      </div>

      <SectionTitle>{offset === 0 ? "This week so far" : "Week review"}</SectionTitle>
      <div className="panel p-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat value={String(review.trainingDays)} label="training days" />
          <Stat value={String(review.hardSets)} label="working sets" />
          <Stat
            value={String(streak)}
            label={streak === 1 ? "week streak" : "week streak"}
            icon={streak > 0 ? <Flame className="size-4 text-signal" /> : undefined}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-separator pt-4">
          <Balance label="Push vs pull" a={review.pushSets} b={review.pullSets} aLabel="push" bLabel="pull" />
          <Balance label="Quads vs hams" a={review.quadSets} b={review.hamstringSets} aLabel="quads" bLabel="hams" />
        </div>
        {review.notes.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-separator pt-3 text-sm text-fog-2">
            {review.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-fog">Streak counts weeks with at least 4 training days.</p>
      </div>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? format(parseISODate(editing), "EEEE d MMMM") : ""}
        description={
          editingState?.kind === "ghost"
            ? editingState.suggestion.reason
            : editingState?.kind === "done"
              ? "Logged. Start or edit the workout from Today."
              : undefined
        }
      >
        {editing && editingState && (
          <DayEditor
            key={editing}
            date={editing}
            state={editingState}
            isPast={compareDates(editing, t) < 0}
            prevType={stateType(stateFor(addDays(editing, -1)))}
            exercises={exercises}
            onPick={async (d) => {
              await setDay(editing, d, compareDates(editing, t) < 0 ? "done" : "planned");
              setEditing(null);
            }}
            onSkip={async (d) => {
              await setDay(editing, d, "skipped");
              setEditing(null);
              toast({ message: "Skipped. The rest of the week is re-planned." });
            }}
            onClear={async () => {
              await db.dayLogs.delete(editing);
              setEditing(null);
            }}
          />
        )}
      </Sheet>

      <Sheet open={rulesOpen} onClose={() => setRulesOpen(false)} title="How suggestions work">
        <ol className="list-decimal space-y-2.5 pl-5 text-base leading-relaxed text-fog-2">
          <li>
            Your split is two blocks: Push, Pull and Legs in any order, then Upper and Lower in either order. Finishing a block earns a rest
            day.
          </li>
          <li>
            Alfred follows what you actually trained. Start with Legs and it suggests Push and Pull next; do Lower first and Upper is next,
            not rest.
          </li>
          <li>Missed or skipped days count as rest. Days you still owe in a block stay owed.</li>
          <li>Never more than {settings.maxConsecutive} training days in a row, counting days you&apos;ve already planned.</li>
          <li>
            Never the same muscle group on back-to-back days (Upper overlaps Push and Pull; Legs and Lower overlap). If the next pick would
            clash, it takes another day from the block.
          </li>
          <li>Suggestions are ghosts until you accept them. Pick any day type on the day itself and everything after re-plans.</li>
        </ol>
      </Sheet>
    </Page>
  );
}

function stateType(s: DayState): DayType | null {
  if (s.kind === "done" || s.kind === "planned") return s.dayType;
  if (s.kind === "ghost") return s.suggestion.dayType;
  return null;
}

/**
 * One day on the week timeline. The rail node encodes state: filled = done, solid ring = planned,
 * dashed ring = suggested (tap it to accept), faint = missed or skipped.
 */
function DayRow({
  date,
  state,
  isToday,
  first,
  last,
  onOpen,
  onAccept,
}: {
  date: string;
  state: DayState;
  isToday: boolean;
  first: boolean;
  last: boolean;
  onOpen: () => void;
  onAccept?: () => void;
}) {
  const d = parseISODate(date);
  const type = stateType(state);
  const label = type ? DAY_LABEL[type] : state.kind === "missed" ? "Missed" : "—";
  const meta =
    state.kind === "done"
      ? state.dayType === "rest"
        ? "Rested"
        : `Done · ${state.sets} sets`
      : state.kind === "planned"
        ? "Planned"
        : state.kind === "skipped"
          ? "Skipped"
          : state.kind === "ghost"
            ? state.suggestion.reason
            : state.kind === "missed"
              ? "Nothing logged"
              : "";
  const faded = state.kind === "missed" || state.kind === "skipped" || state.kind === "empty";

  return (
    <li className="relative">
      <button type="button" onClick={onOpen} className="pressable flex w-full items-stretch gap-3 px-4 text-left">
        <span className="w-10 shrink-0 py-3 text-center">
          <span className={cn("block text-xs font-semibold", isToday ? "text-signal" : "text-fog")}>
            {isToday ? "Today" : format(d, "EEE")}
          </span>
          <span className={cn("readout block text-2xl font-semibold", faded && "text-fog")}>{format(d, "d")}</span>
        </span>
        <span className="relative flex w-6 shrink-0 justify-center" aria-hidden>
          <span className={cn("absolute w-px bg-white/10", first ? "top-1/2" : "top-0", last ? "bottom-1/2" : "bottom-0")} />
          <span
            className={cn(
              "relative mt-[22px] size-3.5 rounded-full",
              state.kind === "done" && "bg-signal",
              state.kind === "planned" && "border-2 border-signal bg-night",
              state.kind === "ghost" && "border-2 border-dashed border-signal/70 bg-night",
              faded && "border-2 border-white/15 bg-night",
            )}
          />
        </span>
        <span className="min-w-0 flex-1 py-3">
          <span
            className={cn(
              "block font-display text-[22px] font-semibold leading-tight tracking-wide",
              faded && "text-fog",
              (state.kind === "missed" || state.kind === "skipped") && "line-through decoration-white/20",
              state.kind === "ghost" && "text-fog-2",
            )}
          >
            {label}
          </span>
          <span className="line-clamp-2 text-sm text-fog">{meta}</span>
        </span>
        {state.kind === "done" && state.dayType !== "rest" && (
          <span className="grid size-11 shrink-0 self-center place-items-center text-signal">
            <Check className="size-5" strokeWidth={2.5} />
          </span>
        )}
        {onAccept && <span className="size-11 shrink-0" aria-hidden />}
      </button>
      {onAccept && (
        <button
          type="button"
          onClick={onAccept}
          aria-label={`Accept ${label} for ${format(d, "EEEE")}`}
          className="group absolute right-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full active:scale-95"
        >
          <span className="grid size-8 place-items-center rounded-full border-2 border-dashed border-signal/60 text-signal/70 transition-colors group-hover:border-solid group-hover:border-signal group-hover:bg-signal group-hover:text-signal-ink">
            <Check className="size-4" strokeWidth={2.5} />
          </span>
        </button>
      )}
    </li>
  );
}

function DayEditor({
  state,
  isPast,
  prevType,
  exercises,
  onPick,
  onSkip,
  onClear,
}: {
  date: string;
  state: DayState;
  isPast: boolean;
  prevType: DayType | null;
  exercises: Record<string, Exercise>;
  onPick: (d: DayType) => void;
  onSkip: (d: DayType) => void;
  onClear: () => void;
}) {
  const current = stateType(state);
  const [preview, setPreview] = useState<DayType>(current ?? "push");
  const skippable = state.kind === "planned" || state.kind === "ghost";
  const committed = (state.kind === "planned" || state.kind === "done") && current === preview;
  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="Day type" className="grid grid-cols-3 gap-2">
        {DAY_CHOICES.map((d) => {
          const clash = conflicts(prevType, d);
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={d === preview}
              onClick={() => setPreview(d)}
              className={cn(
                "flex h-14 flex-col items-center justify-center rounded-[14px] text-base font-semibold transition-colors active:scale-[0.97]",
                d === preview ? "bg-signal text-signal-ink" : "bg-white/[0.07] text-fog-2",
              )}
            >
              {DAY_LABEL[d]}
              {clash && (
                <span className={cn("text-[11px] font-normal", d === preview ? "text-white/80" : "text-ochre")}>overlaps day before</span>
              )}
            </button>
          );
        })}
      </div>

      <Button variant="primary" size="lg" disabled={committed} onClick={() => onPick(preview)}>
        {committed
          ? `${DAY_LABEL[preview]} is ${isPast ? "logged" : "planned"}`
          : isPast
            ? `Log as ${DAY_LABEL[preview]}`
            : state.kind === "ghost" && current === preview
              ? `Accept ${DAY_LABEL[preview]}`
              : `Plan ${DAY_LABEL[preview]}`}
      </Button>

      <div>
        <p className="mb-2 px-1 text-sm font-semibold text-fog">What {DAY_LABEL[preview]} trains</p>
        <DayWorks key={preview} dayType={preview} exercises={exercises} />
      </div>

      <div className="flex flex-wrap gap-2">
        {skippable && current && (
          <Button variant="secondary" onClick={() => onSkip(current)}>
            Skip this day
          </Button>
        )}
        {(state.kind === "planned" || state.kind === "skipped" || (state.kind === "done" && state.dayType === "rest")) && (
          <Button variant="ghost" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, icon }: { value: string; label: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="readout flex items-center gap-1 text-[34px] font-semibold">
        {value}
        {icon}
      </p>
      <p className="text-xs text-fog">{label}</p>
    </div>
  );
}

function Balance({ label, a, b, aLabel, bLabel }: { label: string; a: number; b: number; aLabel: string; bLabel: string }) {
  const total = a + b;
  const pct = total ? (a / total) * 100 : 50;
  return (
    <div>
      <p className="text-xs text-fog">{label}</p>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-steel" aria-hidden>
        <div className="h-full bg-fog-2" style={{ width: `${pct}%` }} />
        <div className="h-full w-[2px] bg-kevlar" />
        <div className="h-full flex-1 bg-steel-2" />
      </div>
      <p className="mt-1.5 flex justify-between text-xs">
        <span className="text-fog-2">
          {formatNumber(Math.round(a * 10) / 10)} {aLabel}
        </span>
        <span className="text-fog">
          {formatNumber(Math.round(b * 10) / 10)} {bLabel}
        </span>
      </p>
    </div>
  );
}
