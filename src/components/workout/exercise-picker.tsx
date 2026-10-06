"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { TextInput } from "@/components/ui/controls";
import { MUSCLE_META } from "@/lib/domain/muscles";
import type { Exercise } from "@/lib/domain/types";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  exercises: Record<string, Exercise>;
  title: string;
  /** Exercise being replaced: its alternates and same-muscle lifts float to the top. */
  replacing?: Exercise;
  alternates?: string[];
}

export function musclesLine(e: Exercise) {
  return e.primary.map((m) => MUSCLE_META[m].label).join(", ") || "Conditioning";
}

export function ExercisePicker({ open, onClose, onPick, exercises, title, replacing, alternates = [] }: Props) {
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const all = Object.values(exercises).filter((e) => !e.archived && e.id !== replacing?.id);
    const needle = q.trim().toLowerCase();
    const match = (e: Exercise) =>
      !needle || e.name.toLowerCase().includes(needle) || e.primary.some((m) => MUSCLE_META[m].label.toLowerCase().includes(needle));
    const suggested = alternates.map((id) => exercises[id]).filter((e): e is Exercise => Boolean(e) && match(e));
    const similar = replacing
      ? all.filter((e) => !alternates.includes(e.id) && e.primary.some((m) => replacing.primary.includes(m)) && match(e))
      : [];
    const used = new Set([...suggested, ...similar].map((e) => e.id));
    const rest = all.filter((e) => !used.has(e.id) && match(e)).sort((a, b) => a.name.localeCompare(b.name));
    return [
      { label: "Your alternates", items: suggested },
      { label: "Same muscles", items: similar },
      { label: replacing ? "Everything else" : "All exercises", items: rest },
    ].filter((g) => g.items.length);
  }, [exercises, q, replacing, alternates]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={replacing ? `Instead of ${replacing.name}, for today only.` : undefined}
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fog" />
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or muscle"
          className="pl-9"
          aria-label="Search exercises"
        />
      </div>
      {groups.map((g) => (
        <div key={g.label} className="mb-4">
          <p className="mb-1.5 text-sm text-fog">{g.label}</p>
          <ul className="panel divide-steel">
            {g.items.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(e);
                    setQ("");
                  }}
                  className={cn("flex min-h-14 w-full flex-col items-start justify-center px-4 py-2.5 text-left hover:bg-gunmetal-2/60")}
                >
                  <span className="text-[15px]">{e.name}</span>
                  <span className="text-sm text-fog">{musclesLine(e)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!groups.length && (
        <p className="py-8 text-center text-sm text-fog">No exercise matches &ldquo;{q}&rdquo;. Add it in Settings → Exercise library.</p>
      )}
    </Sheet>
  );
}
