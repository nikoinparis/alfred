"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { Camera, ChevronLeft, ChevronRight, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp, useSettings } from "@/components/providers/app-provider";
import { AddFoodSheet, MacroLine } from "@/components/fuel/add-food-sheet";
import { BodyweightCard } from "@/components/fuel/bodyweight-card";
import { MacroRings } from "@/components/fuel/macro-rings";
import { PhotoMacrosSheet } from "@/components/fuel/photo-macros";
import { WeeklySummary } from "@/components/fuel/weekly-summary";
import { Page, SectionTitle } from "@/components/shell/page";
import { Button, buttonVariants } from "@/components/ui/button";
import { NumberField } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useLatestBodyweight, useToday } from "@/lib/db/hooks";
import { logFood, resolveTargets, sumLogs } from "@/lib/db/nutrition";
import type { FoodLog } from "@/lib/db/schema";
import { addDays, parseISODate } from "@/lib/domain/dates";
import { cn } from "@/lib/cn";

export default function FuelPage() {
  const { db } = useApp();
  const settings = useSettings();
  const toast = useToast();
  const t = useToday();
  const bw = useLatestBodyweight();
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const date = addDays(t, offset);

  const dayLogs = useLiveQuery(() => db.foodLogs.where("date").equals(date).sortBy("createdAt"), [db, date]);
  const weekLogs = useLiveQuery(() => db.foodLogs.where("date").between(addDays(date, -6), date, true, true).toArray(), [db, date]);
  // Booleans aren't valid IndexedDB keys, so filter favourites in memory (the food list is small).
  const quick = useLiveQuery(
    async () =>
      (await db.foods.toArray())
        .filter((f) => f.favorite)
        .sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0))
        .slice(0, 10),
    [db],
  );

  const { targets, source } = resolveTargets(settings, bw);
  const totals = sumLogs(dayLogs ?? []);
  const label = offset === 0 ? "Today" : offset === -1 ? "Yesterday" : format(parseISODate(date), "EEE d MMM");

  return (
    <Page title="Fuel" subtitle={format(parseISODate(date), "EEEE d MMMM")}>
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => setOffset((o) => o - 1)} aria-label="Previous day">
          <ChevronLeft className="size-5" />
        </Button>
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => setOffset(0)}
          className={cn("flex-1 text-center text-sm", offset === 0 ? "text-fog" : "text-signal")}
        >
          {offset === 0 ? label : `${label} · back to today`}
        </button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset === 0}
          aria-label="Next day"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {source === "fallback" && (
        <Link href="/fuel/goals" className="panel mt-3 flex items-center gap-3 border-signal/40 p-3.5 hover:border-signal">
          <Target className="size-5 shrink-0 text-signal" />
          <span className="min-w-0 flex-1 text-sm">
            <span className="text-bone">Set your goal</span>
            <span className="text-fog"> to get calorie and macro targets built from your stats. Using placeholders for now.</span>
          </span>
          <ChevronRight className="size-4 text-fog" />
        </Link>
      )}

      <div className="mt-3">
        <MacroRings totals={totals} targets={targets} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="primary" size="lg" onClick={() => setAdding(true)}>
          <Plus className="size-5" /> Add food
        </Button>
        <Button size="lg" onClick={() => setPhoto(true)}>
          <Camera className="size-5" /> Snap a meal
        </Button>
      </div>

      {quick && quick.length > 0 && (
        <>
          <SectionTitle>Quick add</SectionTitle>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            {quick.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={async () => {
                  const entry = await logFood(db, date, f, 1);
                  toast({ message: `Logged ${f.name}.`, action: { label: "Undo", onClick: () => db.foodLogs.delete(entry.id) } });
                }}
                className="flex h-14 shrink-0 flex-col items-start justify-center rounded-[12px] border border-steel bg-gunmetal px-3.5 text-left hover:border-steel-2 active:scale-[0.97]"
              >
                <span className="max-w-40 truncate text-sm">{f.name}</span>
                <span className="text-xs text-fog">
                  {f.kcal} kcal · {f.protein}g P
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <SectionTitle
        action={
          <Link href="/fuel/foods" className="text-sm text-fog hover:text-bone">
            Foods & meals
          </Link>
        }
      >
        {label}&apos;s log
      </SectionTitle>
      {dayLogs && dayLogs.length > 0 ? (
        <ul className="panel divide-steel">
          {dayLogs.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setEditing(l)}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gunmetal-2/40"
              >
                <span className="w-11 shrink-0 text-xs text-fog">{format(new Date(l.createdAt), "HH:mm")}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[15px]">
                    <span className="truncate">{l.name}</span>
                    {l.source === "photo" && <Sparkles className="size-3.5 shrink-0 text-ice" aria-label="From photo" />}
                  </span>
                  <span className="text-xs text-fog">
                    {l.servings !== 1 && `${l.servings}× · `}
                    {Math.round(l.protein)}P · {Math.round(l.carbs)}C · {Math.round(l.fat)}F
                  </span>
                </span>
                <span className="readout text-xl">{l.kcal}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="panel px-5 py-8 text-center">
          <p className="text-[15px]">Nothing logged {offset === 0 ? "yet today" : "this day"}.</p>
          <p className="mt-1 text-sm text-fog">Tap a quick-add food, or snap a photo of your plate.</p>
        </div>
      )}

      <SectionTitle>Bodyweight</SectionTitle>
      <BodyweightCard date={date} />

      <SectionTitle
        action={
          <Link href="/fuel/goals" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-mr-2")}>
            Goal & check-in
          </Link>
        }
      >
        Last 7 days
      </SectionTitle>
      {weekLogs && <WeeklySummary logs={weekLogs} endDate={date} targets={targets} />}

      <AddFoodSheet open={adding} onClose={() => setAdding(false)} date={date} />
      <PhotoMacrosSheet open={photo} onClose={() => setPhoto(false)} date={date} />
      <EditLogSheet log={editing} onClose={() => setEditing(null)} />
    </Page>
  );
}

function EditLogSheet({ log, onClose }: { log: FoodLog | null; onClose: () => void }) {
  const { db } = useApp();
  const toast = useToast();
  const [servings, setServings] = useState<number | null>(null);
  const [seen, setSeen] = useState<string | null>(null);
  if (log && seen !== log.id) {
    setSeen(log.id);
    setServings(log.servings);
  }
  if (!log)
    return (
      <Sheet open={false} onClose={onClose} title="">
        {null}
      </Sheet>
    );
  const ratio = servings && log.servings ? servings / log.servings : 1;
  const scaled = { kcal: Math.round(log.kcal * ratio), p: log.protein * ratio, c: log.carbs * ratio, f: log.fat * ratio };

  return (
    <Sheet
      open
      onClose={onClose}
      title={log.name}
      description={log.source === "photo" && log.kcalRange ? `Photo estimate: ${log.kcalRange[0]}–${log.kcalRange[1]} kcal` : undefined}
      footer={
        <div className="flex gap-2">
          <Button
            variant="danger"
            onClick={async () => {
              await db.foodLogs.delete(log.id);
              onClose();
              toast({ message: "Removed.", action: { label: "Undo", onClick: () => db.foodLogs.put(log) } });
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={!servings}
            onClick={async () => {
              await db.foodLogs.update(log.id, {
                servings: servings ?? log.servings,
                kcal: scaled.kcal,
                protein: Math.round(scaled.p * 10) / 10,
                carbs: Math.round(scaled.c * 10) / 10,
                fat: Math.round(scaled.f * 10) / 10,
              });
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <label>
          <span className="mb-1.5 block text-sm text-fog-2">Servings</span>
          <NumberField label="Servings" value={servings} step={0.25} min={0} max={20} big onChange={setServings} />
        </label>
        <MacroLine kcal={scaled.kcal} p={scaled.p} c={scaled.c} f={scaled.f} />
      </div>
    </Sheet>
  );
}
