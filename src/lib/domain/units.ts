import type { Unit, Weight } from "./types";

export const LB_PER_KG = 2.2046226218;

export function toKg(value: number, unit: Unit): number {
  return unit === "kg" ? value : value / LB_PER_KG;
}

export function fromKg(kg: number, unit: Unit): number {
  return unit === "kg" ? kg : kg * LB_PER_KG;
}

export function convert(value: number, from: Unit, to: Unit): number {
  return from === to ? value : fromKg(toKg(value, from), to);
}

export function weightToKg(w: Weight): number {
  return toKg(w.value, w.unit);
}

/** Round to the nearest multiple of `step` (avoids float noise like 72.50000001). */
export function roundTo(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(Math.round(value / step) * step * 1000) / 1000;
}

/** Display precision: lbs to 0.5, kg to 0.25 (covers 1.25 kg plates). */
export function displayStep(unit: Unit): number {
  return unit === "kg" ? 0.25 : 0.5;
}

/** Convert a weight into the display unit and round for humans. */
export function displayWeight(value: number, from: Unit, to: Unit): number {
  return roundTo(convert(value, from, to), displayStep(to));
}

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

export function formatWeight(value: number, from: Unit, to: Unit): string {
  return `${formatNumber(displayWeight(value, from, to))} ${to}`;
}

/** An exercise increment (stored in kg) expressed as a sensible step in the display unit. */
export function incrementFor(incrementKg: number, unit: Unit): number {
  if (unit === "kg") return incrementKg;
  // Map common kg jumps to the lb equivalents gyms actually use.
  const table: [number, number][] = [
    [1, 2.5],
    [1.25, 2.5],
    [2, 5],
    [2.5, 5],
    [4, 10],
    [5, 10],
    [10, 20],
  ];
  const hit = table.find(([kg]) => Math.abs(kg - incrementKg) < 0.01);
  return hit ? hit[1] : roundTo(incrementKg * LB_PER_KG, 2.5);
}
