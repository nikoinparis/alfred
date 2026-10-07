"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { ChevronRight, Dumbbell } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp, useSettings } from "@/components/providers/app-provider";
import { BarTrend, LineTrend } from "@/components/history/trend-chart";
import { EmptyState, Page, SectionTitle } from "@/components/shell/page";
import { Segmented } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { useExercises, useLatestBodyweight } from "@/lib/db/hooks";
import { parseISODate, startOfWeek } from "@/lib/domain/dates";
import { DAY_LABEL } from "@/lib/domain/muscles";
import { exerciseHistory } from "@/lib/domain/progression";
import { hardSetValue } from "@/lib/domain/volume";
import type { Exercise, Session } from "@/lib/domain/types";
import { displayWeight, formatNumber } from "@/lib/domain/units";
import { cn } from "@/lib/cn";

type View = "workouts" | "exercises";

export default function HistoryPage() {
  const { db } = useApp();
  const exercises = useExercises();
  const sessions = useLiveQuery(() => db.sessions.orderBy("date").reverse().toArray(), [db]);
  const [view, setView] = useState<View>("workouts");
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [openSession, setOpenSession] = useState<Session | null>(null);

  if (!sessions || !exercises) return <Page title="History">{null}</Page>;

  if (exerciseId && exercises[exerciseId]) {
    return <ExerciseDetail exercise={exercises[exerciseId]} sessions={sessions} onBack={() => setExerciseId(null)} />;
  }

  return (
    <Page title="History" subtitle={`${sessions.filter((s) => s.dayType !== "rest").length} workouts logged`}>
      <Segmented<View>
        label="History view"
        value={view}
        onChange={setView}
        options={[
          { value: "workouts", label: "Workouts" },
          { value: "exercises", label: "Exercises" },
        ]}
      />
      {sessions.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Dumbbell className="size-8" />}
            title="No workouts yet"
            body="Finish your first session on the Today tab and it'll show up here with charts per exercise."
          />
        </div>
      ) : view === "workouts" ? (
        <WorkoutList sessions={sessions} exercises={exercises} onOpen={setOpenSession} />
      ) : (
        <ExerciseList sessions={sessions} exercises={exercises} onOpen={setExerciseId} />
      )}
      <SessionSheet
        session={openSession}
        exercises={exercises}
        onClose={() => setOpenSession(null)}
        onExercise={(id) => {
          setOpenSession(null);
          setExerciseId(id);
        }}
      />
    </Page>
  );
}

