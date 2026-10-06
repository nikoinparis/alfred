"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useSyncExternalStore } from "react";
import { useDb } from "@/components/providers/app-provider";
import { addDays, today as todayISO } from "@/lib/domain/dates";
import type { DayTemplate, DayType, Exercise } from "@/lib/domain/types";

export function useExercises(): Record<string, Exercise> | undefined {
  const db = useDb();
  const list = useLiveQuery(() => db.exercises.toArray(), [db]);
  return useMemo(() => (list ? Object.fromEntries(list.map((e) => [e.id, e])) : undefined), [list]);
}

export function useTemplates(): Record<DayType, DayTemplate> | undefined {
  const db = useDb();
  const list = useLiveQuery(() => db.templates.toArray(), [db]);
  return useMemo(() => (list ? (Object.fromEntries(list.map((t) => [t.dayType, t])) as Record<DayType, DayTemplate>) : undefined), [list]);
}

export function useLatestBodyweight(): number | null {
  const db = useDb();
  return (
    useLiveQuery(async () => {
      const last = await db.bodyweights.orderBy("date").last();
      if (last) return last.kg;
      return (await db.settings.get("app"))?.profile?.weightKg ?? null;
    }, [db]) ?? null
  );
}

/** Today's date, refreshed when the tab regains focus (handles past-midnight sessions). */
export function useToday(): string {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("focus", cb);
      const t = setInterval(cb, 60_000);
      return () => {
        window.removeEventListener("focus", cb);
        clearInterval(t);
      };
    },
    todayISO,
    () => "1970-01-01",
  );
}

export function useSessionsBetween(from: string, to: string) {
  const db = useDb();
  return useLiveQuery(() => db.sessions.where("date").between(from, to, true, true).toArray(), [db, from, to]);
}

export function useRecentSessions(days = 120) {
  const t = useToday();
  return useSessionsBetween(addDays(t, -days), t);
}
