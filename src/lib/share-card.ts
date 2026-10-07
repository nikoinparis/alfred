import { displayWeight, formatNumber } from "@/lib/domain/units";
import type { Exercise, Session, Unit } from "@/lib/domain/types";
import type { SessionStats } from "./session-stats";
import { DAY_LABEL } from "@/lib/domain/muscles";
import { format } from "date-fns";
import { parseISODate } from "@/lib/domain/dates";

/** Renders a 1080×1350 session summary image (Instagram portrait) entirely client-side. */
export async function renderShareCard(
  session: Session,
  stats: SessionStats,
  exercises: Record<string, Exercise>,
  unit: Unit,
): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const root = getComputedStyle(document.documentElement);
  const display = root.getPropertyValue("--font-saira").trim() || "sans-serif";
  const body = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  await document.fonts?.ready;

  const bg = g.createRadialGradient(W / 2, -200, 100, W / 2, 0, 1400);
  bg.addColorStop(0, "#1b222c");
  bg.addColorStop(1, "#090b0f");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Signal beam
  const beam = g.createLinearGradient(W, 0, W * 0.4, H * 0.6);
  beam.addColorStop(0, "rgba(58,134,255,0.24)");
  beam.addColorStop(1, "rgba(58,134,255,0)");
  g.fillStyle = beam;
  g.beginPath();
  g.moveTo(W, 0);
  g.lineTo(W * 0.55, H * 0.55);
  g.lineTo(W * 0.25, H * 0.42);
  g.closePath();
  g.fill();

  const pad = 88;
  g.fillStyle = "#3a86ff";
  g.font = `600 30px ${body}`;
  g.fillText(format(parseISODate(session.date), "EEEE d MMMM yyyy"), pad, 150);

  g.fillStyle = "#e9ecf0";
  g.font = `700 210px ${display}`;
  g.fillText(DAY_LABEL[session.dayType].toUpperCase(), pad - 6, 360);

  const statsRow: [string, string][] = [
    [`${stats.durationMin}`, "minutes"],
    [formatNumber(Math.round(stats.hardSets * 10) / 10), "hard sets"],
    [formatNumber(Math.round(displayWeight(stats.volumeKg, "kg", unit))), `${unit} moved`],
  ];
  statsRow.forEach(([v, l], i) => {
    const x = pad + i * 310;
    g.fillStyle = "#e9ecf0";
    g.font = `600 96px ${display}`;
    g.fillText(v, x, 520);
    g.fillStyle = "#8e98a7";
    g.font = `400 30px ${body}`;
    g.fillText(l, x, 565);
  });

  g.strokeStyle = "#283140";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(pad, 625);
  g.lineTo(W - pad, 625);
  g.stroke();

  let y = 700;
  const lifts = session.entries.filter((e) => !exercises[e.exerciseId]?.isConditioning && e.sets.some((s) => s.done)).slice(0, 7);
  for (const e of lifts) {
    const ex = exercises[e.exerciseId];
    const best = e.sets
      .filter((s) => s.done && s.kind !== "warmup")
      .sort((a, b) => (b.weight ?? 0) * (b.reps ?? 0) - (a.weight ?? 0) * (a.reps ?? 0))[0];
    const isPr = stats.prs.some((p) => p.exerciseId === e.exerciseId);
    g.fillStyle = isPr ? "#3a86ff" : "#b4bcc8";
    g.font = `500 36px ${body}`;
    g.fillText(truncate(g, ex?.name ?? "", 600), pad, y);
    if (best) {
      const text = `${best.weight !== null ? formatNumber(displayWeight(best.weight, best.unit, unit)) : "BW"} × ${best.reps}`;
      g.font = `600 48px ${display}`;
      g.fillStyle = "#e9ecf0";
      g.textAlign = "right";
      g.fillText(text, W - pad, y + 4);
      g.textAlign = "left";
    }
    y += 78;
  }

  if (stats.prs.length) {
    g.fillStyle = "#3a86ff";
    g.font = `600 34px ${body}`;
    g.fillText(`${stats.prs.length} personal record${stats.prs.length > 1 ? "s" : ""}`, pad, H - 120);
  }
  g.fillStyle = "#5b6472";
  g.font = `700 34px ${display}`;
  g.textAlign = "right";
  g.fillText("ALFRED", W - pad, H - 120);

  return new Promise((resolve) => c.toBlob((b) => resolve(b!), "image/png"));
}

function truncate(g: CanvasRenderingContext2D, text: string, max: number) {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
