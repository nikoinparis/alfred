import { cn } from "@/lib/cn";

/** Swept-wing chevron: a glide, not a logo of anyone in particular. */
export const EMBLEM_PATH = "M2 9.5 16 22.5 30 9.5 26.5 9.2 16 17.6 5.5 9.2Z";

export function Emblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--gunmetal-2)" stroke="rgb(255 255 255 / 0.08)" />
      <path d={EMBLEM_PATH} fill="var(--signal)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Emblem />
      <span className="font-display text-xl font-bold tracking-[0.06em]">ALFRED</span>
    </span>
  );
}
