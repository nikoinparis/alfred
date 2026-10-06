"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { Page } from "@/components/shell/page";
import { useApp, useSettings } from "@/components/providers/app-provider";
import { SessionView } from "@/components/workout/session-view";
import { TodayAside } from "@/components/workout/today-aside";
import { TodayStart } from "@/components/workout/today-start";
import { useExercises, useTemplates, useToday } from "@/lib/db/hooks";
import { addDays, parseISODate } from "@/lib/domain/dates";
import { suggestPlan } from "@/lib/domain/planner";

export default function TodayPage() {
  const { db } = useApp();
  const settings = useSettings();
  const t = useToday();
  const exercises = useExercises();
  const templates = useTemplates();
  const sessions = useLiveQuery(() => db.sessions.where("date").equals(t).toArray(), [db, t]);
  const logs = useLiveQuery(() => db.dayLogs.where("date").between(addDays(t, -42), addDays(t, 7), true, true).toArray(), [db, t]);

  const subtitle = t === "1970-01-01" ? "" : format(parseISODate(t), "EEEE d MMMM");

  if (!exercises || !templates || !sessions || !logs) {
    return (
      <Page title="Today" subtitle={subtitle}>
        <div className="mt-4 h-12 w-2/3 animate-pulse rounded-[12px] bg-gunmetal" />
        <div className="mt-6 h-40 animate-pulse rounded-[14px] bg-gunmetal" />
      </Page>
    );
  }

  const session = sessions.find((s) => s.status === "active") ?? sessions.sort((a, b) => b.startedAt - a.startedAt)[0];
  const todayLog = logs.find((l) => l.date === t);
  const planned = todayLog?.status === "planned" ? todayLog : undefined;
  const suggestion = suggestPlan({
    today: t,
    until: t,
    logs: logs.filter((l) => l.date !== t),
    maxConsecutive: settings.maxConsecutive,
  })[0];

  return (
    <Page title="Today" subtitle={subtitle} wide>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {session ? (
            <SessionView key={session.id} session={session} exercises={exercises} templates={templates} />
          ) : (
            <TodayStart
              key={`${t}-${planned?.dayType ?? suggestion?.dayType}`}
              date={t}
              planned={planned}
              suggestion={suggestion}
              templates={templates}
              exercises={exercises}
              restLogged={todayLog?.dayType === "rest" && todayLog.status === "done"}
            />
          )}
          {!session && <div className="h-24 md:hidden" aria-hidden />}
        </div>
        <TodayAside date={t} />
      </div>
    </Page>
  );
}
