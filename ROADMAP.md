# Roadmap

| # | Milestone | Status |
|---|-----------|--------|
| 0 | Foundation: design system, PWA shell, local DB, seed split, demo/owner modes, backup | ✅ |
| 1 | Workout logger, today checklist, rest timer, PRs, swaps, history charts, overload suggestions | ✅ |
| 2 | Weekly planner with smart day-type suggestions, weekly review, streaks | ✅ |
| 3 | Body heatmap (2D + 3D) | ✅ |
| 4 | Calorie & macro tracking, bodyweight trend | ⏳ |
| 5 | Photo-to-macros, goal engine, weekly check-in | ⏳ |

## 3D body model: options and what shipped

Goal: a rotatable body where each muscle group is its own mesh, coloured by weekly volume.

| Option | License | Separate muscles? | Tradeoffs |
|---|---|---|---|
| **Z-Anatomy** (Blender, from BodyParts3D) | CC BY-SA 4.0 | Yes, hundreds | Medically accurate, but hundreds of MB. Needs Blender work to merge into our 17 groups, decimate and export a single GLB (~2–5 MB). Share-alike applies to the model file. |
| **BodyParts3D** (DBCLS) | CC BY-SA 2.1 JP | Yes (per-part OBJ) | Same source data as Z-Anatomy, rawer. Same merge/decimate work. |
| Sketchfab écorché models | Varies (often CC BY) | Usually one mesh | Look great, but you'd have to cut muscles apart by hand. |
| **Stylised low-poly figure built in code** ✅ shipped | Ours | Yes, by construction | Tiny (no asset download), instant, every region is data in `body-map-3d.tsx`. Reads as "suit armour" rather than anatomy. |

**Shipped:** the stylised figure: a dark mannequin with muscle plates built from primitives (react-three-fiber, lazy-loaded only when you open 3D). Rotate, pinch-zoom, tap a muscle. The 2D SVG view stays as the default and fallback.

**Recommended upgrade if you want anatomical realism:** take Z-Anatomy into Blender, join meshes into the 17 groups in `src/lib/domain/muscles.ts`, name each object after its muscle key, decimate to ~60k tris total, export `public/models/body.glb` with Draco, and swap the primitives for `useGLTF` meshes keyed by name. The heat colouring and selection code don't change. Add attribution (CC BY-SA) on the About page.
