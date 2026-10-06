"use client";

import { MUSCLE_META } from "@/lib/domain/muscles";
import type { Muscle } from "@/lib/domain/types";
import { cn } from "@/lib/cn";

/**
 * Stylised "armour plate" anatomy. Each muscle is a set of plates drawn on the
 * figure's left half (viewBox 0 0 200 460, centre x = 100) and mirrored.
 */
type Plates = Partial<Record<Muscle, string[]>>;

const FRONT: Plates = {
  upperBack: ["M91 59 L76 67 L84 72 L97 66 Z"],
  chest: ["M98 75 L98 113 Q86 119 71 111 L67 97 L73 81 Q85 73 98 75 Z"],
  frontDelts: ["M73 79 L67 96 L60 100 Q56 85 61 75 Q67 69 77 69 L84 73 Z"],
  sideDelts: ["M59 75 Q53 86 57 100 L51 99 Q47 83 55 73 Q61 67 69 67 Z"],
  biceps: ["M58 104 L68 101 L69 133 Q62 141 54 135 L52 113 Z"],
  forearms: ["M53 139 L66 137 L64 178 L56 181 L47 160 Z"],
  abs: ["M86 120 L98 120 L98 135 L86 135 Z", "M86 138 L98 138 L98 154 L86 154 Z", "M86 157 L98 157 L98 178 L87 180 Z"],
  obliques: ["M83 120 L72 114 L70 150 Q72 170 84 184 L84 120 Z"],
  quads: ["M73 198 Q66 232 70 262 L80 276 L93 271 Q97 236 93 202 Z"],
  adductors: ["M96 199 L99 200 L98 246 L93 258 Q97 228 96 199 Z"],
  calves: ["M73 293 Q68 320 75 350 L82 352 Q83 320 81 294 Z"],
};

const BACK: Plates = {
  upperBack: ["M100 59 L84 64 L72 72 L80 82 L92 96 L100 110 Z"],
  rearDelts: ["M72 73 L61 76 Q55 86 58 98 L68 95 L79 83 Z"],
  sideDelts: ["M59 75 Q53 86 57 100 L51 99 Q47 83 55 73 Q61 67 69 67 Z"],
  lats: ["M91 99 L80 85 L70 100 Q72 130 84 150 L96 154 L98 121 Z"],
  triceps: ["M58 101 L68 97 L70 133 Q62 139 54 133 L52 112 Z"],
  forearms: ["M53 138 L66 137 L64 178 L56 181 L47 160 Z"],
  lowerBack: ["M98 156 L87 153 L85 181 L98 184 Z"],
  glutes: ["M98 187 L82 185 Q69 196 71 214 Q82 227 98 223 Z"],
  hamstrings: ["M73 222 Q67 250 71 272 L83 279 L95 273 Q98 247 96 227 Z"],
  calves: ["M72 290 Q65 313 73 342 L86 344 Q92 316 88 290 Z"],
};

/** Neutral silhouette underneath the plates. */
const SILHOUETTE_HALF =
  "M100 10 Q83 10 83 32 Q83 50 92 56 L92 60 L70 66 Q50 70 48 92 L46 130 L44 162 L48 192 L58 196 L66 180 L70 152 L72 186 L68 230 L70 280 L68 300 L70 356 L66 382 Q66 392 78 392 L86 390 L86 356 L90 300 L92 282 L96 250 L100 230 Z";

export type HeatStatus = "untrained" | "below" | "hit";

export interface HeatCell {
  status: HeatStatus;
  /** 0–1, fraction of target. */
  fraction: number;
}

const STATUS_TEXT: Record<HeatStatus, string> = {
  untrained: "not trained",
  below: "below target",
  hit: "target hit",
};

const FILL: Record<HeatStatus, string> = {
  untrained: "var(--crimson)",
  below: "var(--ochre)",
  hit: "var(--verdigris)",
};

export function BodyMap2D({
  view,
  heat,
  selected,
  onSelect,
  className,
}: {
  view: "front" | "back";
  heat: Record<Muscle, HeatCell>;
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
  className?: string;
}) {
  const plates = view === "front" ? FRONT : BACK;
  return (
    <svg
      viewBox="0 0 200 400"
      className={cn("h-full w-full", className)}
      role="group"
      aria-label={`${view === "front" ? "Front" : "Back"} muscle map`}
    >
      <defs>
        <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="rgb(0 0 0 / 0.35)" strokeWidth="1.5" />
        </pattern>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {[1, -1].map((dir) => (
        <g key={dir} transform={dir === -1 ? "translate(200 0) scale(-1 1)" : undefined}>
          <path d={SILHOUETTE_HALF} fill="var(--gunmetal)" stroke="var(--steel)" strokeWidth="0.8" />
        </g>
      ))}
      {(Object.entries(plates) as [Muscle, string[]][]).map(([muscle, paths]) => {
        const cell = heat[muscle];
        const isSel = selected === muscle;
        const opacity = cell.status === "below" ? 0.55 + 0.45 * cell.fraction : cell.status === "hit" ? 0.95 : 0.75;
        return (
          <g
            key={muscle}
            role="button"
            tabIndex={0}
            aria-label={`${MUSCLE_META[muscle].label}: ${STATUS_TEXT[cell.status]}`}
            aria-pressed={isSel}
            onClick={() => onSelect(muscle)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(muscle)}
            className="cursor-pointer outline-none [&:focus-visible_path]:stroke-signal"
            filter={isSel ? "url(#glow)" : undefined}
          >
            {[1, -1].map((dir) => (
              <g key={dir} transform={dir === -1 ? "translate(200 0) scale(-1 1)" : undefined}>
                {paths.map((d, i) => (
                  <g key={i}>
                    <path
                      d={d}
                      fill={FILL[cell.status]}
                      fillOpacity={opacity}
                      stroke={isSel ? "var(--bone)" : "var(--night)"}
                      strokeWidth={isSel ? 1.6 : 1.4}
                      strokeLinejoin="round"
                      className="transition-[fill,fill-opacity] duration-500"
                    />
                    {cell.status === "untrained" && <path d={d} fill="url(#hatch)" pointerEvents="none" />}
                  </g>
                ))}
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
