# Alfred

Personal training, nutrition and recovery log. Offline-first PWA for one lifter running a Push / Pull / Legs / Upper / Lower split.

Live demo: https://alfred-orpin.vercel.app (opens with a fictional demo athlete; see [Privacy model](#privacy-model)).

See [ROADMAP.md](ROADMAP.md) for status and what's next.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: only needed for owner unlock + AI photo logging
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm test` | Unit tests (Vitest) for planner, volume, progression, nutrition, backup |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next + React Compiler rules) |
| `npm run build` | Production build |

## Weekly planner rules

The suggestion engine is a pure function in [`src/lib/domain/planner.ts`](src/lib/domain/planner.ts), tested in `planner.test.ts`.

1. **Base cycle:** Push → Pull → Legs → Rest → Upper → Lower → Rest, repeating. Weeks start Monday.
2. **Follow reality, not the calendar.** The next suggestion continues from the last day type you actually trained. Start the week on Upper and you get Lower, Rest, Push, Pull, Legs, Rest.
3. **Missed or skipped days count as rest.** They fill a pending rest slot, but an owed training day is never skipped over: miss Pull and Pull is still next.
4. **Max 3 training days in a row** (setting), including days you've already planned ahead.
5. **No back-to-back overlap.** Push/Pull/Legs each own a muscle group; Upper overlaps Push and Pull, Lower overlaps Legs. If the cycle's pick would clash with yesterday or with a planned tomorrow, the cycle jumps to the next non-clashing day type.
6. **Ghost days.** Suggestions are dashed "ghost" cards. Accept one (or all) to plan it, tap to override with any day type, or skip it. Everything after re-plans instantly.

## Progression rules

[`src/lib/domain/progression.ts`](src/lib/domain/progression.ts) implements double progression per exercise:

- Every planned working set hit the top of the rep range → add one increment (per-exercise, e.g. 2.5 kg barbell, 4 kg dumbbell pair). Assisted lifts remove assistance instead. Held back if average RPE ≥ 9.5.
- Two or more reps short on any set, two sessions running at the same weight → step back one increment.
- No estimated-1RM progress across three sessions → deload ~10%.
- Otherwise keep the weight and chase reps.

Sets are logged individually (each set has its own weight and unit), so top sets, back-off sets and drop-set chains are all first-class. Drop sets count as 0.5 hard sets for muscle volume; warm-ups don't count.

## Privacy model

- All personal data lives in IndexedDB on your device. There's no backend database.
- The public URL always opens in **demo mode**: a separate local database seeded with a fictional athlete, reset each visit.
- **Owner unlock:** Settings → Access → enter your passphrase. The server checks it against `OWNER_PASSPHRASE` and sets a signed, HTTP-only cookie. That switches this device to your own database and unlocks the AI photo route. Recruiters never see anything of yours because it never leaves your phone.
- Back up regularly from Settings → Your data (JSON, plus CSV exports). iOS can evict storage for web apps that go unused for weeks.
