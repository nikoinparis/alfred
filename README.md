# Alfred

Personal training, nutrition and recovery log. Offline-first PWA for one lifter running a Push / Pull / Legs / Upper / Lower split.

Live demo: https://alfred-orpin.vercel.app (opens with a fictional demo athlete; see [Privacy model](#privacy-model)).

See [ROADMAP.md](ROADMAP.md) for status and what's next.

## What's in it

| Tab | What it does |
|---|---|
| **Today** | Pick the day type in one tap (the suggested one is pre-selected), see each exercise with its next weight, then log set by set: per-set weight and reps, warm-up/working/failure/drop kinds, **Same again** (one tap repeats your last set), a quick effort (RPE) prompt that feeds the suggestions, warm-up ramp, plate calculator, PR toasts, swap-for-today. Finish to get a summary and a shareable card. A weekly nudge reminds you to back up. |
| **Plan** | The week (Mon–Sun) with done/planned/skipped days and dashed "ghost" suggestions you can accept or override. Weekly review: push:pull and quad:ham balance, streak. |
| **Body** | Hard sets per muscle this week vs target on a 2D front/back map or a rotatable anatomical 3D model (heat or pastel anatomy colours). Tap a muscle for what hit it and what's left. |
| **Fuel** | Calories and macros vs targets, food search with favourites (Indonesian staples pre-loaded), saved meals, **Log a meal** (photo, description, or both, then refine), bodyweight trend, 7-day summary. Goal engine and weekly check-in under Goal & targets. |
| **History** | Every workout, plus per-exercise estimated-1RM and volume charts. |

