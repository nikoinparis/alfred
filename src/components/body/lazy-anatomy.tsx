"use client";

import dynamic from "next/dynamic";
import type { Exercise, Muscle } from "@/lib/domain/types";
import type { HeatStatus } from "./anatomy-figure";

/** three.js only loads when a figure is on screen. */
export const LazyAnatomy = dynamic(() => import("./anatomy-figure").then((m) => m.AnatomyFigure), {
  ssr: false,
  loading: () => <div className="grid min-h-48 place-items-center text-sm text-fog">Loading anatomy…</div>,
});

export const HEAT_COLOR: Record<HeatStatus, string> = {
  untrained: "#d0675f",
  below: "#dcae55",
  hit: "#4fb38f",
};

/** Pastel study palette, in the spirit of colour-coded anatomy plates. */
export const ANATOMY_COLOR: Record<Muscle, string> = {
  chest: "#e89a8f",
  frontDelts: "#d98fb4",
  sideDelts: "#cc8fc0",
  rearDelts: "#b98fc9",
  triceps: "#9f9ad6",
  biceps: "#b48ad1",
  forearms: "#8fc9a0",
  upperBack: "#e6a07f",
  lats: "#8fa6d9",
  lowerBack: "#d6b07a",
  abs: "#e8857f",
  obliques: "#8f9fd1",
  glutes: "#d68fa8",
  quads: "#e8988a",
  hamstrings: "#a3c98f",
  adductors: "#c6a3d6",
  calves: "#8fc4c9",
};

export const PRIMARY_COLOR = "#3a86ff";
export const SECONDARY_COLOR = "#8fb6f0";

/** Highlight colours for "what does this work": primary strong, secondary soft, rest recedes. */
export function workColor(exercises: Exercise[]) {
  const primary = new Set(exercises.flatMap((e) => e.primary));
  const secondary = new Set(exercises.flatMap((e) => e.secondary));
  return (m: Muscle) => (primary.has(m) ? PRIMARY_COLOR : secondary.has(m) ? SECONDARY_COLOR : null);
}
