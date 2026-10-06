import { cn } from "@/lib/cn";

/** Angular cowl-like emblem: two blades meeting at a point. Deliberately not a bat. */
export function Emblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <path d="M16 3 4 9.5v7.2C4 23 9.2 27.6 16 29c6.8-1.4 12-6 12-12.3V9.5L16 3Z" fill="var(--gunmetal-2)" stroke="var(--steel-2)" />
      <path d="M9 12.5 16 22l7-9.5-3.6 1.6L16 9.5l-3.4 4.6L9 12.5Z" fill="var(--signal)" />
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
