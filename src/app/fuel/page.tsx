"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { ChevronRight, Sparkles, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp, useSettings } from "@/components/providers/app-provider";
import { AddFoodSheet, MacroLine } from "@/components/fuel/add-food-sheet";
import { BodyweightCard } from "@/components/fuel/bodyweight-card";
import { GoalCard } from "@/components/fuel/goal-card";
import { MacroRings } from "@/components/fuel/macro-rings";
import { PhotoMacrosSheet, type MealStart } from "@/components/fuel/photo-macros";
import { FoodComposer } from "@/components/fuel/food-composer";
import { WeeklySummary } from "@/components/fuel/weekly-summary";
import { WeekStrip } from "@/components/fuel/week-strip";
import { Page, SectionTitle } from "@/components/shell/page";
import { Button, buttonVariants } from "@/components/ui/button";
import { NumberField } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useLatestBodyweight, useToday } from "@/lib/db/hooks";
import { resolveTargets, sumLogs } from "@/lib/db/nutrition";
import type { FoodLog } from "@/lib/db/schema";
import { addDays, daysBetween, parseISODate } from "@/lib/domain/dates";
import { cn } from "@/lib/cn";

export default function FuelPage() {
  const { db } = useApp();
  const settings = useSettings();
  const t = useToday();
  const bw = useLatestBodyweight();
  const [picked, setPicked] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [meal, setMeal] = useState<{ key: number; start: MealStart } | null>(null);
  const openMeal = (start: MealStart) => setMeal((m) => ({ key: (m?.key ?? 0) + 1, start }));
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const date = picked ?? t;
  const offset = daysBetween(t, date);

  const dayLogs = useLiveQuery(() => db.foodLogs.where("date").equals(date).sortBy("createdAt"), [db, date]);
  const weekLogs = useLiveQuery(() => db.foodLogs.where("date").between(addDays(date, -6), date, true, true).toArray(), [db, date]);
  const { targets, source, maintenance } = resolveTargets(settings, bw);
  const totals = sumLogs(dayLogs ?? []);
  const label = offset === 0 ? "Today" : offset === -1 ? "Yesterday" : format(parseISODate(date), "EEE d MMM");

  return (
    <Page title="Fuel" subtitle={format(parseISODate(date), "EEEE d MMMM")}>
      <WeekStrip date={date} today={t} target={targets.kcal} onSelect={(d) => setPicked(d === t ? null : d)} />

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
        <FoodComposer
          date={date}
          onDescribe={(text) => openMeal({ note: text, auto: true })}
          onPhoto={(p) => openMeal({ photo: p })}
          onBrowse={() => setAdding(true)}
          onPasted={(pasted) => openMeal({ pasted })}
        />
      </div>
      <div className="mt-3">
        <MacroRings totals={totals} targets={targets} maintenance={maintenance} />
      </div>

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
                  <span className="flex items-center gap-1.5 text-base">
                    <span className="truncate">{l.name}</span>
                    {(l.source === "photo" || l.source === "ai") && (
                      <Sparkles className="size-3.5 shrink-0 text-ice" aria-label="AI estimate" />
                    )}
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
          <p className="text-base">Nothing logged {offset === 0 ? "yet today" : "this day"}.</p>
          <p className="mt-1 text-sm text-fog">Add a food, or snap a photo of your plate and say what it is.</p>
        </div>
      )}

      {source === "goal" && (
        <>
          <SectionTitle>Goal</SectionTitle>
          <GoalCard targets={targets} />
        </>
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
      {meal && <PhotoMacrosSheet key={meal.key} open onClose={() => setMeal(null)} date={date} start={meal.start} />}
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
      description={log.kcalRange ? `AI estimate: ${log.kcalRange[0]}–${log.kcalRange[1]} kcal` : undefined}
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
