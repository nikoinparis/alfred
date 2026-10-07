"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Wider on desktop. */
  size?: "md" | "lg";
  className?: string;
  /** Leading toolbar button label (HIG: Cancel/Close on the leading edge). */
  closeLabel?: string;
  /** Trailing toolbar control, e.g. a Save or Done button. */
  action?: ReactNode;
  /** Show the title large and left-aligned under the toolbar (for content-heavy sheets). */
  largeTitle?: boolean;
}

/** Bottom sheet on phones, centred dialog on desktop. Drag down or press Escape to close. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  closeLabel = "Close",
  action,
  largeTitle,
}: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <motion.div
            className="absolute inset-0 bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cn(
              "relative z-10 flex max-h-[calc(100dvh-var(--safe-top)-24px)] w-full flex-col overflow-hidden rounded-t-[var(--radius-sheet)] bg-kevlar shadow-[0_-12px_60px_-20px_rgb(0_0_0_/_0.9),inset_0_0.5px_0_rgb(255_255_255_/_0.1)] outline-none md:rounded-[var(--radius-sheet)]",
              size === "lg" ? "md:max-w-2xl" : "md:max-w-lg",
              className,
            )}
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", damping: 36, stiffness: 420, mass: 0.9 }}
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="flex justify-center pt-2 md:hidden" aria-hidden>
              <div className="h-[5px] w-9 rounded-full bg-white/20" />
            </div>
            <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 pt-1 md:pt-2">
              <button
                type="button"
                onClick={onClose}
                className="h-11 justify-self-start rounded-full px-3 text-base text-signal active:opacity-60"
              >
                {closeLabel}
              </button>
              <h2 id={titleId} className={cn("max-w-[60vw] truncate text-base font-semibold md:max-w-sm", largeTitle && "sr-only")}>
                {title}
              </h2>
              <div className="flex justify-self-end pr-1">{action}</div>
            </header>
            {(largeTitle || description) && (
              <div className="px-5 pb-3 pt-1">
                {largeTitle && (
                  <p className="text-2xl font-bold tracking-[-0.02em]" aria-hidden>
                    {title}
                  </p>
                )}
                {description && <div className="mt-1 text-sm text-fog">{description}</div>}
              </div>
            )}
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5"
              style={{ paddingBottom: footer ? 20 : "max(24px, calc(var(--safe-bottom) + 12px))" }}
              onPointerDownCapture={(e) => e.stopPropagation()}
            >
              {children}
            </div>
            {footer && (
              <footer className="border-t border-separator bg-kevlar px-5 pt-3" style={{ paddingBottom: "max(12px, var(--safe-bottom))" }}>
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
