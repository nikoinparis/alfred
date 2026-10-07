import type { MacroTargets } from "@/lib/domain/nutrition";
import type { Totals } from "@/lib/db/nutrition";
import { cn } from "@/lib/cn";

/** Calorie ring with the remaining number in the middle, plus protein/carb/fat bars. */
export function MacroRings({ totals, targets }: { totals: Totals; targets: MacroTargets }) {
  const R = 74;
  const C = 2 * Math.PI * R;
  const frac = Math.min(1, totals.kcal / Math.max(1, targets.kcal));
  const over = totals.kcal > targets.kcal;
  const remaining = Math.round(targets.kcal - totals.kcal);

  return (
    <div className="panel grid items-center gap-5 p-5 sm:grid-cols-[180px_1fr]">
      <div className="relative mx-auto size-[180px]">
        <svg viewBox="0 0 180 180" className="-rotate-90" aria-hidden>
          <circle cx="90" cy="90" r={R} fill="none" stroke="var(--steel)" strokeWidth="10" />
          <circle
            cx="90"
            cy="90"
            r={R}
            fill="none"
            stroke={over ? "var(--ochre)" : "var(--signal)"}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
            style={{ transition: "stroke-dashoffset 700ms var(--ease-out-quint)" }}
          />
        </svg>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          role="img"
          aria-label={`${Math.round(totals.kcal)} of ${targets.kcal} kcal`}
        >
          <p className="readout text-[44px] font-semibold">{Math.abs(remaining)}</p>
          <p className="text-xs text-fog">{over ? "kcal over" : "kcal left"}</p>
          <p className="mt-1 text-xs text-fog-2">
            {Math.round(totals.kcal)} / {targets.kcal}
          </p>
        </div>
      </div>
      <div className="grid gap-4">
        <MacroBar label="Protein" value={totals.protein} target={targets.protein} tone="bg-signal" emphasis />
        <MacroBar label="Carbs" value={totals.carbs} target={targets.carbs} tone="bg-[#6fcfbf]" />
        <MacroBar label="Fat" value={totals.fat} target={targets.fat} tone="bg-ochre" />
      </div>
    </div>
  );
}

function MacroBar({
  label,
  value,
  target,
  tone,
  emphasis,
}: {
  label: string;
  value: number;
  target: number;
  tone: string;
  emphasis?: boolean;
}) {
  const pct = Math.min(100, (value / Math.max(1, target)) * 100);
  const left = Math.round(target - value);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("text-sm", emphasis ? "text-bone" : "text-fog-2")}>{label}</span>
        <span className="text-xs text-fog">
          <span className="readout text-lg text-bone">{Math.round(value)}</span> / {target} g
          <span className="ml-2">{left >= 0 ? `${left} left` : `${-left} over`}</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-steel" aria-hidden>
        <div className={cn("h-full rounded-full transition-[width] duration-700", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
