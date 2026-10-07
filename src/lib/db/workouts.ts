import { exerciseHistory, isWorking, suggestOverload, type HistoryPoint } from "@/lib/domain/progression";
import { convert, displayStep, incrementFor, roundTo } from "@/lib/domain/units";
import type { DayType, Exercise, Session, SessionEntry, SetKind, SetLog, TemplateSlot, Unit } from "@/lib/domain/types";
import { uid } from "@/lib/id";
import type { AlfredDB } from "./schema";

export function newSet(unit: Unit, over: Partial<SetLog> = {}): SetLog {
  return { id: uid("set"), kind: "working", weight: null, unit, reps: null, done: false, ...over };
}

export async function latestBodyweightKg(db: AlfredDB): Promise<number | null> {
  const last = await db.bodyweights.orderBy("date").last();
  if (last) return last.kg;
  const s = await db.settings.get("app");
  return s?.profile?.weightKg ?? null;
}

/** History for one exercise, excluding a session (the one being logged). */
export async function historyFor(db: AlfredDB, exercise: Exercise, excludeSessionId?: string): Promise<HistoryPoint[]> {
  const sessions = (await db.sessions.where("exerciseIds").equals(exercise.id).toArray()).filter((s) => s.id !== excludeSessionId);
  return exerciseHistory(sessions, exercise, await latestBodyweightKg(db));
}

/**
 * Pre-fill sets for an exercise: copy last session's working sets (keeps per-set weights),
 * else use the template target. Always returns `plannedSets` working sets.
 */
export function prefillSets(
  exercise: Exercise,
  plannedSets: number,
  repMin: number,
  target: TemplateSlot["target"],
  history: HistoryPoint[],
  unit: Unit,
): SetLog[] {
  if (exercise.isConditioning) return [newSet(unit, { reps: null })];
  const last = history[history.length - 1];
  const prevWorking = last ? last.entry.sets.filter((s) => s.kind === "working" || s.kind === "failure") : [];
  const fromTarget = target ? roundTo(convert(target.value, target.unit, unit), displayStep(unit)) : null;
  return Array.from({ length: plannedSets }, (_, i) => {
    const src = prevWorking[Math.min(i, prevWorking.length - 1)];
    if (src) {
      return newSet(unit, {
        weight: src.weight === null ? null : roundTo(convert(src.weight, src.unit, unit), displayStep(unit)),
        reps: src.reps,
      });
    }
    return newSet(unit, { weight: exercise.loadMode === "bodyweight" ? null : fromTarget, reps: repMin });
  });
}

export async function buildEntry(
  db: AlfredDB,
  exercise: Exercise,
  slot: Pick<TemplateSlot, "sets" | "repMin" | "repMax" | "target"> & { id?: string },
  unit: Unit,
  excludeSessionId?: string,
): Promise<SessionEntry> {
  const history = await historyFor(db, exercise, excludeSessionId);
  return {
    id: uid("ent"),
    slotId: slot.id,
    exerciseId: exercise.id,
    repMin: slot.repMin,
    repMax: slot.repMax,
    sets: prefillSets(exercise, slot.sets, slot.repMin, slot.target, history, unit),
    done: false,
  };
}

export async function startSession(db: AlfredDB, date: string, dayType: DayType): Promise<Session> {
  const settings = await db.settings.get("app");
  const unit = settings?.unit ?? "kg";
  const template = await db.templates.get(dayType);
  const exercises = await db.exercises.toArray();
  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const entries: SessionEntry[] = [];
  for (const slot of template?.slots ?? []) {
    const ex = byId[slot.exerciseId];
    if (ex) entries.push(await buildEntry(db, ex, slot, unit));
  }
  const session: Session = {
    id: uid("ses"),
    date,
    dayType,
    startedAt: Date.now(),
    status: "active",
    entries,
    exerciseIds: entries.map((e) => e.exerciseId),
  };
  await db.transaction("rw", [db.sessions, db.dayLogs], async () => {
    await db.sessions.put(session);
    await db.dayLogs.put({ date, dayType, status: "done" });
  });
  return session;
}