Units: kg by default, switch to lb any time in Settings. Each set keeps the unit it was logged in.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: only needed for owner unlock + AI photo logging
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm test` | Unit tests (Vitest): planner, muscle volume, progression, nutrition math, backup, workout repository |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next + React Compiler rules) |
| `npm run format` | Prettier |
| `npm run build` | Production build |

## Deploy free on Vercel

The repo is already linked to a Vercel project; every push to `main` deploys. To set it up from scratch:

1. Import the GitHub repo at https://vercel.com/new (Framework: Next.js, no build settings to change).
2. Project → Settings → Environment Variables, add (Production):
   - `OWNER_PASSPHRASE`: a long passphrase only you know.
   - `ANTHROPIC_API_KEY`: from https://console.anthropic.com (only needed for photo-to-macros).
   - Optional: `ANTHROPIC_VISION_MODEL=claude-haiku-4-5` to halve the per-photo cost, or `VISION_PROVIDER=gemini` + `GEMINI_API_KEY`.
3. Redeploy (Deployments → ⋯ → Redeploy) so the variables take effect.

The Hobby plan is free for personal use.

## Install on iPhone

1. Open the site in **Safari**.
2. Share → **Add to Home Screen**.
3. Open Alfred from the home screen, go to **Settings → Access**, enter your passphrase. This device now uses your own data and can analyse photos.
4. Open each tab once while online so they're cached for offline use in the gym.

## Log a meal (photo and/or description)

- Snap or choose a photo, describe it, or both. Brand names and amounts ("Kellogg's Corn Flakes, 40 g, 200 ml milk") make the model use that product's label instead of guessing. After the estimate, add a detail and tap Re-estimate.

- The phone shrinks the photo to 1024 px JPEG (~200 KB) before upload. Nothing is stored server-side.
- `/api/vision` only answers requests carrying the owner cookie, and caps usage at 30 photos/hour.
- Default model: **Claude Sonnet 5.5** with structured output and low effort, about 1¢ per photo. `claude-haiku-4-5` is about half that. The route also opts into Anthropic's server-side refusal fallback.
- The model returns items, portions, P/C/F, per-item confidence and a calorie range. You edit the draft (rename, ×0.5–×1.5 portion buttons, add or remove items) before anything is saved.
- In demo mode, or on a device that isn't unlocked, you get a canned sample estimate and no API call is made.

## Goal engine

`src/lib/domain/nutrition.ts` (tested in `nutrition.test.ts`), shown step by step in the app:

- **BMR** by Mifflin-St Jeor, × activity factor = **TDEE**.
- **Calories** = TDEE + target rate × 7700 kcal/kg ÷ 7, never below BMR.
- **Protein** 1.6–2.2 g/kg (2.2 on a cut). **Fat** ≥ 0.6 g/kg and ≥ 20% of calories. **Carbs** fill the rest.
- **Presets:** lean/athletic, muscular, strong. They set phase, rate and macro defaults.
- **Weekly check-in:** needs ≥ 4 weigh-ins and ≥ 4 logged days. If intake was more than 150 kcal off target, it asks you to hit the target first. Otherwise it compares the 14-day weight slope with the goal rate and suggests a change of (gap × 7700 ÷ 7) kcal, rounded to 50 and capped at ±300. Accepted adjustments come out of carbs/fat; protein stays fixed.

## Weekly planner rules

The suggestion engine is a pure function in [`src/lib/domain/planner.ts`](src/lib/domain/planner.ts), tested in `planner.test.ts`.

1. **Two blocks:** Push/Pull/Legs (any order), then Upper/Lower (either order). Finishing a block earns a rest day, then the other block starts. Weeks start Monday.
2. **Follow reality, not the calendar.** Suggestions continue from what you actually trained: start with Legs and you get Push, Pull, Rest; start with Lower and Upper is next (no rest in between). Doing a day from the other block starts that block.
3. **Missed or skipped days count as rest.** They clear a pending rest, but days you still owe in the current block stay owed.
4. **Max 3 training days in a row** (setting), including days you've already planned ahead.
5. **No back-to-back overlap.** Upper overlaps Push and Pull, Lower overlaps Legs. If the next pick would clash with yesterday or a planned tomorrow, another day from the block is chosen instead (or rest if none fits).
6. **Ghost days.** Suggestions are dashed "ghost" cards. Accept one (or all) to plan it, tap to override with any day type, or skip it. Everything after re-plans instantly.

## Progression rules

[`src/lib/domain/progression.ts`](src/lib/domain/progression.ts) implements double progression per exercise:

- Every planned working set hit the top of the rep range → add one increment (per-exercise, e.g. 2.5 kg barbell, 4 kg dumbbell pair); two increments if every set was rated RPE ≤ 7. Assisted lifts remove assistance instead. Held back if average RPE ≥ 9.5.
- Two or more reps short on any set, two sessions running at the same weight → step back one increment.
- No estimated-1RM progress across three sessions → deload ~10%.
- Otherwise keep the weight and chase reps.

Sets are logged individually (each set has its own weight and unit), so top sets, back-off sets and drop-set chains are all first-class.

## Muscle volume

Exercise → muscle mapping is data in [`src/lib/domain/catalog.ts`](src/lib/domain/catalog.ts) (editable in Settings → Exercise library). Each completed working or failure set counts 1 hard set for primary muscles and 0.5 for secondary. Drop sets count half, warm-ups don't count. Targets default to ~10 sets/week for major groups and are editable per muscle.

## Privacy model

- All personal data lives in IndexedDB on your device. There's no backend database.
- The public URL always opens in **demo mode**: a separate local database seeded with a fictional athlete, reset each visit.
- **Owner unlock:** Settings → Access → enter your passphrase. The server checks it against `OWNER_PASSPHRASE` and sets a signed, HTTP-only cookie (180 days). That switches this device to your own database and unlocks the AI photo route. Recruiters never see anything of yours because it never leaves your phone.
- Back up regularly from Settings → Your data (JSON, plus CSV exports). iOS can evict storage for web apps that go unused for weeks.

## 3D body model

`public/models/body.glb` is generated by [`scripts/body-model/build.mjs`](scripts/body-model/build.mjs) from **BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution 4.0 International** ([dbarchive.biosciencedbc.jp](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/)). The script maps ~200 anatomical muscles onto the app's 17 groups, simplifies each to a triangle budget, and adds the two muscles BodyParts3D lacks (rectus abdominis, latissimus dorsi) plus a visible erector layer as patches fitted to the skin surface by raycasting. To rebuild: download `isa_BP3D_4.0_obj_99.zip` and `isa_element_parts.txt`, unzip into one folder (`isa/isa_BP3D_4.0_obj_99/*.obj`), then `node scripts/body-model/build.mjs <folder>`.

## Design

Dark-only by intent, with structure informed by Apple's Human Interface Guidelines: the platform UI font for text (Saira Condensed only for numbers), an iOS-style type scale, large titles that collapse into a translucent nav bar, inset grouped lists, a floating material tab bar, sheets with a grabber and leading Cancel/Close, ≥44 pt hit targets, press feedback on every control, and motion that is brief and respects Reduce Motion.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Dexie (IndexedDB) · hand-written service worker · Motion · Recharts · react-three-fiber + drei · glTF-Transform/meshoptimizer (model build) · Zod · Vitest · Anthropic SDK.

UI primitives are hand-rolled (sheet, number field, segmented control, toast) instead of shadcn/ui, to keep the bundle small and the look specific to this app.
