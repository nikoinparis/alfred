"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Check, Disc3, Flame, Minus, Plus, RefreshCw, Repeat2, Trash2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useApp, useSettings } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useLatestBodyweight } from "@/lib/db/hooks";
import {
  addSet,
  addWarmups,
  applyWeight,
  historyFor,
  mutateEntry,
  overloadFor,
  removeEntry,
  removeSet,
  updateSet,
  workingSetCount,
} from "@/lib/db/workouts";
import { detectPRs, warmupRamp, type OverloadAction, type PR } from "@/lib/domain/progression";
import { displayStep, displayWeight, formatNumber, formatWeight, incrementFor } from "@/lib/domain/units";
import type { Exercise, Session, SetKind, SetLog, TemplateSlot } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { useRestTimer } from "./rest-timer";
import { PlateCalculator } from "./plate-calc";
import { musclesLine } from "./exercise-picker";
import { format } from "date-fns";
import { parseISODate } from "@/lib/domain/dates";

interface Props {
  session: Session;
  entryId: string | null;
  exercises: Record<string, Exercise>;
  slot?: TemplateSlot;
  onClose: () => void;
  onSwap: (entryId: string) => void;
}

const ACTION_STYLE: Record<OverloadAction, { icon: typeof TrendingUp; tone: string; label: string }> = {
  start: { icon: Flame, tone: "text-ice", label: "First time" },
  increase: { icon: ArrowUp, tone: "text-signal", label: "Go heavier" },
  hold: { icon: Repeat2, tone: "text-fog-2", label: "Same weight" },
  reduce: { icon: ArrowDown, tone: "text-ochre", label: "Step back" },
  deload: { icon: RefreshCw, tone: "text-ochre", label: "Deload" },
};

/** Event-handler clock (kept out of render for the React purity lint). */
const timestamp = () => Date.now();

export const PR_LABEL: Record<PR["kind"], string> = {
  e1rm: "Est. 1RM",
  weight: "Heaviest",
  volume: "Volume",
};

export function ExerciseLogger({ session, entryId, exercises, slot, onClose, onSwap }: Props) {
  const entry = session.entries.find((e) => e.id === entryId) ?? null;
  const ex = entry ? exercises[entry.exerciseId] : undefined;
  return (
    <Sheet
      open={Boolean(entry && ex)}
      onClose={onClose}
      size="lg"
      title={ex?.name ?? ""}
      description={
        ex && entry ? (
          <>
            {ex.isConditioning
              ? "Recovery work"
              : `${workingSetCount(entry)} × ${entry.repMin === entry.repMax ? entry.repMin : `${entry.repMin}–${entry.repMax}`}${ex.perSide ? " per side" : ""}`}
            {!ex.isConditioning && <span className="text-fog/70"> · {musclesLine(ex)}</span>}
            {entry.swappedFromExerciseId && exercises[entry.swappedFromExerciseId] && (
              <span className="text-fog/70"> · swapped for {exercises[entry.swappedFromExerciseId].name}</span>
            )}
          </>
        ) : undefined
      }
      footer={
        entry && ex ? (
          <div className="flex gap-2">
            {!ex.isConditioning && (
              <Button variant="ghost" onClick={() => onSwap(entry.id)} aria-label="Swap exercise for today">
                <Repeat2 className="size-4" /> Swap
              </Button>
            )}
            <Button variant="primary" size="lg" className="flex-1" onClick={onClose}>
              {entry.done ? "Done" : "Back to workout"}
            </Button>
          </div>
        ) : null
      }
    >
      {entry && ex && <LoggerBody session={session} entryId={entry.id} ex={ex} slot={slot} onClose={onClose} />}
    </Sheet>
  );
}