export async function mutateSession(db: AlfredDB, id: string, fn: (s: Session) => void) {
  await db.transaction("rw", db.sessions, async () => {
    const s = await db.sessions.get(id);
    if (!s) return;
    fn(s);
    s.exerciseIds = s.entries.map((e) => e.exerciseId);
    await db.sessions.put(s);
  });
}

export function mutateEntry(db: AlfredDB, sessionId: string, entryId: string, fn: (e: SessionEntry) => void) {
  return mutateSession(db, sessionId, (s) => {
    const e = s.entries.find((x) => x.id === entryId);
    if (e) fn(e);
  });
}

export function updateSet(db: AlfredDB, sessionId: string, entryId: string, setId: string, patch: Partial<SetLog>) {
  return mutateEntry(db, sessionId, entryId, (e) => {
    const set = e.sets.find((x) => x.id === setId);
    if (set) Object.assign(set, patch);
    if (patch.done !== undefined) e.done = e.sets.filter((x) => x.kind !== "warmup").every((x) => x.done);
  });
}

export function addSet(db: AlfredDB, sessionId: string, entryId: string, kind: SetKind, unit: Unit, incrementKg: number) {
  return mutateEntry(db, sessionId, entryId, (e) => {
    const nonWarm = e.sets.filter((s) => s.kind !== "warmup");
    const last = nonWarm[nonWarm.length - 1];
    if (kind === "drop") {
      const parent = [...e.sets].reverse().find((s) => s.kind === "working" || s.kind === "failure" || s.kind === "drop");
      const base = parent?.weight !== null && parent?.weight !== undefined ? convert(parent.weight, parent.unit, unit) : null;
      // Typical drop: ~20% lighter, rounded to the exercise's step.
      const step = Math.max(displayStep(unit), incrementFor(incrementKg, unit) / 2);
      e.sets.push(
        newSet(unit, {
          kind: "drop",
          weight: base === null ? null : Math.max(0, roundTo(base * 0.8, step)),
          reps: parent?.reps ?? null,
          parentId: parent?.kind === "drop" ? parent.parentId : parent?.id,
        }),
      );
    } else {
      e.sets.push(
        newSet(unit, {
          kind,
          weight: last?.weight === null || !last ? null : convert(last.weight, last.unit, unit),
          reps: last?.reps ?? e.repMin,
        }),
      );
    }
    e.done = false;
  });
}

export function addWarmups(db: AlfredDB, sessionId: string, entryId: string, sets: { weight: number; reps: number }[], unit: Unit) {
  return mutateEntry(db, sessionId, entryId, (e) => {
    const warm = sets.map((w) => newSet(unit, { kind: "warmup", weight: w.weight, reps: w.reps }));
    e.sets = [...warm, ...e.sets.filter((s) => s.kind !== "warmup")];
  });
}

export function removeSet(db: AlfredDB, sessionId: string, entryId: string, setId: string) {
  return mutateEntry(db, sessionId, entryId, (e) => {
    e.sets = e.sets.filter((s) => s.id !== setId && s.parentId !== setId);
  });
}

/** Set every working set to a weight (from an overload suggestion). */
export function applyWeight(db: AlfredDB, sessionId: string, entryId: string, weight: number, reps: number, unit: Unit) {
  return mutateEntry(db, sessionId, entryId, (e) => {
    for (const s of e.sets) {
      if (s.done || (s.kind !== "working" && s.kind !== "failure")) continue;
      s.weight = weight;
      s.unit = unit;
      s.reps = reps;
    }
  });
}

