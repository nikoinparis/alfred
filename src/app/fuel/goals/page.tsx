"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, CircleAlert, Hourglass, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { updateSettings, useApp, useSettings } from "@/components/providers/app-provider";
import { Page, SectionTitle } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Field, NumberField, Segmented, Toggle } from "@/components/ui/controls";
import { useToast } from "@/components/ui/toast";
import { useLatestBodyweight, useToday } from "@/lib/db/hooks";
import { resolveTargets, sumLogs } from "@/lib/db/nutrition";
import { addDays, today } from "@/lib/domain/dates";
import {
  ACTIVITY_FACTOR,
  ACTIVITY_LABEL,
  computeTargets,
  KCAL_PER_KG,
  phaseRate,
  PRESETS,
  weeklyCheckIn,
  type Activity,
  type GoalPreset,
  type GoalSettings,
  type MacroTargets,
  type Phase,
  type Profile,
  type Sex,
} from "@/lib/domain/nutrition";
import { convert, formatNumber, roundTo } from "@/lib/domain/units";
import { cn } from "@/lib/cn";

const DEFAULT_PROFILE: Profile = { sex: "male", age: 25, heightCm: 175, weightKg: 75, activity: "moderate" };
const DEFAULT_GOAL: GoalSettings = { preset: "lean", phase: "recomp", rateKgPerWeek: 0.25 };

