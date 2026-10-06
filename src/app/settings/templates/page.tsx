"use client";

import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { Page } from "@/components/shell/page";
import { useApp, useSettings } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Field, NumberField, TextInput } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { DAY_CHOICES } from "@/components/workout/today-start";
import { ExercisePicker } from "@/components/workout/exercise-picker";
import { useExercises, useTemplates } from "@/lib/db/hooks";
import { DAY_LABEL } from "@/lib/domain/muscles";
import { seedTemplates } from "@/lib/domain/templates";
import type { DayTemplate, DayType, Exercise, TemplateSlot } from "@/lib/domain/types";
import { convert, displayStep, formatNumber, incrementFor, roundTo } from "@/lib/domain/units";
import { uid } from "@/lib/id";
import { cn } from "@/lib/cn";

export default function TemplatesPage() {
  const { db } = useApp();
  const { unit } = useSettings();
  const toast = useToast();
  const templates = useTemplates();
  const exercises = useExercises();
  const [day, setDay] = useState<DayType>("push");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (!templates || !exercises) return <Page title="Templates">{null}</Page>;
  const tpl = templates[day];

  const save = (next: DayTemplate) => db.templates.put(next);
  const updateSlot = (id: string, patch: Partial<TemplateSlot>) =>
    save({ ...tpl, slots: tpl.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const move = (i: number, dir: -1 | 1) => {
    const slots = [...tpl.slots];
    const j = i + dir;
    if (j < 0 || j >= slots.length) return;
    [slots[i], slots[j]] = [slots[j], slots[i]];
    save({ ...tpl, slots });
  };
  const editingSlot = tpl.slots.find((s) => s.id === editing);

  return (
    <Page
      title="Templates"
      subtitle="Changes apply to your next session of that day."
      actions={
        <Link href="/settings" className="mb-0.5 flex items-center gap-1 text-sm text-fog hover:text-bone">
          <ArrowLeft className="size-4" /> Settings
        </Link>
      }
    >
      <div role="tablist" aria-label="Day type" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {DAY_CHOICES.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={d === day}
            type="button"
            onClick={() => setDay(d)}
            className={cn(
              "h-10 shrink-0 rounded-[10px] border px-3.5 text-sm font-medium",
              d === day ? "border-signal bg-signal-soft text-bone" : "border-steel bg-gunmetal text-fog-2",
            )}
          >
            {DAY_LABEL[d]}
          </button>
        ))}
      </div>

      <ul className="panel divide-steel mt-5">
        {tpl.slots.map((slot, i) => {
          const ex = exercises[slot.exerciseId];
          return (
            <li key={slot.id} className="flex items-center gap-2 py-2 pl-4 pr-2">
              <button type="button" onClick={() => setEditing(slot.id)} className="min-w-0 flex-1 py-1 text-left">
                <p className="truncate text-[15px]">{ex?.name ?? slot.exerciseId}</p>
                <p className="text-sm text-fog">
                  {ex?.isConditioning
                    ? "Recovery"
                    : `${slot.sets} × ${slot.repMin === slot.repMax ? slot.repMin : `${slot.repMin}–${slot.repMax}`}${
                        slot.target
                          ? ` @ ${formatNumber(roundTo(convert(slot.target.value, slot.target.unit, unit), displayStep(unit)))} ${unit}`
                          : ""
                      }`}
                  {slot.alternates.length > 0 && ` · ${slot.alternates.length} alt`}
                </p>
              </button>
              <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${ex?.name} up`}>
                <ArrowUp className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => move(i, 1)}
                disabled={i === tpl.slots.length - 1}
                aria-label={`Move ${ex?.name} down`}
              >
                <ArrowDown className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add exercise
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            const original = seedTemplates().find((t) => t.dayType === day);
            if (!original) return;
            const prev = tpl;
            await save(original);
            toast({ message: `${DAY_LABEL[day]} reset to the original split.`, action: { label: "Undo", onClick: () => save(prev) } });
          }}
        >
          <RotateCcw className="size-4" /> Reset {DAY_LABEL[day]}
        </Button>
      </div>

      <ExercisePicker
        open={adding}
        onClose={() => setAdding(false)}
        title={`Add to ${DAY_LABEL[day]}`}
        exercises={exercises}
        onPick={async (ex) => {
          const slot: TemplateSlot = { id: uid("slot"), exerciseId: ex.id, sets: 3, repMin: 8, repMax: 12, target: null, alternates: [] };
          await save({ ...tpl, slots: [...tpl.slots, slot] });
          setAdding(false);
          setEditing(slot.id);
        }}
      />

      {editingSlot && (
        <SlotEditor
          key={editingSlot.id}
          slot={editingSlot}
          exercises={exercises}
          onClose={() => setEditing(null)}
          onChange={(patch) => updateSlot(editingSlot.id, patch)}
          onRemove={async () => {
            const prev = tpl;
            await save({ ...tpl, slots: tpl.slots.filter((s) => s.id !== editingSlot.id) });
            setEditing(null);
            toast({ message: "Removed from template.", action: { label: "Undo", onClick: () => save(prev) } });
          }}
        />
      )}
    </Page>
  );
}

function SlotEditor({
  slot,
  exercises,
  onClose,
  onChange,
  onRemove,
}: {
  slot: TemplateSlot;
  exercises: Record<string, Exercise>;
  onClose: () => void;
  onChange: (patch: Partial<TemplateSlot>) => void;
  onRemove: () => void;
}) {
  const { unit } = useSettings();
  const [picking, setPicking] = useState<"replace" | "alternate" | null>(null);
  const ex = exercises[slot.exerciseId];
  const target = slot.target ? roundTo(convert(slot.target.value, slot.target.unit, unit), displayStep(unit)) : null;

  return (
    <>
      <Sheet
        open={!picking}
        onClose={onClose}
        title={ex?.name ?? "Exercise"}
        footer={
          <div className="flex gap-2">
            <Button variant="danger" onClick={onRemove}>
              Remove
            </Button>
            <Button variant="primary" className="flex-1" onClick={onClose}>
              Done
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <Button onClick={() => setPicking("replace")}>Change exercise</Button>
          {!ex?.isConditioning && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Sets">
                  <NumberField label="Sets" value={slot.sets} min={1} max={10} dense onChange={(v) => v && onChange({ sets: v })} />
                </Field>
                <Field label="Min reps">
                  <NumberField
                    label="Minimum reps"
                    value={slot.repMin}
                    min={1}
                    max={50}
                    dense
                    onChange={(v) => v && onChange({ repMin: v, repMax: Math.max(v, slot.repMax) })}
                  />
                </Field>
                <Field label="Max reps">
                  <NumberField
                    label="Maximum reps"
                    value={slot.repMax}
                    min={1}
                    max={50}
                    dense
                    onChange={(v) => v && onChange({ repMax: v, repMin: Math.min(v, slot.repMin) })}
                  />
                </Field>
              </div>
              <Field
                label={ex?.loadMode === "assisted" ? `Starting assistance (${unit})` : `Starting weight (${unit})`}
                hint="Used until you've logged this exercise once. After that, Alfred pre-fills from your last session."
              >
                <NumberField
                  label="Starting weight"
                  value={target}
                  step={ex ? incrementFor(ex.incrementKg, unit) || displayStep(unit) : 1}
                  onChange={(v) => onChange({ target: v === null ? null : { value: v, unit } })}
                />
              </Field>
              <div>
                <p className="mb-1.5 text-sm text-fog-2">Swap options</p>
                <div className="flex flex-wrap gap-2">
                  {slot.alternates.map((id) => (
                    <span key={id} className="flex h-9 items-center gap-1 rounded-full border border-steel bg-gunmetal pl-3 pr-1 text-sm">
                      {exercises[id]?.name ?? id}
                      <button
                        type="button"
                        className="grid size-7 place-items-center rounded-full text-fog hover:text-bone"
                        aria-label={`Remove ${exercises[id]?.name}`}
                        onClick={() => onChange({ alternates: slot.alternates.filter((a) => a !== id) })}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => setPicking("alternate")}>
                    <Plus className="size-4" /> Add
                  </Button>
                </div>
              </div>
            </>
          )}
          <Field label="Note">
            <TextInput
              defaultValue={slot.note ?? ""}
              placeholder="e.g. Seat height 4"
              onBlur={(e) => onChange({ note: e.target.value || undefined })}
            />
          </Field>
        </div>
      </Sheet>
      <ExercisePicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        title={picking === "replace" ? "Change exercise" : "Add swap option"}
        exercises={exercises}
        replacing={ex}
        alternates={picking === "replace" ? slot.alternates : []}
        onPick={(picked) => {
          if (picking === "replace")
            onChange({ exerciseId: picked.id, target: null, alternates: slot.alternates.filter((a) => a !== picked.id) });
          else if (!slot.alternates.includes(picked.id)) onChange({ alternates: [...slot.alternates, picked.id] });
          setPicking(null);
        }}
      />
    </>
  );
}