export async function swapExercise(db: AlfredDB, session: Session, entryId: string, exercise: Exercise, unit: Unit) {
  const entry = session.entries.find((e) => e.id === entryId);
  if (!entry) return;
  const template = await db.templates.get(session.dayType);
  const slot = template?.slots.find((s) => s.id === entry.slotId);
  const plannedSets = slot?.sets ?? entry.sets.filter((s) => s.kind !== "warmup").length;
  const fresh = await buildEntry(
    db,
    exercise,
    { sets: plannedSets, repMin: entry.repMin, repMax: entry.repMax, target: slot?.exerciseId === exercise.id ? slot.target : null },
    unit,
    session.id,
  );
  await mutateSession(db, session.id, (s) => {
    const idx = s.entries.findIndex((e) => e.id === entryId);
    if (idx === -1) return;
    const original = s.entries[idx];
    s.entries[idx] = {
      ...fresh,
      id: original.id,
      slotId: original.slotId,
      swappedFromExerciseId: original.swappedFromExerciseId ?? original.exerciseId,
    };
    if (s.entries[idx].exerciseId === s.entries[idx].swappedFromExerciseId) delete s.entries[idx].swappedFromExerciseId;
  });
}

export async function addExerciseToSession(db: AlfredDB, session: Session, exercise: Exercise, unit: Unit) {
  const entry = await buildEntry(db, exercise, { sets: 3, repMin: 8, repMax: 12, target: null }, unit, session.id);
  await mutateSession(db, session.id, (s) => {
    s.entries.push(entry);
  });
  return entry;
}

export function removeEntry(db: AlfredDB, sessionId: string, entryId: string) {
  return mutateSession(db, sessionId, (s) => {
    s.entries = s.entries.filter((e) => e.id !== entryId);
  });
}

export function finishSession(db: AlfredDB, sessionId: string) {
  return mutateSession(db, sessionId, (s) => {
    s.status = "done";
    s.finishedAt = Date.now();
  });
}

export function reopenSession(db: AlfredDB, sessionId: string) {
  return mutateSession(db, sessionId, (s) => {
    s.status = "active";
  });
}

export async function deleteSession(db: AlfredDB, session: Session) {
  await db.transaction("rw", [db.sessions, db.dayLogs], async () => {
    await db.sessions.delete(session.id);
    const others = await db.sessions.where("date").equals(session.date).count();
    if (!others) await db.dayLogs.delete(session.date);
  });
}

export async function logRestDay(db: AlfredDB, date: string) {
  await db.dayLogs.put({ date, dayType: "rest", status: "done" });
}

export function overloadFor(
  exercise: Exercise,
  entry: Pick<SessionEntry, "repMin" | "repMax">,
  plannedSets: number,
  history: HistoryPoint[],
  target: TemplateSlot["target"],
  unit: Unit,
  bodyweightKg: number | null,
) {
  return suggestOverload({ exercise, repMin: entry.repMin, repMax: entry.repMax, plannedSets, history, target, unit, bodyweightKg });
}

export function workingSetCount(entry: SessionEntry) {
  return entry.sets.filter((s) => s.kind === "working" || s.kind === "failure").length;
}

export function completedWorking(entry: SessionEntry) {
  return entry.sets.filter(isWorking).length;
}

/** The last completed non-warm-up set, which "same again" copies. */
export function lastDoneSet(entry: SessionEntry): SetLog | undefined {
  return [...entry.sets].reverse().find((s) => s.done && s.kind !== "warmup");
}

/**
 * "Same again": copy the last completed set into the next open set and complete it,
 * or append a new completed set when every set is done. Returns the completed set's id.
 */
export async function repeatLastSet(db: AlfredDB, sessionId: string, entryId: string): Promise<string | null> {
  let doneId: string | null = null;
  await mutateEntry(db, sessionId, entryId, (e) => {
    const prev = lastDoneSet(e);
    if (!prev) return;
    const prevIdx = e.sets.indexOf(prev);
    const next = e.sets.find((s, i) => i > prevIdx && !s.done && s.kind !== "warmup");
    const copy = { weight: prev.weight, unit: prev.unit, reps: prev.reps, done: true, completedAt: Date.now() };
    if (next) {
      Object.assign(next, copy);
      doneId = next.id;
    } else {
      const added = newSet(prev.unit, { ...copy, kind: prev.kind, parentId: prev.kind === "drop" ? prev.parentId : undefined });
      e.sets.push(added);
      doneId = added.id;
    }
    e.done = e.sets.filter((x) => x.kind !== "warmup").every((x) => x.done);
  });
  return doneId;
}
