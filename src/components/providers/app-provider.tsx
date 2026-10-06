"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AlfredDB, DEFAULT_SETTINGS, type Settings } from "@/lib/db/schema";
import { seedBase, seedDemo } from "@/lib/db/seed";
import { today } from "@/lib/domain/dates";
import { DB_NAME, readStoredMode, storeMode, type AppMode } from "@/lib/mode";

interface AppContextValue {
  db: AlfredDB;
  mode: AppMode;
  /** Server confirmed the owner cookie (AI features unlocked). null = unknown/offline. */
  ownerVerified: boolean | null;
  switchMode: (mode: AppMode) => Promise<void>;
  resetDemo: () => Promise<void>;
  refreshOwner: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const DEMO_SESSION_FLAG = "alfred:demo-seeded";

const opening = new Map<string, Promise<AlfredDB>>();

/** Dedupes concurrent opens (React strict mode runs effects twice in dev). */
function openDb(mode: AppMode, forceReseed = false): Promise<AlfredDB> {
  const key = `${mode}:${forceReseed}`;
  const existing = opening.get(key);
  if (existing) return existing;
  const p = openDbUncached(mode, forceReseed).finally(() => setTimeout(() => opening.delete(key), 0));
  opening.set(key, p);
  return p;
}

async function openDbUncached(mode: AppMode, forceReseed: boolean): Promise<AlfredDB> {
  if (mode === "demo") {
    let fresh = forceReseed;
    try {
      fresh ||= sessionStorage.getItem(DEMO_SESSION_FLAG) !== "1";
    } catch {
      fresh = true;
    }
    if (fresh) await AlfredDB.delete(DB_NAME.demo);
    const db = new AlfredDB(DB_NAME.demo);
    if (fresh || (await db.sessions.count()) === 0) {
      await seedDemo(db, today());
      try {
        sessionStorage.setItem(DEMO_SESSION_FLAG, "1");
      } catch {}
    }
    return db;
  }
  const db = new AlfredDB(DB_NAME.owner);
  await seedBase(db);
  try {
    await navigator.storage?.persist?.();
  } catch {}
  return db;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ db: AlfredDB; mode: AppMode } | null>(null);
  const [ownerVerified, setOwnerVerified] = useState<boolean | null>(null);

  const refreshOwner = useCallback(async () => {
    try {
      const res = await fetch("/api/owner", { cache: "no-store" });
      const data = (await res.json()) as { owner: boolean };
      setOwnerVerified(data.owner);
    } catch {
      setOwnerVerified(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const mode = readStoredMode();
    openDb(mode).then((db) => {
      if (!cancelled) setState({ db, mode });
    });
    fetch("/api/owner", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ owner: boolean }>)
      .then((d) => !cancelled && setOwnerVerified(d.owner))
      .catch(() => !cancelled && setOwnerVerified(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const switchMode = useCallback(async (mode: AppMode) => {
    storeMode(mode);
    const db = await openDb(mode, mode === "demo");
    setState((prev) => {
      prev?.db.close();
      return { db, mode };
    });
  }, []);

  const resetDemo = useCallback(async () => {
    const db = await openDb("demo", true);
    setState((prev) => {
      prev?.db.close();
      return { db, mode: "demo" };
    });
  }, []);

  if (!state) return <BootScreen />;

  return (
    <AppContext.Provider value={{ ...state, ownerVerified, switchMode, resetDemo, refreshOwner }}>
      {children}
    </AppContext.Provider>
  );
}

function BootScreen() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-night" aria-busy="true" aria-label="Loading Alfred">
      <div className="h-[2px] w-24 overflow-hidden rounded-full bg-steel">
        <div className="h-full w-1/3 animate-[boot_1.1s_var(--ease-out-quint)_infinite] bg-signal" />
      </div>
      <style>{`@keyframes boot{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

export function useDb(): AlfredDB {
  return useApp().db;
}

export function useSettings(): Settings {
  const db = useDb();
  return useLiveQuery(() => db.settings.get("app"), [db]) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(db: AlfredDB, patch: Partial<Settings>) {
  const current = (await db.settings.get("app")) ?? DEFAULT_SETTINGS;
  await db.settings.put({ ...current, ...patch, id: "app" });
}
