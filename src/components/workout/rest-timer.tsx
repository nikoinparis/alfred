"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSettings } from "@/components/providers/app-provider";

interface Timer {
  endAt: number;
  duration: number;
  label: string;
}

interface RestTimerApi {
  timer: Timer | null;
  start: (seconds: number, label: string) => void;
  adjust: (deltaSeconds: number) => void;
  stop: () => void;
}

const Ctx = createContext<RestTimerApi | null>(null);
const KEY = "alfred:rest-timer";

let audio: AudioContext | null = null;
function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") audio.resume();
  } catch {}
}
function chime() {
  if (!audio) return;
  const t = audio.currentTime;
  [0, 0.18].forEach((offset, i) => {
    const o = audio!.createOscillator();
    const g = audio!.createGain();
    o.type = "sine";
    o.frequency.value = i ? 1046 : 784;
    g.gain.setValueAtTime(0.0001, t + offset);
    g.gain.exponentialRampToValueAtTime(0.25, t + offset + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.35);
    o.connect(g).connect(audio!.destination);
    o.start(t + offset);
    o.stop(t + offset + 0.4);
  });
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [timer, setTimer] = useState<Timer | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const t = JSON.parse(localStorage.getItem(KEY) ?? "null") as Timer | null;
      return t && t.endAt > Date.now() ? t : null;
    } catch {
      return null;
    }
  });

  const persist = (t: Timer | null) => {
    try {
      if (t) localStorage.setItem(KEY, JSON.stringify(t));
      else localStorage.removeItem(KEY);
    } catch {}
  };

  const start = useCallback((seconds: number, label: string) => {
    unlockAudio();
    const t = { endAt: Date.now() + seconds * 1000, duration: seconds, label };
    persist(t);
    setTimer(t);
  }, []);

  const adjust = useCallback((delta: number) => {
    setTimer((t) => {
      if (!t) return t;
      const endAt = Math.max(Date.now() + 1000, t.endAt + delta * 1000);
      const next = { ...t, endAt, duration: Math.max(1, t.duration + delta) };
      persist(next);
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    persist(null);
    setTimer(null);
  }, []);

  return (
    <Ctx.Provider value={{ timer, start, adjust, stop }}>
      {children}
      <RestDock />
    </Ctx.Provider>
  );
}

export function useRestTimer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRestTimer outside provider");
  return ctx;
}

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function RestDock() {
  const { timer, adjust, stop } = useRestTimer();
  const settings = useSettings();
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef<number | null>(null);

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer]);

  const remaining = timer ? timer.endAt - now : 0;
  const finished = timer !== null && remaining <= 0;

  useEffect(() => {
    if (!timer || !finished || fired.current === timer.endAt) return;
    fired.current = timer.endAt;
    chime();
    if (settings.haptics) navigator.vibrate?.([120, 80, 120]);
    const id = setTimeout(stop, 6000);
    return () => clearTimeout(id);
  }, [finished, timer, stop, settings.haptics]);

  const progress = timer ? Math.min(1, Math.max(0, remaining / (timer.duration * 1000))) : 0;
  const R = 17;
  const C = 2 * Math.PI * R;

  return (
    <AnimatePresence>
      {timer && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 360 }}
          className="pointer-events-none fixed inset-x-0 top-0 z-[55] flex justify-center px-4 md:inset-x-auto md:right-6 md:top-6"
          style={{ paddingTop: "calc(var(--safe-top) + 6px)" }}
          role="timer"
          aria-live={finished ? "assertive" : "off"}
        >
          <div
            className={`pointer-events-auto flex items-center gap-1 rounded-full border py-1.5 pl-1.5 pr-1.5 shadow-[0_16px_50px_-10px_rgb(0_0_0_/_0.9)] backdrop-blur-xl ${
              finished ? "border-signal bg-[#241c0c]/95" : "border-steel-2 bg-gunmetal/95"
            }`}
          >
            <div className="relative grid size-11 place-items-center">
              <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
                <circle cx="20" cy="20" r={R} fill="none" stroke="var(--steel)" strokeWidth="3" />
                <circle
                  cx="20"
                  cy="20"
                  r={R}
                  fill="none"
                  stroke="var(--signal)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - progress)}
                  style={{ transition: "stroke-dashoffset 250ms linear", filter: "drop-shadow(0 0 4px rgb(226 176 74 / 0.6))" }}
                />
              </svg>
              <span className="text-[10px] font-medium text-fog">rest</span>
            </div>
            <div className="min-w-[92px] px-1.5">
              <p className="readout text-[26px] font-semibold">{finished ? "Go" : fmt(remaining)}</p>
              <p className="max-w-[140px] truncate text-[11px] text-fog">{finished ? "Next set" : timer.label}</p>
            </div>
            {!finished && (
              <>
                <button
                  type="button"
                  onClick={() => adjust(-15)}
                  className="grid size-11 place-items-center rounded-full text-fog-2 active:bg-gunmetal-2"
                  aria-label="15 seconds less"
                >
                  <Minus className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => adjust(15)}
                  className="grid size-11 place-items-center rounded-full text-fog-2 active:bg-gunmetal-2"
                  aria-label="15 seconds more"
                >
                  <Plus className="size-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={stop}
              className="grid size-11 place-items-center rounded-full text-fog active:bg-gunmetal-2"
              aria-label="Dismiss rest timer"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
