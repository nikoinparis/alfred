# Roadmap

## Round 4 (8 Oct 2026)

- **Quick add without AI:** usual foods are one-tap chips; typing a saved food with an amount ("2 kellogs", "half a bowl of cereal and 2 telur rebus") logs it locally; AI estimates and manual entries can be saved to My foods with a serving size.

- **Planner** now fits each Mon–Sun week: Push→Pull pair with Legs before or after, Upper/Lower pair either way, rest between blocks; short weeks keep Push/Pull/Legs and prioritise Upper over Lower.
- **Fuel:** one "What did you eat?" box: type a dish (Indonesian portions assumed) for an instant AI estimate, or tap the camera; "My foods" for your saved library. The calorie ring now shows maintenance (to hold weight) plus the surplus to grow.

## Round 3 (7 Oct 2026)

- **Nightwing goal** built in: your stats (179 cm, 64.6 kg, 22) and a lean bulk to 72 kg, then maintenance. Goal card on Fuel, ETA, switch-to-maintenance prompt, V-taper muscle targets.
- **Anatomy as a plate:** front and back side by side (no rotation, no Front/Back or 2D/3D toggles), reused everywhere: Body, Today's hero, and day/exercise detail. Abs are now eight rounded blocks over an ivory sheath; lats fan from the armpit down to the waist; lower back shows the erectors over the lumbar fascia.
- **See what everything trains:** tap an exercise on Today, or tap a day on Plan and switch between day types, to see primary (blue) and secondary (light blue) muscles.
- **Plan** is a vertical timeline with a dashed check to accept a suggestion; days before you started aren't marked missed.
- **Today** remembers the day type you pick and no longer shows the suggestion dot.
- **Snap a meal** is photo first, then describe.
- **Look:** Nightwing electric-blue accent, new swept-wing emblem and app icon, crisper card edges, day hero card.
- The workouts you saw before were the **demo athlete**. Your own data starts empty once you unlock with your passphrase.

## Round 2 (7 Oct 2026, from your feedback)

- **Planner:** Push/Pull/Legs is one block in any order, Upper/Lower another in either order; rest comes after a finished block, so Lower → Upper back to back is suggested, not Lower → Rest.
- **Removed:** the rest timer and the food quick-add strip (favourites still sort first in food search).
- **Log a meal:** photo, description, or both. Brand and amount ("Kellogg's Corn Flakes, 40 g, 200 ml milk") make Claude use that product's label. After the estimate you can add a detail and re-estimate. Description-only works too.
- **Shipped the top suggestions:** weekly backup nudge with one-tap share to Files; **Same again** (one tap logs the next set with the last weight × reps); a quick effort (RPE) prompt after each set, and RPE-aware overload (all sets ≤ RPE 7 → double step).
- **Design pass informed by Apple's HIG:** system font for text, iOS-style type scale, collapsing large titles over a translucent nav bar, inset grouped lists, floating material tab bar with a sliding selection, sheets with grabber and leading Cancel/Close, animated segmented controls, iOS-proportioned switches, ≥44 pt targets, press feedback everywhere.
- **3D body:** replaced the mannequin with an anatomical écorché built from BodyParts3D's real muscle meshes (CC BY 4.0), modelled on your reference: heat colours by default, a pastel **Anatomy** mode, tap any muscle, Front/Back swings the camera. Abs, lats and the lower-back layer are generated to fit the body because the dataset lacks them.

## ☀️ Morning summary (overnight build, 7 Oct 2026)

**Live:** https://alfred-orpin.vercel.app · **Repo:** https://github.com/nikoinparis/alfred (public, auto-deploys on push to `main`)

All five milestones are built, tested (76 unit tests), committed one per milestone, and deployed. The public URL opens in demo mode with a fictional athlete; your data only exists on your devices once you unlock.

### Do these first (about 5 minutes)

1. **Vercel → alfred → Settings → Environment Variables**, add `OWNER_PASSPHRASE` (pick a long one) and `ANTHROPIC_API_KEY`. Then **Deployments → ⋯ → Redeploy**.
2. **On your iPhone:** open the URL in Safari → Share → Add to Home Screen → open it → Settings → Access → enter the passphrase. You start with an empty log plus your split as templates.
3. Tap through every tab once while online so it's cached for the gym.

### Decisions I made while you slept (change any of them)

- **Units:** kg default; your lb working weights were converted and rounded to 0.5 kg (160 lb → 72.5 kg). Switch to lb in Settings any time.
- **"DB Chest Press @160"** is stored as total load. Rest after compound lifts is 150 s, isolation 90 s (Settings).
- **Lat pulldown slot** offers Assisted Pull-up as a swap; your 25 lb assistance is in the slot note. For assisted lifts, "progress" means less assistance.
- **Drop sets** count 0.5 hard set each. Warm-ups count 0.
- **Overload rule:** hit the top of the rep range on every planned set → +1 increment (2.5 kg barbell, 4 kg dumbbell pair, 5 kg cable/machine; editable per exercise). One rep short = hold; two or more short twice = step back; 3 sessions without progress = deload.
- **Weekly targets:** 10 sets for major muscles, fewer for front delts (6), forearms (6), lower back/adductors/obliques (4). Edit on the Body tab.
- **3D body:** a stylised figure built in code instead of an anatomical model (see the section below for options and the upgrade path).
- **UI kit:** hand-rolled components instead of shadcn/ui, so the look is specific and the bundle stays small.
- **Photo AI:** Claude Sonnet 5.5 at low effort (~1¢/photo), with Anthropic's server-side refusal fallback enabled. Set `ANTHROPIC_VISION_MODEL=claude-haiku-4-5` to halve the cost.
- **Demo athlete** resets every visit, and recruiters' photo attempts get a canned sample (no API spend).

