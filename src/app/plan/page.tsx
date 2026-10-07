"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
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
import type { DayLog, DayType } from "@/lib/domain/types";
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
    if (compareDates(date, t) < 0) return { kind: "missed" };
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

      <ol className="mt-3 grid gap-2 md:grid-cols-7">
        {dates.map((date) => {
          const st = stateFor(date);
          const isToday = date === t;
          return (
            <li key={date}>
              <DayCard
                date={date}
                state={st}
                isToday={isToday}
                onOpen={() => setEditing(date)}
                onAccept={st.kind === "ghost" ? () => setDay(date, st.suggestion.dayType, "planned") : undefined}
              />
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ghosts.length > 1 && (
          <Button
            variant="primary"
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
            date={editing}
            state={editingState}
            isPast={compareDates(editing, t) < 0}
            prevType={stateType(stateFor(addDays(editing, -1)))}
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

function DayCard({
  date,
  state,
  isToday,
  onOpen,
  onAccept,
}: {
  date: string;
  state: DayState;
  isToday: boolean;
  onOpen: () => void;
  onAccept?: () => void;
}) {
  const d = parseISODate(date);
  const label =
    state.kind === "done" || state.kind === "planned" || state.kind === "skipped"
      ? DAY_LABEL[state.dayType]
      : state.kind === "ghost"
        ? DAY_LABEL[state.suggestion.dayType]
        : state.kind === "missed"
          ? "Missed"
          : "–";
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
            ? "Suggested"
            : state.kind === "missed"
              ? "Nothing logged"
              : "";

  return (
    <div
      className={cn(
        "relative flex min-h-[64px] items-center gap-3 rounded-[12px] border px-3 py-2 md:min-h-[140px] md:flex-col md:items-start md:gap-2 md:p-3",
        state.kind === "done" && state.dayType !== "rest" && "border-transparent bg-gunmetal-2",
        state.kind === "done" && state.dayType === "rest" && "border-transparent bg-gunmetal",
        state.kind === "planned" && "border-transparent bg-gunmetal",
        state.kind === "ghost" && "border-dashed border-white/15 bg-transparent",
        (state.kind === "missed" || state.kind === "skipped" || state.kind === "empty") && "border-separator bg-transparent",
        isToday && "ring-1 ring-signal/70",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 rounded-[12px]"
        aria-label={`${format(d, "EEEE")}: ${label}, ${meta}. Edit`}
      />
      <div className="pointer-events-none w-11 shrink-0 text-center md:w-auto md:text-left">
        <p className={cn("text-xs", isToday ? "text-signal" : "text-fog")}>{isToday ? "Today" : format(d, "EEE")}</p>
        <p className="readout text-2xl font-semibold">{format(d, "d")}</p>
      </div>
      <div className="pointer-events-none min-w-0 flex-1">
        <p
          className={cn(
            "font-display text-xl font-semibold tracking-wide",
            state.kind === "ghost" && "text-fog-2",
            (state.kind === "missed" || state.kind === "skipped") && "text-fog line-through decoration-steel-2",
            state.kind === "done" && state.dayType !== "rest" && "text-bone",
          )}
        >
          {label}
        </p>
        <p className="text-xs text-fog">{meta}</p>
      </div>
      {state.kind === "done" && state.dayType !== "rest" && (
        <span className="pointer-events-none grid size-7 place-items-center rounded-full bg-signal text-signal-ink md:absolute md:right-3 md:top-3">
          <Check className="size-4" strokeWidth={3} />
        </span>
      )}
      <AnimatePresence>
        {onAccept && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            type="button"
            onClick={onAccept}
            className="relative z-[1] h-9 shrink-0 rounded-full bg-signal-soft px-4 text-sm font-semibold text-signal active:opacity-70 md:mt-auto md:w-full"
          >
            Accept
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function DayEditor({
  state,
  isPast,
  prevType,
  onPick,
  onSkip,
  onClear,
}: {
  date: string;
  state: DayState;
  isPast: boolean;
  prevType: DayType | null;
  onPick: (d: DayType) => void;
  onSkip: (d: DayType) => void;
  onClear: () => void;
}) {
  const current = stateType(state);
  const skippable = state.kind === "planned" || state.kind === "ghost";
  return (
    <div className="grid gap-4">
      <div>
        <p className="mb-2 text-sm text-fog-2">{isPast ? "What did you do?" : "Plan this day as"}</p>
        <div className="grid grid-cols-3 gap-2">
          {DAY_CHOICES.map((d) => {
            const clash = conflicts(prevType, d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onPick(d)}
                className={cn(
                  "flex h-14 flex-col items-center justify-center rounded-[12px] border text-base font-medium",
                  d === current ? "border-transparent bg-signal-soft text-signal" : "border-transparent bg-white/[0.07] text-fog-2",
                )}
              >
                {DAY_LABEL[d]}
                {clash && <span className="text-[11px] font-normal text-ochre">overlaps day before</span>}
              </button>
            );
          })}
        </div>
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