function WorkoutList({
  sessions,
  exercises,
  onOpen,
}: {
  sessions: Session[];
  exercises: Record<string, Exercise>;
  onOpen: (s: Session) => void;
}) {
  const weeks = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const w = startOfWeek(s.date);
      map.set(w, [...(map.get(w) ?? []), s]);
    }
    return [...map.entries()];
  }, [sessions]);

  return (
    <>
      {weeks.map(([week, list]) => (
        <div key={week}>
          <SectionTitle>Week of {format(parseISODate(week), "d MMM")}</SectionTitle>
          <ul className="panel divide-steel">
            {list.map((s) => {
              const sets = s.entries.reduce((a, e) => a + e.sets.reduce((b, x) => b + hardSetValue(x), 0), 0);
              const mins = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : null;
              const named = s.entries.filter((e) => !exercises[e.exerciseId]?.isConditioning).length;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(s)}
                    className="flex min-h-16 w-full items-center gap-4 px-4 py-3 text-left hover:bg-gunmetal-2/40"
                  >
                    <div className="w-11 shrink-0 text-center">
                      <p className="text-xs text-fog">{format(parseISODate(s.date), "EEE")}</p>
                      <p className="readout text-2xl font-semibold">{format(parseISODate(s.date), "d")}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-xl font-semibold tracking-wide">{DAY_LABEL[s.dayType]}</p>
                      <p className="text-sm text-fog">
                        {s.dayType === "rest" ? "Recovery" : `${named} exercises · ${formatNumber(sets)} hard sets`}
                        {mins !== null && ` · ${mins} min`}
                        {s.status === "active" && " · in progress"}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-fog" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

function ExerciseList({
  sessions,
  exercises,
  onOpen,
}: {
  sessions: Session[];
  exercises: Record<string, Exercise>;
  onOpen: (id: string) => void;
}) {
  const { unit } = useSettings();
  const bw = useLatestBodyweight();
  const rows = useMemo(() => {
    const ids = new Set(sessions.flatMap((s) => s.exerciseIds));
    return [...ids]
      .map((id) => exercises[id])
      .filter((e): e is Exercise => Boolean(e) && !e.isConditioning)
      .map((ex) => {
        const h = exerciseHistory(sessions, ex, bw);
        return { ex, count: h.length, last: h[h.length - 1], best: Math.max(0, ...h.map((p) => p.e1rm)) };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => (b.last.date > a.last.date ? 1 : -1));
  }, [sessions, exercises, bw]);

  return (
    <ul className="panel divide-steel mt-5">
      {rows.map(({ ex, count, last, best }) => (
        <li key={ex.id}>
          <button
            type="button"
            onClick={() => onOpen(ex.id)}
            className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-gunmetal-2/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-base">{ex.name}</p>
              <p className="text-sm text-fog">
                {count} session{count === 1 ? "" : "s"} · last {format(parseISODate(last.date), "d MMM")}
              </p>
            </div>
            {best > 0 && (
              <div className="text-right">
                <p className="readout text-xl font-semibold">{formatNumber(displayWeight(best, "kg", unit))}</p>
                <p className="text-xs text-fog">est. 1RM {unit}</p>
              </div>
            )}
            <ChevronRight className="size-4 text-fog" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ExerciseDetail({ exercise, sessions, onBack }: { exercise: Exercise; sessions: Session[]; onBack: () => void }) {
  const { unit } = useSettings();
  const bw = useLatestBodyweight();
  const history = useMemo(() => exerciseHistory(sessions, exercise, bw), [sessions, exercise, bw]);
  const e1rm = history.filter((p) => p.e1rm > 0).map((p) => ({ date: p.date, value: displayWeight(p.e1rm, "kg", unit) }));
  const volume = history.map((p) => ({ date: p.date, value: Math.round(displayWeight(p.volume, "kg", unit)) }));
  const bestE1 = history.reduce((a, p) => (p.e1rm > a.e1rm ? p : a), history[0]);
  const heaviest = history.reduce((a, p) => (p.topWeightKg > a.topWeightKg ? p : a), history[0]);
  const bestVol = history.reduce((a, p) => (p.volume > a.volume ? p : a), history[0]);

  return (
    <Page title={exercise.name} subtitle={`${history.length} sessions`} back={{ label: "History", onClick: onBack }}>
      {history.length === 0 ? (
        <EmptyState title="No sets yet" body="Log this exercise and its progress chart appears here." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Best est. 1RM", bestE1?.e1rm, bestE1?.date],
              [
                exercise.loadMode === "assisted" ? "Least assist" : "Heaviest",
                exercise.loadMode === "assisted" ? null : heaviest?.topWeightKg,
                heaviest?.date,
              ],
              ["Best volume", bestVol?.volume, bestVol?.date],
            ].map(([label, v, d]) => (
              <div key={label as string} className="panel p-3">
                <p className="text-xs text-fog">{label as string}</p>
                <p className="readout mt-1 text-[26px] font-semibold">
                  {typeof v === "number" && v > 0 ? formatNumber(Math.round(displayWeight(v, "kg", unit) * 2) / 2) : "–"}
                </p>
                <p className="text-xs text-fog">{d ? format(parseISODate(d as string), "d MMM") : ""}</p>
              </div>
            ))}
          </div>

          {e1rm.length > 1 && (
            <>
              <SectionTitle>Estimated 1RM ({unit})</SectionTitle>
              <div className="panel p-3">
                <LineTrend data={e1rm} unit={unit} label="Estimated one-rep max" />
              </div>
            </>
          )}
          {volume.length > 1 && (
            <>
              <SectionTitle>Volume per session ({unit} × reps)</SectionTitle>
              <div className="panel p-3">
                <BarTrend data={volume} unit={`${unit}·reps`} label="Volume" />
              </div>
            </>
          )}

          <SectionTitle>Every session</SectionTitle>
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-fog">
                  <th className="px-4 py-2 font-normal">Date</th>
                  <th className="px-2 py-2 font-normal">Sets</th>
                  <th className="px-4 py-2 text-right font-normal">e1RM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator border-t border-separator">
                {[...history].reverse().map((p) => (
                  <tr key={p.sessionId}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-fog-2">{format(parseISODate(p.date), "d MMM yy")}</td>
                    <td className="px-2 py-2.5">
                      <span className="readout text-base">
                        {p.entry.sets
                          .filter((s) => s.done && s.kind !== "warmup")
                          .map(
                            (s) =>
                              `${s.weight !== null ? formatNumber(displayWeight(s.weight, s.unit, unit)) : "BW"}×${s.reps}${s.kind === "drop" ? "d" : ""}`,
                          )
                          .join("  ")}
                      </span>
                    </td>
                    <td className={cn("readout px-4 py-2.5 text-right text-base", p === bestE1 && "text-signal")}>
                      {p.e1rm ? formatNumber(Math.round(displayWeight(p.e1rm, "kg", unit) * 2) / 2) : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-fog">Estimated 1RM uses the Epley formula on your best set. &ldquo;d&rdquo; marks drop sets.</p>
        </>
      )}
    </Page>
  );
}

function SessionSheet({
  session,
  exercises,
  onClose,
  onExercise,
}: {
  session: Session | null;
  exercises: Record<string, Exercise>;
  onClose: () => void;
  onExercise: (id: string) => void;
}) {
  const { unit } = useSettings();
  return (
    <Sheet
      open={session !== null}
      onClose={onClose}
      title={session ? DAY_LABEL[session.dayType] : ""}
      description={session ? format(parseISODate(session.date), "EEEE d MMMM yyyy") : undefined}
    >
      {session && (
        <ul className="space-y-3">
          {session.entries.map((e) => {
            const ex = exercises[e.exerciseId];
            const done = e.sets.filter((s) => s.done && s.kind !== "warmup");
            return (
              <li key={e.id} className="panel p-3.5">
                <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => onExercise(e.exerciseId)}>
                  <span className="min-w-0 flex-1 truncate text-base">{ex?.name ?? e.exerciseId}</span>
                  <ChevronRight className="size-4 text-fog" />
                </button>
                {!ex?.isConditioning && (
                  <p className="readout mt-1.5 text-lg text-fog-2">
                    {done.length
                      ? done
                          .map((s) => `${s.weight !== null ? formatNumber(displayWeight(s.weight, s.unit, unit)) : "BW"}×${s.reps}`)
                          .join("   ")
                      : "Not done"}
                  </p>
                )}
                {e.note && <p className="mt-1 text-sm text-fog">{e.note}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
