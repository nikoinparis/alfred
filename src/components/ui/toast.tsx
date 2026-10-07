"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "default" | "signal" | "danger";
interface Toast {
  id: number;
  message: ReactNode;
  tone: Tone;
  action?: { label: string; onClick: () => void };
}

const ToastContext = createContext<(t: Omit<Toast, "id" | "tone"> & { tone?: Tone; duration?: number }) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const push = useCallback((t: Omit<Toast, "id" | "tone"> & { tone?: Tone; duration?: number }) => {
    const id = next.current++;
    setToasts((all) => [...all.slice(-2), { id, tone: t.tone ?? "default", message: t.message, action: t.action }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), t.duration ?? 3200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4"
        style={{ top: "calc(var(--safe-top) + 12px)" }}
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout="position"
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              className={cn(
                "pointer-events-auto flex max-w-md items-center gap-3 rounded-[14px] border px-4 py-3 text-sm shadow-[0_12px_40px_-12px_rgb(0_0_0_/_0.8)]",
                t.tone === "signal" && "border-signal/50 bg-[#211a0b] text-bone",
                t.tone === "danger" && "border-crimson/50 bg-[#22100f] text-bone",
                t.tone === "default" && "border-white/10 bg-gunmetal-2 text-bone",
              )}
            >
              <div className="min-w-0 flex-1">{t.message}</div>
              {t.action && (
                <button type="button" onClick={t.action.onClick} className="shrink-0 font-semibold text-signal">
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
