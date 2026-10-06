"use client";

import Link from "next/link";
import { Page, SectionTitle } from "@/components/shell/page";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const FEATURES: [string, string][] = [
  [
    "Set-by-set logger",
    "Per-set weight and reps, drop-set chains, rest timer, PR detection and a per-exercise progression suggestion (double progression with stall and deload detection).",
  ],
  [
    "Adaptive weekly planner",
    "Pick any day type with one tap; the planner re-plans the rest of the week from where you actually are in the cycle, with rules against back-to-back muscle overlap and long training streaks.",
  ],
  [
    "Muscle heatmap",
    "Hard sets per muscle per week from a data-driven exercise → muscle map (primary 1, secondary 0.5), in 2D and an interactive 3D view.",
  ],
  [
    "Nutrition",
    "Macro tracking with quick-add foods and saved meals, bodyweight trend, Mifflin-St Jeor targets and a weekly check-in that adjusts calories from your real trend.",
  ],
  [
    "Photo to macros",
    "A server route sends a compressed meal photo to a vision model and returns an editable draft with confidence ranges. The API key never reaches the browser.",
  ],
];

const STACK = [
  "Next.js 16 + TypeScript",
  "Tailwind CSS v4",
  "Dexie (IndexedDB), offline-first",
  "Service worker PWA",
  "Recharts",
  "react-three-fiber",
  "Vitest",
  "Claude API (vision)",
];

export default function AboutPage() {
  return (
    <Page title="About Alfred" subtitle="A personal training log, built for one lifter.">
      <div className="panel p-5">
        <p className="text-[15px] leading-relaxed text-fog-2">
          Alfred is a training, nutrition and recovery app I built for my own Push / Pull / Legs / Upper / Lower split. It installs to the
          iPhone home screen, works offline in the gym, and keeps all data on the device.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-fog-2">
          What you&apos;re seeing is a <span className="text-bone">demo athlete</span> with eight weeks of generated history. Real data
          never leaves the owner&apos;s phone, so there&apos;s nothing personal here to see. Click around and log a set; it resets when you
          leave.
        </p>
        <Link href="/" className={cn(buttonVariants({ variant: "primary" }), "mt-5")}>
          Open today&apos;s workout
        </Link>
      </div>

      <SectionTitle>What it does</SectionTitle>
      <ul className="panel divide-steel">
        {FEATURES.map(([title, body]) => (
          <li key={title} className="px-4 py-3.5">
            <p className="font-medium">{title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-fog">{body}</p>
          </li>
        ))}
      </ul>

      <SectionTitle>How privacy works</SectionTitle>
      <div className="panel p-4 text-sm leading-relaxed text-fog-2">
        <p>
          The public site always opens in demo mode, backed by a separate local database. The owner unlocks their own device once with a
          passphrase checked on the server; that sets an HTTP-only signed cookie which is also what gates the paid AI route. There&apos;s no
          server-side store of personal data to leak.
        </p>
      </div>

      <SectionTitle>Built with</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {STACK.map((s) => (
          <span key={s} className="rounded-full border border-steel bg-gunmetal px-3 py-1.5 text-sm text-fog-2">
            {s}
          </span>
        ))}
      </div>
      <p className="mt-6 text-sm text-fog">
        Source:{" "}
        <a href="https://github.com/nikoinparis/alfred" className="text-bone underline underline-offset-4" target="_blank" rel="noreferrer">
          github.com/nikoinparis/alfred
        </a>
      </p>
    </Page>
  );
}
