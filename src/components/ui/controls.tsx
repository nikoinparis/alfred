"use client";

import { Minus, Plus } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
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
  placeholder?: string;
  className?: string;
}

/** Number input flanked by big −/+ buttons. Typing works too (decimal keypad on iOS). */
export function NumberField({ value, onChange, step = 1, min = 0, max = 9999, label, suffix, big, placeholder = "–", className }: NumberFieldProps) {
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
    <div className={cn("flex items-stretch rounded-[12px] border border-steel bg-night/60", className)}>
      <button
        type="button"
        onClick={() => nudge(-1)}
        className={cn("grid shrink-0 place-items-center text-fog active:bg-gunmetal-2", big ? "w-12" : "w-10")}
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
            "readout w-full min-w-0 bg-transparent text-center outline-none placeholder:text-steel-2",
            big ? "py-2 text-[34px] font-semibold" : "py-2 text-2xl font-medium",
          )}
        />
        {suffix && <span className="pointer-events-none absolute bottom-1 right-1 text-[11px] text-fog">{suffix}</span>}
      </label>
      <button
        type="button"
        onClick={() => nudge(1)}
        className={cn("grid shrink-0 place-items-center text-fog active:bg-gunmetal-2", big ? "w-12" : "w-10")}
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

export function Segmented<T extends string>({ value, onChange, options, label, className, size = "md" }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex rounded-[12px] border border-steel bg-night/60 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-[9px] px-3 font-medium transition-colors",
            size === "sm" ? "h-8 text-sm" : "h-10 text-[15px]",
            o.value === value ? "bg-gunmetal-2 text-bone shadow-[inset_0_0_0_1px_var(--steel-2)]" : "text-fog hover:text-fog-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm text-fog-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-fog">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[12px] border border-steel bg-night/60 px-3 text-[15px] outline-none placeholder:text-fog/60 focus:border-signal/60",
        className,
      )}
      {...props}
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full border transition-colors", checked ? "border-signal bg-signal/90" : "border-steel-2 bg-gunmetal-2")}
    >
      <span
        className={cn(
          "absolute left-0 top-0.5 size-[22px] rounded-full transition-transform duration-200",
          checked ? "translate-x-[22px] bg-signal-ink" : "translate-x-0.5 bg-fog-2",
        )}
      />
    </button>
  );
}
