import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge has to know our custom colour tokens; otherwise it reads e.g.
 * `text-signal-ink` as a font size and drops it when merged with `text-base`.
 */
const COLORS = [
  "night",
  "kevlar",
  "gunmetal",
  "gunmetal-2",
  "steel",
  "steel-2",
  "fog",
  "fog-2",
  "bone",
  "signal",
  "signal-ink",
  "signal-soft",
  "crimson",
  "ochre",
  "verdigris",
  "ice",
];

const twMerge = extendTailwindMerge({
  extend: {
    theme: { color: COLORS },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
