"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Field, NumberField, Segmented, TextInput, Toggle } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { logFood, logManual, logMeal, mealTotals, scaleFood } from "@/lib/db/nutrition";
import type { Food } from "@/lib/db/schema";
import { uid } from "@/lib/id";
import { cn } from "@/lib/cn";

type Tab = "foods" | "meals" | "manual";

export function AddFoodSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const [tab, setTab] = useState<Tab>("foods");
  const [picked, setPicked] = useState<Food | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title="Add food" size="lg">
      <Segmented<Tab>
        label="Add from"
        value={tab}
        onChange={(t) => {
          setTab(t);
          setPicked(null);
        }}
        size="sm"
        options={[
          { value: "foods", label: "Foods" },
          { value: "meals", label: "Saved meals" },
          { value: "manual", label: "Manual" },
        ]}
      />
      <div className="mt-4">
        {tab === "foods" &&
          (picked ? (
            <ServingPicker food={picked} date={date} onBack={() => setPicked(null)} onDone={onClose} />
          ) : (
            <FoodList onPick={setPicked} />
          ))}
        {tab === "meals" && <MealList date={date} onDone={onClose} />}
        {tab === "manual" && <ManualEntry date={date} onDone={onClose} />}
      </div>
    </Sheet>
  );
}

function FoodList({ onPick }: { onPick: (f: Food) => void }) {
  const { db } = useApp();
  const [q, setQ] = useState("");
  const foods = useLiveQuery(() => db.foods.toArray(), [db]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (foods ?? [])
      .filter((f) => !needle || f.name.toLowerCase().includes(needle) || f.tags?.some((t) => t.includes(needle)))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || (b.lastUsed ?? 0) - (a.lastUsed ?? 0) || a.name.localeCompare(b.name));
  }, [foods, q]);
  return (
    <>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fog" />
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods" className="pl-9" aria-label="Search foods" />
      </div>
      <ul className="panel divide-steel">
        {list.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onPick(f)}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gunmetal-2/40"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-base">
                  <span className="truncate">{f.name}</span>
                  {f.favorite && <Star className="size-3 shrink-0 fill-signal text-signal" aria-label="Favourite" />}
                </span>
                <span className="text-sm text-fog">{f.serving}</span>
              </span>
              <span className="text-right">
                <span className="readout block text-lg">{f.kcal}</span>
                <span className="text-xs text-fog">{f.protein}g P</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!list.length && (
        <p className="py-6 text-center text-sm text-fog">No match. Use Manual to log it, and tick &ldquo;Save as a food&rdquo;.</p>
      )}
    </>
  );
}

function ServingPicker({ food, date, onBack, onDone }: { food: Food; date: string; onBack: () => void; onDone: () => void }) {
  const { db } = useApp();
  const toast = useToast();
  const [servings, setServings] = useState<number | null>(1);
  const live = useLiveQuery(() => db.foods.get(food.id), [db, food.id]) ?? food;
  const s = scaleFood(food, servings ?? 0);
  return (
    <div className="grid gap-4">
      <div>
        <p className="font-display text-2xl font-semibold">{food.name}</p>
        <p className="text-sm text-fog">Per serving: {food.serving}</p>
      </div>
      <Field label="Servings">
        <NumberField label="Servings" value={servings} step={0.25} min={0} max={20} big onChange={setServings} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {[0.5, 1, 1.5, 2].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setServings(v)}
            className={cn(
              "h-10 rounded-full border px-4 text-sm",
              servings === v ? "border-transparent bg-signal-soft text-signal" : "border-transparent bg-white/[0.07] text-fog-2",
            )}
          >
            {v}×
          </button>
        ))}
      </div>
      <MacroLine kcal={s.kcal} p={s.protein} c={s.carbs} f={s.fat} />
      <div className="flex gap-2">
        <Button onClick={onBack}>Back</Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={!servings}
          onClick={async () => {
            const entry = await logFood(db, date, food, servings ?? 1);
            toast({ message: `Logged ${food.name}.`, action: { label: "Undo", onClick: () => db.foodLogs.delete(entry.id) } });
            onDone();
          }}
        >
          Log {s.kcal} kcal
        </Button>
      </div>
      <button
        type="button"
        onClick={() => db.foods.update(food.id, { favorite: !live.favorite })}
        className="flex items-center gap-2 text-sm text-fog hover:text-bone"
      >
        <Star className={cn("size-4", live.favorite && "fill-signal text-signal")} />
        {live.favorite ? "Remove from favourites" : "Add to favourites"}
      </button>
    </div>
  );
}