function LoggerBody({
  session,
  entryId,
  ex,
  slot,
  onClose,
}: {
  session: Session;
  entryId: string;
  ex: Exercise;
  slot?: TemplateSlot;
  onClose: () => void;
}) {
  const { db } = useApp();
  const settings = useSettings();
  const unit = settings.unit;
  const bw = useLatestBodyweight();
  const toast = useToast();
  const rest = useRestTimer();
  const [plates, setPlates] = useState<number | null | false>(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const entry = session.entries.find((e) => e.id === entryId)!;
  const history = useLiveQuery(() => historyFor(db, ex, session.id), [db, ex, session.id]);

  if (ex.isConditioning) {
    const set = entry.sets[0];
    return (
      <div className="py-4">
        <button
          type="button"
          onClick={() => updateSet(db, session.id, entry.id, set.id, { done: !set.done, reps: 1, completedAt: timestamp() })}
          className={cn(
            "flex w-full items-center gap-4 rounded-[14px] border p-4 text-left transition-colors",
            set.done ? "border-verdigris/50 bg-verdigris/10" : "border-steel bg-gunmetal",
          )}
        >
          <span
            className={cn(
              "grid size-12 place-items-center rounded-full border-2",
              set.done ? "border-verdigris bg-verdigris text-night" : "border-steel-2",
            )}
          >
            {set.done && <Check className="size-6" strokeWidth={3} />}
          </span>
          <span className="text-[15px]">{set.done ? "Done. Nice work." : "Tap when done"}</span>
        </button>
      </div>
    );
  }

  const plannedSets = slot?.sets ?? workingSetCount(entry);
  const suggestion = history ? overloadFor(ex, entry, plannedSets, history, slot?.target ?? null, unit, bw) : null;
  const last = history?.[history.length - 1];
  const firstWorking = entry.sets.find((s) => s.kind === "working");
  const workingWeight = firstWorking?.weight != null ? displayWeight(firstWorking.weight, firstWorking.unit, unit) : null;
  const warmups =
    ex.compound && workingWeight && ex.loadMode === "total" ? warmupRamp(workingWeight, unit, ex.equipment, ex.incrementKg) : [];
  const hasWarmups = entry.sets.some((s) => s.kind === "warmup");
  const step = Math.min(incrementFor(ex.incrementKg, unit), unit === "kg" ? 2.5 : 5) || displayStep(unit);
  const weightLabel = ex.loadMode === "assisted" ? "Assist" : ex.loadMode === "bodyweight" ? "Added" : unit;

  let workingIndex = 0;

  const markDone = async (set: SetLog) => {
    const nowDone = !set.done;
    if (nowDone && (set.reps === null || set.reps <= 0)) {
      toast({ message: "Enter your reps first.", tone: "danger" });
      return;
    }
    await updateSet(db, session.id, entry.id, set.id, { done: nowDone, completedAt: nowDone ? timestamp() : undefined });
    if (!nowDone) return;
    if (settings.haptics) navigator.vibrate?.(15);
    if (set.kind !== "drop" && set.kind !== "warmup") {
      const secs = ex.compound ? settings.restSeconds : settings.restSecondsIsolation;
      rest.start(secs, ex.name);
    }
    if (history?.length && set.kind !== "warmup") {
      const after = { ...entry, sets: entry.sets.map((s) => (s.id === set.id ? { ...s, done: true } : s)) };
      const before = { ...entry, sets: entry.sets.filter((s) => s.done) };
      const prsNow = detectPRs(after, history, ex, bw);
      const prsBefore = new Set(detectPRs(before, history, ex, bw).map((p) => p.kind));
      const fresh = prsNow.filter((p) => !prsBefore.has(p.kind) && p.kind !== "volume");
      if (fresh.length) {
        const p = fresh[0];
        toast({
          tone: "signal",
          duration: 4500,
          message: (
            <span>
              <span className="font-semibold text-signal">New PR.</span> {PR_LABEL[p.kind]} {formatWeight(p.value, "kg", unit)}
              <span className="text-fog"> (was {formatWeight(p.previous, "kg", unit)})</span>
            </span>
          ),
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      {suggestion && (
        <SuggestionCard
          action={suggestion.action}
          reason={suggestion.reason}
          weight={suggestion.weight}
          reps={suggestion.reps}
          unit={unit}
          onApply={
            suggestion.weight !== null && suggestion.action !== "hold"
              ? () => applyWeight(db, session.id, entry.id, suggestion.weight!, suggestion.reps, unit)
              : undefined
          }
        />
      )}

      {last && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
          <span className="text-fog">Last time, {format(parseISODate(last.date), "EEE d MMM")}:</span>
          {last.entry.sets
            .filter((s) => s.done && s.kind !== "warmup")
            .map((s) => (
              <span
                key={s.id}
                className={cn(
                  "rounded-md border border-steel px-1.5 py-0.5 readout text-[15px]",
                  s.kind === "drop" && "border-dashed text-fog-2",
                )}
              >
                {s.weight !== null ? formatNumber(displayWeight(s.weight, s.unit, unit)) : "BW"}×{s.reps}
              </span>
            ))}
        </div>
      )}

      {warmups.length > 0 && !hasWarmups && (
        <div className="flex items-center gap-3 rounded-[12px] border border-dashed border-steel-2 px-3 py-2.5">
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-fog-2">Warm-up ramp</p>
            <p className="readout mt-0.5 truncate text-[17px] text-fog">
              {warmups.map((w) => `${formatNumber(w.weight)}×${w.reps}`).join("  ")}
            </p>
          </div>
          <Button size="sm" onClick={() => addWarmups(db, session.id, entry.id, warmups, unit)}>
            Add
          </Button>
        </div>
      )}

      <div>
        <div className="mb-1.5 grid grid-cols-[30px_1fr_104px_48px] gap-2 px-0.5 text-xs text-fog">
          <span>Set</span>
          <span className="text-center">{weightLabel}</span>
          <span className="text-center">Reps{ex.perSide ? "/side" : ""}</span>
          <span />
        </div>
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {entry.sets.map((set) => {
              const label = set.kind === "warmup" ? "W" : set.kind === "drop" ? "D" : String(++workingIndex);
              const weight = set.weight === null ? null : displayWeight(set.weight, set.unit, unit);
              return (
                <motion.li
                  key={set.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className={cn(set.kind === "drop" && "pl-5")}
                >
                  <div
                    className={cn(
                      "grid items-center gap-2",
                      set.kind === "drop" ? "grid-cols-[30px_1fr_104px_48px]" : "grid-cols-[30px_1fr_104px_48px]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenRow(openRow === set.id ? null : set.id)}
                      className={cn(
                        "readout grid h-12 place-items-center rounded-[10px] text-xl font-semibold",
                        set.kind === "warmup"
                          ? "text-fog"
                          : set.kind === "failure"
                            ? "text-crimson"
                            : set.kind === "drop"
                              ? "text-ice"
                              : "text-fog-2",
                        openRow === set.id && "bg-gunmetal-2",
                      )}
                      aria-label={`Set ${label} options`}
                      aria-expanded={openRow === set.id}
                    >
                      {set.kind === "failure" ? "F" : label}
                    </button>
                    <NumberField
                      label={`Set ${label} weight`}
                      value={weight}
                      dense
                      step={step}
                      placeholder={ex.loadMode === "bodyweight" ? "BW" : "–"}
                      onChange={(v) => updateSet(db, session.id, entry.id, set.id, { weight: v, unit })}
                      className={cn(set.done && "border-transparent bg-gunmetal-2/60")}
                    />
                    <NumberField
                      label={`Set ${label} reps`}
                      value={set.reps}
                      dense
                      step={1}
                      max={100}
                      onChange={(v) => updateSet(db, session.id, entry.id, set.id, { reps: v })}
                      className={cn(set.done && "border-transparent bg-gunmetal-2/60")}
                    />
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      onClick={() => markDone(set)}
                      className={cn(
                        "grid size-12 place-items-center rounded-full border-2 transition-colors",
                        set.done
                          ? "border-signal bg-signal text-signal-ink"
                          : "border-steel-2 text-steel-2 hover:border-fog hover:text-fog",
                      )}
                      aria-label={set.done ? `Undo set ${label}` : `Complete set ${label}`}
                      aria-pressed={set.done}
                    >
                      <Check className="size-6" strokeWidth={3} />
                    </motion.button>
                  </div>
                  {openRow === set.id && (
                    <SetOptions
                      set={set}
                      onKind={(kind) => updateSet(db, session.id, entry.id, set.id, { kind })}
                      onRpe={(rpe) => updateSet(db, session.id, entry.id, set.id, { rpe })}
                      onDelete={() => {
                        removeSet(db, session.id, entry.id, set.id);
                        setOpenRow(null);
                      }}
                      onPlates={ex.equipment === "barbell" ? () => setPlates(weight) : undefined}
                    />
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Button size="sm" onClick={() => addSet(db, session.id, entry.id, "working", unit, ex.incrementKg)}>
            <Plus className="size-4" /> Add set
          </Button>
          <Button size="sm" onClick={() => addSet(db, session.id, entry.id, "drop", unit, ex.incrementKg)}>
            <Minus className="size-4" /> Drop set
          </Button>
          {ex.equipment === "barbell" && (
            <Button size="sm" variant="ghost" className="col-span-2 sm:col-span-1" onClick={() => setPlates(workingWeight)}>
              <Disc3 className="size-4" /> Plates
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-fog">Tap a set number for warm-up, failure, RPE or delete.</p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm text-fog-2">Notes</span>
        <textarea
          defaultValue={entry.note ?? ""}
          onBlur={(e) => mutateEntry(db, session.id, entry.id, (en) => void (en.note = e.target.value || undefined))}
          rows={2}
          placeholder="Seat 4, grip, how it felt…"
          className="w-full resize-none rounded-[12px] border border-steel bg-night/60 px-3 py-2.5 text-[15px] outline-none placeholder:text-fog/60 focus:border-signal/60"
        />
      </label>

      <button
        type="button"
        onClick={async () => {
          await removeEntry(db, session.id, entry.id);
          onClose();
          toast({ message: `Removed ${ex.name} from today.` });
        }}
        className="flex items-center gap-2 text-sm text-fog hover:text-[#f0a49e]"
      >
        <Trash2 className="size-4" /> Remove from today
      </button>

      <PlateCalculator open={plates !== false} onClose={() => setPlates(false)} initial={plates === false ? null : plates} unit={unit} />
    </div>
  );
}

function SetOptions({
  set,
  onKind,
  onRpe,
  onDelete,
  onPlates,
}: {
  set: SetLog;
  onKind: (k: SetKind) => void;
  onRpe: (r: number | null) => void;
  onDelete: () => void;
  onPlates?: () => void;
}) {
  const kinds: { k: SetKind; label: string }[] =
    set.kind === "drop"
      ? []
      : [
          { k: "warmup", label: "Warm-up" },
          { k: "working", label: "Working" },
          { k: "failure", label: "To failure" },
        ];
  return (
    <div className="mt-2 rounded-[12px] border border-steel bg-night/50 p-2.5">
      {kinds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {kinds.map(({ k, label }) => (
            <Chip key={k} active={set.kind === k} onClick={() => onKind(k)}>
              {label}
            </Chip>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-fog">RPE</span>
        {[6, 7, 8, 9, 10].map((r) => (
          <Chip key={r} active={set.rpe === r} onClick={() => onRpe(set.rpe === r ? null : r)}>
            {r}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {onPlates && (
          <Button size="sm" variant="ghost" onClick={onPlates}>
            <Disc3 className="size-4" /> Plates
          </Button>
        )}
        <Button size="sm" variant="danger" onClick={onDelete} className="ml-auto">
          <Trash2 className="size-4" /> Delete set
        </Button>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 min-w-9 rounded-full border px-3 text-sm transition-colors",
        active ? "border-signal bg-signal-soft text-signal" : "border-steel text-fog-2 hover:border-steel-2",
      )}
    >
      {children}
    </button>
  );
}

export function SuggestionCard({
  action,
  reason,
  weight,
  reps,
  unit,
  onApply,
}: {
  action: OverloadAction;
  reason: string;
  weight: number | null;
  reps: number;
  unit: string;
  onApply?: () => void;
}) {
  const style = ACTION_STYLE[action];
  const Icon = style.icon;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[14px] border px-3.5 py-3",
        action === "increase" ? "border-signal/40 bg-signal-soft" : "border-steel bg-gunmetal/60",
      )}
    >
      <div className={cn("grid size-10 shrink-0 place-items-center rounded-full bg-night/60", style.tone)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", style.tone)}>
          {style.label}
          {weight !== null && (
            <span className="readout ml-2 text-lg text-bone">
              {formatNumber(weight)} {unit} × {reps}
            </span>
          )}
        </p>
        <p className="text-sm leading-snug text-fog-2">{reason}</p>
      </div>
      {onApply && (
        <Button size="sm" variant={action === "increase" ? "primary" : "secondary"} onClick={onApply}>
          Use
        </Button>
      )}
    </div>
  );
}
