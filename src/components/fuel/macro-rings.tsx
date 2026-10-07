import type { MacroTargets } from "@/lib/domain/nutrition";
import type { Totals } from "@/lib/db/nutrition";
import { cn } from "@/lib/cn";

/**
 * Calorie ring. When maintenance is known the ring has a tick at maintenance: the first stretch is
 * what holds your weight, the rest is the surplus that builds (or the deficit on a cut).
 */
export function MacroRings({ totals, targets, maintenance }: { totals: Totals; targets: MacroTargets; maintenance?: number | null }) {
  const R = 74;
  const C = 2 * Math.PI * R;
  const eaten = Math.round(totals.kcal);
  const frac = Math.min(1, eaten / Math.max(1, targets.kcal));
  const over = eaten > targets.kcal;
  const bulking = maintenance != null && targets.kcal > maintenance + 50;
  const mFrac = bulking ? maintenance / targets.kcal : null;
  // The tick sits on the ring at maintenance (rotated with the SVG, so 0 = top).
  const tick = mFrac !== null ? { x: 90 + R * Math.cos(2 * Math.PI * mFrac), y: 90 + R * Math.sin(2 * Math.PI * mFrac) } : null;

  let big: number;
  let label: string;
  let sub: string;
  if (over) {
    big = eaten - targets.kcal;
    label = "kcal over target";
    sub = `${eaten} / ${targets.kcal}`;
  } else if (bulking && eaten < maintenance) {
    big = maintenance - eaten;
    label = "to maintain";
    sub = `then +${targets.kcal - maintenance} to grow`;
  } else if (bulking) {
    big = targets.kcal - eaten;
    label = "more to grow";
    sub = "Maintenance covered";
  } else {
    big = targets.kcal - eaten;
    label = "kcal left";
    sub = `${eaten} / ${targets.kcal}`;
  }

  return (
    <div className="panel grid items-center gap-5 p-5 sm:grid-cols-[180px_1fr]">
      <div className="relative mx-auto size-[180px]">
        <svg viewBox="0 0 180 180" className="-rotate-90" aria-hidden>
          <circle cx="90" cy="90" r={R} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="10" />
          {mFrac !== null && (
            // Faint band for the surplus zone so you can see where "growing" starts.
            <circle
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke="var(--signal-soft)"
              strokeWidth="10"
              strokeDasharray={`${C * (1 - mFrac)} ${C}`}
              strokeDashoffset={-C * mFrac}
            />
          )}
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
          {tick && <circle cx={tick.x} cy={tick.y} r="3.5" fill="var(--bone)" stroke="var(--gunmetal)" strokeWidth="2" />}
        </svg>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center"
          role="img"
          aria-label={`${eaten} of ${targets.kcal} kcal eaten`}
        >
          <p className="readout text-[44px] font-semibold">{Math.max(0, big)}</p>
          <p className="text-xs text-fog-2">{label}</p>
          <p className="mt-1 max-w-[120px] text-[11px] leading-tight text-fog">{sub}</p>
        </div>
      </div>
      <div className="grid gap-4">
        {bulking && (
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-1.5 rounded-[12px] bg-white/[0.04] px-3 py-2.5 text-center">
            <Part value={maintenance} label="maintain" />
            <span className="pb-4 text-fog">+</span>
            <Part value={targets.kcal - maintenance} label="to grow" accent />
            <span className="pb-4 text-fog">=</span>
            <Part value={targets.kcal} label="daily target" />
          </div>
        )}
        <MacroBar label="Protein" value={totals.protein} target={targets.protein} tone="bg-signal" emphasis />
        <MacroBar label="Carbs" value={totals.carbs} target={targets.carbs} tone="bg-[#6fcfbf]" />
        <MacroBar label="Fat" value={totals.fat} target={targets.fat} tone="bg-ochre" />
      </div>
    </div>
  );
}

function Part({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={cn("readout text-xl font-semibold", accent && "text-signal")}>{value}</p>
      <p className="text-[11px] text-fog">{label}</p>
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