function MealList({ date, onDone }: { date: string; onDone: () => void }) {
  const { db } = useApp();
  const toast = useToast();
  const meals = useLiveQuery(() => db.meals.toArray(), [db]);
  const foods = useLiveQuery(async () => Object.fromEntries((await db.foods.toArray()).map((f) => [f.id, f])), [db]);
  if (!meals || !foods) return null;
  if (!meals.length) return <p className="py-6 text-center text-sm text-fog">No saved meals yet. Build them in Fuel → Foods & meals.</p>;
  return (
    <ul className="panel divide-steel">
      {meals.map((m) => {
        const t = mealTotals(m, foods);
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={async () => {
                const entries = await logMeal(db, date, m);
                toast({
                  message: `Logged ${m.name}.`,
                  action: { label: "Undo", onClick: () => db.foodLogs.bulkDelete(entries.map((e) => e.id)) },
                });
                onDone();
              }}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gunmetal-2/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">{m.name}</span>
                <span className="block truncate text-sm text-fog">
                  {m.items
                    .map((i) => foods[i.foodId]?.name)
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </span>
              <span className="text-right">
                <span className="readout block text-lg">{Math.round(t.kcal)}</span>
                <span className="text-xs text-fog">{Math.round(t.protein)}g P</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ManualEntry({ date, onDone }: { date: string; onDone: () => void }) {
  const { db } = useApp();
  const toast = useToast();
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState<number | null>(null);
  const [p, setP] = useState<number | null>(null);
  const [c, setC] = useState<number | null>(null);
  const [f, setF] = useState<number | null>(null);
  const [save, setSave] = useState(false);
  const [serving, setServing] = useState("");
  const fromMacros = Math.round((p ?? 0) * 4 + (c ?? 0) * 4 + (f ?? 0) * 9);

  return (
    <div className="grid gap-4">
      <Field label="What was it?">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nasi campur" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Protein (g)">
          <NumberField label="Protein grams" value={p} dense onChange={setP} max={500} />
        </Field>
        <Field label="Carbs (g)">
          <NumberField label="Carb grams" value={c} dense onChange={setC} max={1000} />
        </Field>
        <Field label="Fat (g)">
          <NumberField label="Fat grams" value={f} dense onChange={setF} max={500} />
        </Field>
        <Field label="Calories" hint={fromMacros > 0 && kcal === null ? `${fromMacros} from macros` : undefined}>
          <NumberField label="Calories" value={kcal} dense step={10} onChange={setKcal} max={10000} />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-fog-2">Save to my foods</span>
        <Toggle label="Save as a food" checked={save} onChange={setSave} />
      </div>
      {save && (
        <Field label="One serving is" hint="Type its name in Fuel later (e.g. “2 kellogs”) to log it without AI.">
          <TextInput value={serving} onChange={(e) => setServing(e.target.value)} placeholder="e.g. 1 bowl, 40 g + 200 ml milk" />
        </Field>
      )}
      <Button
        variant="primary"
        size="lg"
        disabled={!name.trim() || (kcal === null && fromMacros === 0)}
        onClick={async () => {
          const entry = {
            name: name.trim(),
            servings: 1,
            kcal: kcal ?? fromMacros,
            protein: p ?? 0,
            carbs: c ?? 0,
            fat: f ?? 0,
          };
          let foodId: string | undefined;
          if (save) {
            foodId = uid("food");
            await db.foods.put({ id: foodId, serving: serving.trim() || "1 serving", favorite: true, lastUsed: Date.now(), ...entry });
          }
          await logManual(db, date, { ...entry, foodId });
          toast({ message: `Logged ${entry.name}.` });
          onDone();
        }}
      >
        Log it
      </Button>
    </div>
  );
}

export function MacroLine({ kcal, p, c, f, className }: { kcal: number; p: number; c: number; f: number; className?: string }) {
  return (
    <p className={cn("flex flex-wrap gap-x-4 gap-y-1 text-sm text-fog", className)}>
      <span>
        <span className="readout text-xl text-bone">{Math.round(kcal)}</span> kcal
      </span>
      <span>
        <span className="readout text-xl text-bone">{Math.round(p)}</span>g protein
      </span>
      <span>
        <span className="readout text-xl text-bone">{Math.round(c)}</span>g carbs
      </span>
      <span>
        <span className="readout text-xl text-bone">{Math.round(f)}</span>g fat
      </span>
    </p>
  );
}
