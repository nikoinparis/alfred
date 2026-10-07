"use client";

import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Page } from "@/components/shell/page";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Field, NumberField, TextInput, Toggle } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { musclesLine } from "@/components/workout/exercise-picker";
import { useExercises } from "@/lib/db/hooks";
import { MUSCLE_META } from "@/lib/domain/muscles";
import { MUSCLES, type Equipment, type Exercise, type LoadMode, type Muscle } from "@/lib/domain/types";
import { uid } from "@/lib/id";
import { cn } from "@/lib/cn";

const EQUIPMENT: Equipment[] = ["barbell", "dumbbell", "cable", "machine", "bodyweight", "other"];
const LOAD_MODES: { value: LoadMode; label: string; hint: string }[] = [
  { value: "total", label: "Total load", hint: "The number you log is the whole weight (both dumbbells together)." },
  { value: "assisted", label: "Assisted", hint: "The number is assistance; less is harder." },
  { value: "bodyweight", label: "Bodyweight", hint: "Optional added weight on top of you." },
];

export default function ExerciseLibraryPage() {
  const { db } = useApp();
  const exercises = useExercises();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Exercise | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return Object.values(exercises ?? {})
      .filter((e) => !needle || e.name.toLowerCase().includes(needle) || musclesLine(e).toLowerCase().includes(needle))
      .sort((a, b) => Number(Boolean(a.archived)) - Number(Boolean(b.archived)) || a.name.localeCompare(b.name));
  }, [exercises, q]);

  return (
    <Page title="Exercise library" subtitle="Primary muscles count 1 set, secondary 0.5." back={{ href: "/settings", label: "Settings" }}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fog" />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-9" aria-label="Search exercises" />
        </div>
        <Button
          variant="primary"
          onClick={() =>
            setEditing({
              id: uid("ex"),
              name: "",
              primary: [],
              secondary: [],
              equipment: "dumbbell",
              loadMode: "total",
              incrementKg: 2.5,
              compound: false,
            })
          }
        >
          <Plus className="size-4" /> New
        </Button>
      </div>
      <ul className="panel divide-steel mt-4">
        {list.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => setEditing(e)}
              className={cn(
                "flex min-h-14 w-full flex-col justify-center px-4 py-2.5 text-left hover:bg-gunmetal-2/40",
                e.archived && "opacity-50",
              )}
            >
              <span className="text-base">
                {e.name}
                {e.archived && <span className="ml-2 text-xs text-fog">hidden</span>}
              </span>
              <span className="text-sm text-fog">
                {musclesLine(e)}
                {e.secondary.length > 0 && (
                  <span className="text-fog/70"> + {e.secondary.map((m) => MUSCLE_META[m].label).join(", ")}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {editing && (
        <ExerciseEditor
          key={editing.id}
          initial={editing}
          isNew={!exercises?.[editing.id]}
          onClose={() => setEditing(null)}
          onSave={async (e) => {
            await db.exercises.put(e);
            setEditing(null);
          }}
        />
      )}
    </Page>
  );
}

function ExerciseEditor({
  initial,
  isNew,
  onClose,
  onSave,
}: {
  initial: Exercise;
  isNew: boolean;
  onClose: () => void;
  onSave: (e: Exercise) => void;
}) {
  const [e, setE] = useState<Exercise>(initial);
  const set = (patch: Partial<Exercise>) => setE((x) => ({ ...x, ...patch }));
  const cycleMuscle = (m: Muscle) => {
    // Tap cycles: none → primary → secondary → none.
    if (e.primary.includes(m)) set({ primary: e.primary.filter((x) => x !== m), secondary: [...e.secondary, m] });
    else if (e.secondary.includes(m)) set({ secondary: e.secondary.filter((x) => x !== m) });
    else set({ primary: [...e.primary, m] });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? "New exercise" : "Edit exercise"}
      footer={
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="ghost" onClick={() => onSave({ ...e, archived: !e.archived })}>
              {e.archived ? "Show again" : "Hide"}
            </Button>
          )}
          <Button variant="primary" className="flex-1" disabled={!e.name.trim()} onClick={() => onSave({ ...e, name: e.name.trim() })}>
            Save exercise
          </Button>
        </div>
      }
    >
      <div className="grid gap-5">
        <Field label="Name">
          <TextInput
            value={e.name}
            onChange={(ev) => set({ name: ev.target.value })}
            placeholder="e.g. Machine Shoulder Press"
            autoFocus={isNew}
          />
        </Field>
        <div>
          <p className="mb-1 text-sm text-fog-2">Muscles</p>
          <p className="mb-2 text-xs text-fog">Tap once for primary, twice for secondary, again to clear.</p>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLES.map((m) => {
              const role = e.primary.includes(m) ? "primary" : e.secondary.includes(m) ? "secondary" : null;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => cycleMuscle(m)}
                  className={cn(
                    "h-9 rounded-full border px-3 text-sm transition-colors",
                    role === "primary" && "border-signal bg-signal text-signal-ink",
                    role === "secondary" && "border-signal/60 bg-signal-soft text-signal",
                    !role && "border-transparent bg-white/[0.07] text-fog-2",
                  )}
                >
                  {MUSCLE_META[m].label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm text-fog-2">Equipment</p>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => set({ equipment: q })}
                className={cn(
                  "h-9 rounded-full border px-3 text-sm capitalize",
                  e.equipment === q ? "border-transparent bg-signal-soft text-signal" : "border-transparent bg-white/[0.07] text-fog-2",
                )}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm text-fog-2">What the logged number means</p>
          <div className="grid gap-1.5">
            {LOAD_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => set({ loadMode: m.value })}
                className={cn(
                  "rounded-[12px] border px-3 py-2.5 text-left",
                  e.loadMode === m.value ? "border-transparent bg-signal-soft ring-1 ring-signal/60" : "border-transparent bg-white/[0.05]",
                )}
              >
                <p className="text-base">{m.label}</p>
                <p className="text-xs text-fog">{m.hint}</p>
              </button>
            ))}
          </div>
        </div>
        <Field label="Smallest jump (kg)" hint="What the overload suggestion adds, e.g. 2.5 for a barbell, 4 for a pair of dumbbells.">
          <NumberField
            label="Increment in kg"
            value={e.incrementKg}
            step={0.5}
            min={0}
            max={50}
            onChange={(v) => set({ incrementKg: v ?? 0 })}
          />
        </Field>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-base">Compound lift</p>
            <p className="text-xs text-fog">Longer rest and a warm-up ramp.</p>
          </div>
          <Toggle label="Compound lift" checked={e.compound} onChange={(compound) => set({ compound })} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-base">Reps per side</p>
            <p className="text-xs text-fog">Lunges, split squats, single-arm work.</p>
          </div>
          <Toggle label="Reps per side" checked={Boolean(e.perSide)} onChange={(perSide) => set({ perSide })} />
        </div>
      </div>
    </Sheet>
  );
}
