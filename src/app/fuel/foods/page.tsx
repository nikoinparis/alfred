"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Plus, Search, Star, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { Page, SectionTitle } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Field, NumberField, Segmented, TextInput, Toggle } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { mealTotals } from "@/lib/db/nutrition";
import type { Food, SavedMeal } from "@/lib/db/schema";
import { uid } from "@/lib/id";
import { cn } from "@/lib/cn";

type Tab = "foods" | "meals";

export default function FoodsPage() {
  const { db } = useApp();
  const [tab, setTab] = useState<Tab>("foods");
  const [q, setQ] = useState("");
  const [food, setFood] = useState<Food | null>(null);
  const [meal, setMeal] = useState<SavedMeal | null>(null);
  const foods = useLiveQuery(() => db.foods.toArray(), [db]);
  const meals = useLiveQuery(() => db.meals.toArray(), [db]);
  const byId = useMemo(() => Object.fromEntries((foods ?? []).map((f) => [f.id, f])), [foods]);

  const list = (foods ?? [])
    .filter((f) => !q.trim() || f.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));

  return (
    <Page
      title="Foods & meals"
      actions={
        <Link href="/fuel" className="mb-0.5 flex items-center gap-1 text-sm text-fog hover:text-bone">
          <ArrowLeft className="size-4" /> Fuel
        </Link>
      }
    >
      <Segmented<Tab>
        label="Library"
        value={tab}
        onChange={setTab}
        options={[
          { value: "foods", label: `Foods (${foods?.length ?? 0})` },
          { value: "meals", label: `Saved meals (${meals?.length ?? 0})` },
        ]}
      />

      {tab === "foods" ? (
        <>
          <div className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fog" />
              <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-9" aria-label="Search foods" />
            </div>
            <Button
              variant="primary"
              onClick={() =>
                setFood({ id: uid("food"), name: "", serving: "1 serving", kcal: 0, protein: 0, carbs: 0, fat: 0, favorite: true })
              }
            >
              <Plus className="size-4" /> New
            </Button>
          </div>
          <p className="mt-2 text-xs text-fog">
            Starred foods appear in Quick add. Indonesian staples are pre-loaded with typical values; edit them to match your warung.
          </p>
          <ul className="panel divide-steel mt-3">
            {list.map((f) => (
              <li key={f.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => db.foods.update(f.id, { favorite: !f.favorite })}
                  className="grid size-12 shrink-0 place-items-center"
                  aria-label={f.favorite ? `Unstar ${f.name}` : `Star ${f.name}`}
                  aria-pressed={f.favorite}
                >
                  <Star className={cn("size-4", f.favorite ? "fill-signal text-signal" : "text-steel-2")} />
                </button>
                <button
                  type="button"
                  onClick={() => setFood(f)}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{f.name}</span>
                    <span className="text-xs text-fog">
                      {f.serving} · {f.protein}P {f.carbs}C {f.fat}F
                    </span>
                  </span>
                  <span className="readout text-xl">{f.kcal}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <Button variant="primary" className="mt-4" onClick={() => setMeal({ id: uid("meal"), name: "", items: [] })}>
            <Plus className="size-4" /> New saved meal
          </Button>
          {meals && meals.length > 0 ? (
            <ul className="panel divide-steel mt-3">
              {meals.map((m) => {
                const t = mealTotals(m, byId);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setMeal(m)}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gunmetal-2/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px]">{m.name}</span>
                        <span className="block truncate text-xs text-fog">
                          {m.items
                            .map((i) => byId[i.foodId]?.name)
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </span>
                      <span className="readout text-xl">{Math.round(t.kcal)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-fog">Bundle what you eat together (say, rice + ayam bakar + tempe) and log it in one tap.</p>
          )}
        </>
      )}

      {food && <FoodEditor key={food.id} initial={food} isNew={!byId[food.id]} onClose={() => setFood(null)} />}
      {meal && <MealEditor key={meal.id} initial={meal} foods={foods ?? []} onClose={() => setMeal(null)} />}
    </Page>
  );
}

function FoodEditor({ initial, isNew, onClose }: { initial: Food; isNew: boolean; onClose: () => void }) {
  const { db } = useApp();
  const toast = useToast();
  const [f, setF] = useState(initial);
  const set = (p: Partial<Food>) => setF((x) => ({ ...x, ...p }));
  const fromMacros = Math.round(f.protein * 4 + f.carbs * 4 + f.fat * 9);
  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? "New food" : "Edit food"}
      footer={
        <div className="flex gap-2">
          {!isNew && (
            <Button
              variant="danger"
              onClick={async () => {
                await db.foods.delete(f.id);
                onClose();
                toast({ message: `Deleted ${f.name}.`, action: { label: "Undo", onClick: () => db.foods.put(initial) } });
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            variant="primary"
            className="flex-1"
            disabled={!f.name.trim()}
            onClick={async () => {
              await db.foods.put({ ...f, name: f.name.trim() });
              onClose();
            }}
          >
            Save food
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Field label="Name">
          <TextInput value={f.name} onChange={(e) => set({ name: e.target.value })} autoFocus={isNew} />
        </Field>
        <Field label="Serving">
          <TextInput value={f.serving} onChange={(e) => set({ serving: e.target.value })} placeholder="e.g. 1 plate (300 g)" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Protein (g)">
            <NumberField label="Protein" value={f.protein} dense onChange={(v) => set({ protein: v ?? 0 })} />
          </Field>
          <Field label="Carbs (g)">
            <NumberField label="Carbs" value={f.carbs} dense onChange={(v) => set({ carbs: v ?? 0 })} />
          </Field>
          <Field label="Fat (g)">
            <NumberField label="Fat" value={f.fat} dense onChange={(v) => set({ fat: v ?? 0 })} />
          </Field>
          <Field label="Calories" hint={fromMacros && Math.abs(fromMacros - f.kcal) > 25 ? `Macros add up to ${fromMacros}` : undefined}>
            <NumberField label="Calories" value={f.kcal} dense step={10} onChange={(v) => set({ kcal: v ?? 0 })} />
          </Field>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-fog-2">Show in Quick add</span>
          <Toggle label="Show in Quick add" checked={f.favorite} onChange={(favorite) => set({ favorite })} />
        </div>
      </div>
    </Sheet>
  );
}

function MealEditor({ initial, foods, onClose }: { initial: SavedMeal; foods: Food[]; onClose: () => void }) {
  const { db } = useApp();
  const [m, setM] = useState(initial);
  const [q, setQ] = useState("");
  const byId = Object.fromEntries(foods.map((f) => [f.id, f]));
  const t = mealTotals(m, byId);
  const matches = q.trim() ? foods.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];

  return (
    <Sheet
      open
      onClose={onClose}
      title={initial.name ? "Edit meal" : "New saved meal"}
      footer={
        <div className="flex gap-2">
          {initial.name && (
            <Button
              variant="danger"
              onClick={async () => {
                await db.meals.delete(m.id);
                onClose();
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            variant="primary"
            className="flex-1"
            disabled={!m.name.trim() || !m.items.length}
            onClick={async () => {
              await db.meals.put({ ...m, name: m.name.trim() });
              onClose();
            }}
          >
            Save meal · {Math.round(t.kcal)} kcal
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Field label="Name">
          <TextInput value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} placeholder="e.g. Post-gym lunch" />
        </Field>
        <div>
          <p className="mb-1.5 text-sm text-fog-2">Items</p>
          {m.items.length > 0 && (
            <ul className="panel divide-steel mb-3">
              {m.items.map((it, i) => (
                <li key={`${it.foodId}-${i}`} className="flex items-center gap-2 py-2 pl-4 pr-2">
                  <span className="min-w-0 flex-1 truncate text-[15px]">{byId[it.foodId]?.name ?? "Deleted food"}</span>
                  <NumberField
                    label="Servings"
                    value={it.servings}
                    step={0.25}
                    dense
                    className="w-32"
                    onChange={(v) => setM({ ...m, items: m.items.map((x, j) => (j === i ? { ...x, servings: v ?? 1 } : x)) })}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove item"
                    onClick={() => setM({ ...m, items: m.items.filter((_, j) => j !== i) })}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods to add" aria-label="Search foods to add" />
          {matches.length > 0 && (
            <ul className="mt-2 grid gap-1">
              {matches.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setM({ ...m, items: [...m.items, { foodId: f.id, servings: 1 }] });
                      setQ("");
                    }}
                    className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-sm hover:bg-gunmetal-2"
                  >
                    <Plus className="size-4 text-fog" />
                    <span className="flex-1">{f.name}</span>
                    <span className="text-fog">{f.kcal} kcal</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <SectionTitle className="mt-0">Totals</SectionTitle>
        <p className="text-sm text-fog-2">
          {Math.round(t.kcal)} kcal · {Math.round(t.protein)}g protein · {Math.round(t.carbs)}g carbs · {Math.round(t.fat)}g fat
        </p>
      </div>
    </Sheet>
  );
}
