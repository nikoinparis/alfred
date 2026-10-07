"use client";

import { Minus, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface NumberFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  label: string;
  suffix?: string;
  /** Large readout style used in set logging. */
  big?: boolean;
  /** Narrow ± buttons for tight rows. */
  dense?: boolean;
  placeholder?: string;
  className?: string;
}

/** Number input flanked by big −/+ buttons. Typing works too (decimal keypad on iOS). */
export function NumberField({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  label,
  suffix,
  big,
  dense,
  placeholder = "–",
  className,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    // Adopt external changes (e.g. ± buttons, prefill) without an effect.
    setSynced(value);
    setDraft(value === null ? "" : String(value));
  }

  const commit = (raw: string) => {
    if (raw.trim() === "") return onChange(null);
    const n = Number(raw.replace(",", "."));
    if (Number.isFinite(n)) onChange(clamp(n, min, max));
    else setDraft(value === null ? "" : String(value));
  };
  const nudge = (dir: 1 | -1) => {
    const base = value ?? 0;
    const next = Math.round((base + dir * step) * 1000) / 1000;
    onChange(clamp(next, min, max));
  };

  return (
    <div className={cn("flex items-stretch rounded-[12px] bg-white/[0.07] focus-within:bg-white/[0.1]", className)}>
      <button
        type="button"
        onClick={() => nudge(-1)}
        className={cn(
          "grid shrink-0 place-items-center rounded-[12px] text-fog-2 active:bg-white/10",
          dense ? "w-8" : big ? "w-12" : "w-10",
        )}
        aria-label={`Decrease ${label}`}
      >
        <Minus className="size-4" />
      </button>
      <label className="relative flex min-w-0 flex-1 items-baseline justify-center">
        <span className="sr-only">{label}</span>
        <input
          inputMode="decimal"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          onFocus={(e) => e.target.select()}
          className={cn(
            "readout w-full min-w-0 bg-transparent text-center outline-none placeholder:text-fog/50",
            big ? "py-2 text-[34px] font-semibold" : "py-2 text-2xl font-medium",
          )}
        />
        {suffix && <span className="pointer-events-none absolute bottom-1 right-1 text-[11px] text-fog">{suffix}</span>}
      </label>
      <button
        type="button"
        onClick={() => nudge(1)}
        className={cn(
          "grid shrink-0 place-items-center rounded-[12px] text-fog-2 active:bg-white/10",
          dense ? "w-8" : big ? "w-12" : "w-10",
        )}
        aria-label={`Increase ${label}`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
  size?: "sm" | "md";
}

/** Segmented control: the selected thumb slides between segments. */
export function Segmented<T extends string>({ value, onChange, options, label, className, size = "md" }: SegmentedProps<T>) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex rounded-[10px] bg-white/[0.07] p-[3px]", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 rounded-[8px] px-3 font-semibold transition-colors",
              size === "sm" ? "h-8 text-sm" : "h-9 text-sm",
              active ? "text-bone" : "text-fog-2 hover:text-bone",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[8px] bg-white/[0.16] shadow-[0_2px_8px_rgb(0_0_0_/_0.35),inset_0_0.5px_0_rgb(255_255_255_/_0.12)]"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block px-1 text-sm text-fog">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block px-1 text-xs text-fog">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[12px] bg-white/[0.07] px-3.5 text-base outline-none ring-signal/60 placeholder:text-fog/70 focus:bg-white/[0.1] focus:ring-1",
        className,
      )}
      {...props}
    />
  );
}

/** Switch with the HIG's 51×31 pt proportions. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-signal" : "bg-white/[0.16]",
      )}
    >
      <span
        className={cn(
          "absolute left-[2px] top-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0_/_0.3)] transition-transform duration-200 ease-[var(--ease-spring)]",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