export default function GoalsPage() {
  const { db } = useApp();
  const settings = useSettings();
  const bw = useLatestBodyweight();
  const unit = settings.unit;
  const profile: Profile = { ...(settings.profile ?? DEFAULT_PROFILE), ...(bw ? { weightKg: bw } : {}) };
  const goal = settings.goal ?? DEFAULT_GOAL;
  const breakdown = computeTargets(profile, goal);
  const saved = Boolean(settings.profile && settings.goal);

  const setProfile = (p: Partial<Profile>) => updateSettings(db, { profile: { ...profile, ...p }, goal });
  const setGoal = (g: Partial<GoalSettings>) => updateSettings(db, { goal: { ...goal, ...g }, profile });
  const rate = phaseRate(goal.phase, goal.rateKgPerWeek);

  return (
    <Page
      title="Goal & targets"
      subtitle={
        saved ? "Changes apply to your Fuel targets immediately." : "Fill this in once; Alfred keeps it updated from your weigh-ins."
      }
      back={{ href: "/fuel", label: "Fuel" }}
    >
      <SectionTitle className="mt-2">What you&apos;re going for</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(PRESETS) as GoalPreset[]).map((k) => {
          const p = PRESETS[k];
          const active = goal.preset === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() =>
                setGoal({
                  preset: k,
                  phase: p.defaultPhase,
                  rateKgPerWeek: Math.abs(roundTo((p.defaultRatePct / 100) * profile.weightKg, 0.05)),
                })
              }
              className={cn(
                "rounded-[14px] border p-4 text-left transition-colors",
                active
                  ? "border-transparent bg-signal-soft ring-1 ring-signal/60"
                  : "border-transparent bg-white/[0.06] hover:bg-white/[0.09]",
              )}
              aria-pressed={active}
            >
              <p className="font-display text-xl font-semibold">{p.label}</p>
              <p className="mt-1 text-sm text-fog-2">{p.blurb}</p>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-fog">Presets set sensible defaults for phase, rate and macros. Everything below stays editable.</p>

      <SectionTitle>Phase</SectionTitle>
      <div className="panel grid gap-4 p-4">
        <Segmented<Phase>
          label="Phase"
          value={goal.phase}
          onChange={(phase) => setGoal({ phase })}
          options={[
            { value: "cut", label: "Cut" },
            { value: "recomp", label: "Recomp" },
            { value: "maintain", label: "Maintain" },
            { value: "bulk", label: "Bulk" },
          ]}
        />
        {(goal.phase === "cut" || goal.phase === "bulk") && (
          <Field
            label={`Target rate (${unit}/week)`}
            hint={`${formatNumber(roundTo((Math.abs(rate) / profile.weightKg) * 100, 0.05))}% of bodyweight per week. ${
              goal.phase === "cut" ? "0.5–1% keeps muscle on a cut." : "0.25–0.5% keeps fat gain low on a bulk."
            }`}
          >
            <NumberField
              label="Target rate per week"
              value={roundTo(convert(goal.rateKgPerWeek, "kg", unit), 0.05)}
              step={unit === "kg" ? 0.05 : 0.1}
              max={unit === "kg" ? 1.5 : 3}
              onChange={(v) => v !== null && setGoal({ rateKgPerWeek: convert(v, unit, "kg") })}
            />
          </Field>
        )}
        {goal.phase === "recomp" && (
          <p className="text-sm text-fog-2">
            Recomp eats around maintenance (a tiny deficit at most) with high protein, so you can lose fat and gain muscle slowly at the
            same time.
          </p>
        )}
      </div>

      <SectionTitle>Your stats</SectionTitle>
      <div className="panel grid gap-4 p-4">
        <Segmented<Sex>
          label="Sex"
          value={profile.sex}
          onChange={(sex) => setProfile({ sex })}
          size="sm"
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
        />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Age">
            <NumberField label="Age" value={profile.age} min={14} max={90} dense onChange={(v) => v && setProfile({ age: v })} />
          </Field>
          <Field label="Height (cm)">
            <NumberField
              label="Height in cm"
              value={profile.heightCm}
              min={120}
              max={230}
              dense
              onChange={(v) => v && setProfile({ heightCm: v })}
            />
          </Field>
          <Field label={`Weight (${unit})`} hint={bw ? "From weigh-ins" : undefined}>
            <NumberField
              label="Weight"
              value={roundTo(convert(profile.weightKg, "kg", unit), 0.1)}
              step={0.5}
              dense
              onChange={(v) => {
                if (!v) return;
                if (bw) db.bodyweights.put({ date: today(), kg: convert(v, unit, "kg") });
                else setProfile({ weightKg: convert(v, unit, "kg") });
              }}
            />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm text-fog-2">Activity</p>
          <div className="grid gap-1.5">
            {(Object.keys(ACTIVITY_FACTOR) as Activity[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setProfile({ activity: a })}
                className={cn(
                  "flex items-center justify-between rounded-[10px] border px-3 py-2.5 text-left text-sm",
                  profile.activity === a
                    ? "border-transparent bg-signal-soft text-signal"
                    : "border-transparent bg-white/[0.07] text-fog-2",
                )}
              >
                {ACTIVITY_LABEL[a]}
                <span className="readout text-base text-fog">×{ACTIVITY_FACTOR[a]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <SectionTitle>Your targets, step by step</SectionTitle>
      <div className="panel p-4">
        <ol className="space-y-3 text-sm">
          <Step n="BMR" value={`${breakdown.bmr} kcal`}>
            Mifflin-St Jeor: 10 × {formatNumber(roundTo(profile.weightKg, 0.1))} kg + 6.25 × {profile.heightCm} cm − 5 × {profile.age}{" "}
            {profile.sex === "male" ? "+ 5" : "− 161"}
          </Step>
          <Step n="TDEE" value={`${breakdown.tdee} kcal`}>
            BMR × {ACTIVITY_FACTOR[profile.activity]} for your activity level. This is roughly maintenance.
          </Step>
          <Step
            n={breakdown.dailyDelta >= 0 ? "Surplus" : "Deficit"}
            value={`${breakdown.dailyDelta >= 0 ? "+" : ""}${breakdown.dailyDelta} kcal`}
          >
            {formatNumber(roundTo(rate, 0.01))} kg/week × {KCAL_PER_KG} kcal per kg ÷ 7 days.
          </Step>
          <Step n="Protein" value={`${breakdown.targets.protein} g`}>
            {breakdown.proteinPerKg} g per kg bodyweight. The research range for lifters is 1.6–2.2; cuts sit at the top to protect muscle.
          </Step>
          <Step n="Fat" value={`${breakdown.targets.fat} g`}>
            {breakdown.fatPerKg} g/kg, never below 0.6 g/kg or 20% of calories (hormone health).
          </Step>
          <Step n="Carbs" value={`${breakdown.targets.carbs} g`}>
            Whatever calories are left after protein (4 kcal/g) and fat (9 kcal/g), divided by 4. Carbs fuel your sessions.
          </Step>
        </ol>
        <div className="mt-4 flex items-baseline justify-between border-t border-separator pt-3">
          <span className="text-fog-2">Daily calories</span>
          <span className="readout text-[34px] font-semibold">{breakdown.targets.kcal}</span>
        </div>
        {breakdown.notes.map((n) => (
          <p key={n} className="mt-2 text-sm text-ochre">
            {n}
          </p>
        ))}
        {!saved && (
          <Button variant="primary" className="mt-4 w-full" onClick={() => updateSettings(db, { profile, goal })}>
            Use these targets
          </Button>
        )}
      </div>

      <CheckInCard />
      <ManualOverride current={settings.macroOverride} computed={breakdown.targets} />
    </Page>
  );
}

function Step({ n, value, children }: { n: string; value: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[72px_1fr_auto] items-baseline gap-3">
      <span className="text-fog">{n}</span>
      <span className="text-fog-2">{children}</span>
      <span className="readout whitespace-nowrap text-lg text-bone">{value}</span>
    </li>
  );
}

function CheckInCard() {
  const { db } = useApp();
  const settings = useSettings();
  const toast = useToast();
  const t = useToday();
  const bw = useLatestBodyweight();
  const data = useLiveQuery(async () => {
    const from = addDays(t, -13);
    const weighIns = await db.bodyweights.where("date").between(from, t, true, true).toArray();
    const logs = await db.foodLogs.where("date").between(addDays(t, -7), addDays(t, -1), true, true).toArray();
    const byDay = new Map<string, typeof logs>();
    for (const l of logs) byDay.set(l.date, [...(byDay.get(l.date) ?? []), l]);
    return { weighIns, intakeDays: [...byDay.values()].map((d) => sumLogs(d).kcal) };
  }, [db, t]);

  if (!settings.goal || !settings.profile || !data) return null;
  const { targets } = resolveTargets(settings, bw);
  const ci = weeklyCheckIn({
    targetRate: phaseRate(settings.goal.phase, settings.goal.rateKgPerWeek),
    targetKcal: targets.kcal,
    weighIns: data.weighIns,
    intakeDays: data.intakeDays,
    asOf: t,
    bodyweightKg: bw ?? settings.profile.weightKg,
  });
  const appliedThisWeek = settings.lastCheckIn && settings.lastCheckIn > addDays(t, -6);
  const icon =
    ci.status === "on-track" ? (
      <CheckCircle2 className="size-5 text-verdigris" />
    ) : ci.status === "insufficient-data" ? (
      <Hourglass className="size-5 text-fog" />
    ) : ci.status === "adherence" ? (
      <CircleAlert className="size-5 text-ochre" />
    ) : ci.adjustKcal < 0 ? (
      <TrendingDown className="size-5 text-signal" />
    ) : (
      <TrendingUp className="size-5 text-signal" />
    );

  return (
    <>
      <SectionTitle>Weekly check-in</SectionTitle>
      <div className="panel p-4">
        <div className="flex gap-3">
          <div className="mt-0.5">{icon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-base text-bone">{ci.message}</p>
            <p className="mt-1 text-sm text-fog">
              Compares your 14-day weight trend and last 7 days of logged intake with your goal.
              {ci.actualRate !== null && ` Trend: ${ci.actualRate >= 0 ? "+" : ""}${ci.actualRate.toFixed(2)} kg/wk.`}
              {ci.avgIntake !== null && ` Avg intake: ${Math.round(ci.avgIntake)} kcal.`}
            </p>
          </div>
        </div>
        {(ci.status === "too-fast" || ci.status === "too-slow") && (
          <Button
            variant="primary"
            className="mt-4 w-full"
            disabled={Boolean(appliedThisWeek)}
            onClick={async () => {
              await updateSettings(db, { kcalAdjustment: settings.kcalAdjustment + ci.adjustKcal, lastCheckIn: t });
              toast({ message: `Targets ${ci.adjustKcal > 0 ? "raised" : "lowered"} by ${Math.abs(ci.adjustKcal)} kcal.`, tone: "signal" });
            }}
          >
            {appliedThisWeek
              ? "Adjusted this week. Check back in 7 days"
              : `Apply ${ci.adjustKcal > 0 ? "+" : ""}${ci.adjustKcal} kcal/day`}
          </Button>
        )}
        {settings.kcalAdjustment !== 0 && (
          <div className="mt-3 flex items-center justify-between border-t border-separator pt-3 text-sm">
            <span className="text-fog-2">
              Check-in adjustments so far: {settings.kcalAdjustment > 0 ? "+" : ""}
              {settings.kcalAdjustment} kcal (from carbs and fat; protein stays fixed)
            </span>
            <Button size="sm" variant="ghost" onClick={() => updateSettings(db, { kcalAdjustment: 0, lastCheckIn: undefined })}>
              Reset
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function ManualOverride({ current, computed }: { current: MacroTargets | null; computed: MacroTargets }) {
  const { db } = useApp();
  const [draft, setDraft] = useState<MacroTargets>(current ?? computed);
  const on = current !== null;
  const set = (k: keyof MacroTargets, v: number | null) => {
    const next = { ...draft, [k]: v ?? 0 };
    setDraft(next);
    if (on) updateSettings(db, { macroOverride: next });
  };
  return (
    <>
      <SectionTitle>Manual targets</SectionTitle>
      <div className="panel p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-fog-2">Override the calculator with your own numbers (e.g. from a coach).</p>
          <Toggle label="Use manual targets" checked={on} onChange={(v) => updateSettings(db, { macroOverride: v ? draft : null })} />
        </div>
        {on && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Field label="Calories">
              <NumberField label="Calories" value={draft.kcal} step={50} dense onChange={(v) => set("kcal", v)} max={8000} />
            </Field>
            <Field label="Protein (g)">
              <NumberField label="Protein" value={draft.protein} step={5} dense onChange={(v) => set("protein", v)} />
            </Field>
            <Field label="Carbs (g)">
              <NumberField label="Carbs" value={draft.carbs} step={5} dense onChange={(v) => set("carbs", v)} />
            </Field>
            <Field label="Fat (g)">
              <NumberField label="Fat" value={draft.fat} step={5} dense onChange={(v) => set("fat", v)} />
            </Field>
          </div>
        )}
      </div>
    </>
  );
}
