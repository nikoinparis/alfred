import { exerciseHistory, detectPRs, entryVolumeKg, type PR } from "@/lib/domain/progression";
import { hardSetValue } from "@/lib/domain/volume";
import type { Exercise, Session } from "@/lib/domain/types";
import type { AlfredDB } from "@/lib/db/schema";
import { latestBodyweightKg } from "@/lib/db/workouts";

export interface SessionStats {
  durationMin: number;
  hardSets: number;
  volumeKg: number;
  exercisesDone: number;
  prs: { exerciseId: string; name: string; pr: PR }[];
}

export async function computeSessionStats(db: AlfredDB, session: Session, exercises: Record<string, Exercise>): Promise<SessionStats> {
  const bw = await latestBodyweightKg(db);
  let hardSets = 0;
  let volumeKg = 0;
  let exercisesDone = 0;
  const prs: SessionStats["prs"] = [];
  for (const entry of session.entries) {
    const ex = exercises[entry.exerciseId];
    if (!ex) continue;
    const hard = entry.sets.reduce((a, s) => a + hardSetValue(s), 0);
    hardSets += hard;
    if (entry.sets.some((s) => s.done)) exercisesDone += 1;
    if (ex.isConditioning) continue;
    volumeKg += entryVolumeKg(entry, ex, bw);
    const earlier = (await db.sessions.where("exerciseIds").equals(ex.id).toArray()).filter(
      (s) => s.id !== session.id && (s.date < session.date || (s.date === session.date && s.startedAt < session.startedAt)),
    );
    const history = exerciseHistory(earlier, ex, bw);
    for (const pr of detectPRs(entry, history, ex, bw)) {
      if (pr.kind !== "volume") prs.push({ exerciseId: ex.id, name: ex.name, pr });
    }
  }
  const end = session.finishedAt ?? Date.now();
  return {
    durationMin: Math.max(1, Math.round((end - session.startedAt) / 60_000)),
    hardSets,
    volumeKg,
    exercisesDone,
    prs,
  };
}
