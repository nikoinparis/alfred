"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
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
}

/** Bottom sheet on phones, centred dialog on desktop. Drag down or press Escape to close. */
export function Sheet({ open, onClose, title, description, children, footer, size = "md", className }: SheetProps) {
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
            className="absolute inset-0 bg-[#030406]/75 backdrop-blur-[2px]"
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
              "relative z-10 flex max-h-[calc(100dvh-var(--safe-top)-72px)] w-full flex-col overflow-hidden rounded-t-[var(--radius-sheet)] border border-b-0 border-steel bg-kevlar outline-none md:rounded-[var(--radius-sheet)] md:border-b",
              size === "lg" ? "md:max-w-2xl" : "md:max-w-lg",
              className,
            )}
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 380 }}
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="flex justify-center pt-2.5 md:hidden" aria-hidden>
              <div className="h-1 w-10 rounded-full bg-steel-2" />
            </div>
            <header className="flex items-start gap-3 px-5 pb-3 pt-3 md:pt-5">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="font-display text-2xl font-semibold leading-tight tracking-tight">
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-fog">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="-mr-2 grid size-10 shrink-0 place-items-center rounded-full text-fog hover:bg-gunmetal-2 hover:text-bone"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </header>
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5"
              style={{ paddingBottom: footer ? 20 : "max(24px, calc(var(--safe-bottom) + 12px))" }}
              onPointerDownCapture={(e) => e.stopPropagation()}
            >
              {children}
            </div>
            {footer && (
              <footer className="border-t border-steel bg-kevlar px-5 pt-3" style={{ paddingBottom: "max(12px, var(--safe-bottom))" }}>
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