### Known gaps / honest notes

- I couldn't run a live photo estimate (no API key on the Mac). The route's auth, validation and error paths are verified; the first real call happens once you add the key.
- The 3D figure is the weakest visual. It works (rotate, zoom, tap) but reads as a mannequin.
- Offline: pages and assets are cached after the first visit. Photo estimates obviously need a connection.

## Suggested next improvements (ranked by value ÷ effort)

| # | Idea | Value | Effort | Notes |
|---|------|-------|--------|-------|
| 1 | **Automatic weekly backup reminder** + one-tap "export to Files" | High | S | Protects against iOS storage eviction, the biggest data-loss risk. |
| 2 | **Next-set prefill after a drop/back-off** and a "same as last set" button | High | S | Fewer taps mid-set. |
| 3 | **RPE-aware suggestions** (auto-regulate the increment when RPE ≤ 7) | Med-High | S | The data is already captured per set. |
| 4 | **Lock-screen rest notifications** via Web Push (iOS 16.4+ home-screen apps) | High | M | Needs VAPID keys + a tiny push route; free. |
| 5 | **Deload week detector** across all lifts (≥3 exercises stalled or 6+ hard weeks) → plan banner | Med | S | Per-exercise deload logic already exists. |
| 6 | **Supabase sync** (free tier) for phone ↔ laptop | High | L | Row-level security on your user only; keeps local-first. |
| 7 | **Barcode scan** for packaged foods (Open Food Facts, free) | Med | M | Great for Indonesian snacks and protein bars. |
| 8 | **Apple Health-style monthly report** (volume, PRs, bodyweight, adherence) as a shareable card | Med | M | Reuses the share-card renderer. |
| 9 | **Anatomical 3D model** via Z-Anatomy → GLB | Med | L | Steps below; mainly visual. |
| 10 | **Per-exercise notes history** (seat settings, grips) shown in the logger | Med | S | Notes are already saved per entry. |

Tell me which ones you want and I'll take them in order.

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 0 | Foundation: design system, PWA shell, local DB, seed split, demo/owner modes, backup | ✅ |
| 1 | Workout logger, today checklist, PRs, swaps, history charts, overload suggestions | ✅ |
| 2 | Weekly planner with smart day-type suggestions, weekly review, streaks | ✅ |
| 3 | Body heatmap (2D + 3D) | ✅ |
| 4 | Calorie & macro tracking, food library, saved meals, bodyweight trend | ✅ |
| 5 | Photo-to-macros, goal engine, weekly check-in | ✅ |

Approved extras, all shipped: JSON/CSV export + import, plate calculator, warm-up ramp generator, session summary card, weekly review + streaks, Indonesian foods quick-add.

## 3D body model: options and what shipped

Goal: a rotatable body where each muscle group is its own mesh, coloured by weekly volume.

| Option | License | Separate muscles? | Tradeoffs |
|---|---|---|---|
| **Z-Anatomy** (Blender, from BodyParts3D) | CC BY-SA 4.0 | Yes, hundreds | Medically accurate, but hundreds of MB. Needs Blender work to merge into our 17 groups, decimate and export a single GLB (~2–5 MB). Share-alike applies to the model file. |
| **BodyParts3D** (DBCLS) | CC BY-SA 2.1 JP | Yes (per-part OBJ) | Same source data as Z-Anatomy, rawer. Same merge/decimate work. |
| Sketchfab écorché models | Varies (often CC BY) | Usually one mesh | Look great, but you'd have to cut muscles apart by hand. |
| **Stylised low-poly figure built in code** ✅ shipped | Ours | Yes, by construction | Tiny (no asset download), instant, every region is data in `body-map-3d.tsx`. Reads as "suit armour" rather than anatomy. |

**Update (round 2):** replaced by the BodyParts3D anatomical model; see README → 3D body model.

**Originally shipped:** the stylised figure: a mannequin with muscle plates built from primitives (react-three-fiber, lazy-loaded only when you open 3D). Rotate, pinch-zoom, tap a muscle. The 2D SVG view stays as the default and fallback.

**Recommended upgrade if you want anatomical realism:** take Z-Anatomy into Blender, join meshes into the 17 groups in `src/lib/domain/muscles.ts`, name each object after its muscle key, decimate to ~60k tris total, export `public/models/body.glb` with Draco, and swap the primitives for `useGLTF` meshes keyed by name. The heat colouring and selection code don't change. Add attribution (CC BY-SA) on the About page.
