/**
 * Builds public/models/body.glb from BodyParts3D (© The Database Center for Life Science, CC BY 4.0).
 *
 *   node scripts/body-model/build.mjs <bodyparts3d-dir>
 *
 * <bodyparts3d-dir> must contain isa_element_parts.txt and isa/isa_BP3D_4.0_obj_99/*.obj
 * (from https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html).
 *
 * Output: one mesh per app muscle group (named by the keys in src/lib/domain/muscles.ts),
 * plus "otherMuscles", "tendons", "bones" and "skin" (head, hands, feet).
 * BodyParts3D has no rectus abdominis or latissimus dorsi, so those two are generated as
 * surface patches fitted to the skin mesh by raycasting.
 */
import fs from "node:fs";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, meshopt, normals, prune, quantize } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { bounds, loadIndex, merge, readObj } from "./obj.mjs";

const dataDir = process.argv[2];
if (!dataDir) {
  console.error("usage: node scripts/body-model/build.mjs <bodyparts3d-dir>");
  process.exit(1);
}
const OUT = path.resolve("public/models/body.glb");

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Frontal rays (toward -z) for the abdomen. */
const frontRay = Object.assign((u, v) => ({ o: [u, v, 1], dir: [0, 0, -1] }), { at: () => ({ dir: [0, 0, -1] }) });
/** Rays from behind (toward +z). */
const backRay = Object.assign((u, v) => ({ o: [u, v, -1], dir: [0, 0, 1] }), { at: () => ({ dir: [0, 0, 1] }) });

const ABS_TOP = 1.19;
const ABS_BOTTOM = 0.855;
/** Tendinous intersections (top to bottom); the lowest segment below the navel is the long one. */
const ABS_ROWS = [ABS_TOP, 1.112, 1.04, 0.968, ABS_BOTTOM];
const absWidth = (y) => 0.046 + 0.026 * ((y - ABS_BOTTOM) / (ABS_TOP - ABS_BOTTOM));

const TORSO_Z = 0.095;
const LAT_BOTTOM = 0.93;
const LAT_TOP = 1.29;

const SIDED = /\b(left|right)\b/;

/** First matching rule wins. Patterns match BodyParts3D English names. */
const RULES = [
  ["chest", /pectoralis major/],
  ["frontDelts", /clavicular part of (left|right) deltoid/],
  ["sideDelts", /acromial part of (left|right) deltoid/],
  ["rearDelts", /spinal part of (left|right) deltoid/],
  ["triceps", /triceps brachii|anconeus/],
  ["biceps", /biceps brachii|brachialis\b|coracobrachialis/],
  [
    "forearms",
    /brachioradialis|flexor carpi|extensor carpi|palmaris longus|pronator teres|flexor digitorum superficialis|extensor digitorum$|(left|right) extensor digitorum\b(?! longus)|flexor pollicis longus|abductor pollicis longus|extensor pollicis/,
  ],
  ["upperBack", /trapezius|rhomboid|infraspinatus|teres minor|supraspinatus/],
  ["lats", /teres major/],
  ["lowerBack", /iliocostalis lumborum|longissimus thoracis|spinalis thoracis|iliocostalis thoracis/],
  ["obliques", /external oblique|serratus anterior/],
  ["glutes", /gluteus maximus|gluteus medius|tensor fasciae latae/],
  ["quads", /rectus femoris|vastus lateralis|vastus medialis|sartorius/],
  ["hamstrings", /biceps femoris|semitendinosus|semimembranosus/],
  ["adductors", /adductor longus|adductor brevis|adductor magnus|gracilis|pectineus/],
  ["calves", /gastrocnemius|soleus/],
  [
    "otherMuscles",
    /sternocleidomastoid|levator scapulae|semispinalis capitis|splenius|tibialis anterior|fibularis|extensor digitorum longus|extensor hallucis longus|platysma/,
  ],
  ["tendons", /iliotibial tract|calcaneal tendon|linea alba/],
  // Only bones that show between muscles; vertebrae and hand/foot bones sit under muscle or skin.
  ["bones", /\b(tibia|fibula|patella|clavicle|hip bone|scapula|radius|ulna)\b|\brib\b|sternum|costal cartilage/],
];

function classify(name) {
  const lower = name.toLowerCase();
  for (const [group, re] of RULES) {
    if (!re.test(lower)) continue;
    if (group === "bones" || group === "tendons") return group;
    return SIDED.test(lower) ? group : null; // sided leaves only, so aggregates don't double up
  }
  return null;
}

const { objDir, byName } = loadIndex(dataDir);
const fileGroup = new Map();
for (const [name, files] of byName) {
  const g = classify(name);
  if (!g) continue;
  for (const f of files) if (!fileGroup.has(f)) fileGroup.set(f, g);
}

const groups = new Map();
for (const [file, g] of fileGroup) {
  const m = readObj(path.join(objDir, `${file}.obj`));
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(m);
}
let merged = new Map([...groups].map(([g, ms]) => [g, merge(ms)]));

// --- Trim the external oblique's aponeurosis off the front of the abdomen (that's where the abs go).
merged.set(
  "obliques",
  filterTriangles(merged.get("obliques"), (c) => !(Math.abs(c[0]) < 0.07 && c[2] > 0.12 && c[1] < 1.2)),
);

// --- Muscle above the skull base sits under the head skin; drop it so it can't show through the mouth/eye openings.
for (const g of ["upperBack", "otherMuscles"])
  merged.set(
    g,
    filterTriangles(merged.get(g), (c) => c[1] < 1.49),
  );

// --- Skin: keep head, hands and feet so the figure reads as a whole body.
const skin = readObj(path.join(objDir, `${[...byName.get("skin")][0]}.obj`));
const wristY = bounds(merged.get("forearms").positions).min[1] + 0.02;
merged.set(
  "skin",
  filterTriangles(skin, (c) => c[1] > 1.5 || c[1] < 0.075 || (Math.abs(c[0]) > 0.2 && c[1] < wristY)),
);

// --- Generated muscles fitted to the skin surface.
const skinTris = trianglesOf(skin);
merged.set("abs", absPatch(skinTris));
merged.set("tendons", merge([merged.get("tendons"), rectusSheath(skinTris), lumbarFascia(skinTris)]));
merged.set("lats", merge([merged.get("lats"), latsPatch(skinTris)]));
merged.set("lowerBack", merge([merged.get("lowerBack"), erectorPatch(skinTris)]));

// --- Center the figure: feet on y = 0, torso centred on z = 0.
const all = bounds(merge([...merged.values()]).positions);
const shiftY = -all.min[1];
const torso = bounds(merged.get("chest").positions);
const shiftZ = -((torso.min[2] + bounds(merged.get("upperBack").positions).min[2]) / 2);

/** Triangle budget per group: big visible muscles get more, filler gets less. */
const BUDGET = {
  bones: 9000,
  skin: 9000,
  obliques: 6000,
  upperBack: 6000,
  otherMuscles: 5000,
  forearms: 5000,
  tendons: 4500,
  chest: 4500,
  quads: 4500,
  hamstrings: 3500,
  adductors: 3000,
  calves: 3500,
  glutes: 3500,
  biceps: 2500,
  triceps: 2500,
  lats: 6000,
  frontDelts: 1500,
  sideDelts: 1500,
  rearDelts: 1500,
  abs: 5000,
  lowerBack: 4000,
};
await MeshoptSimplifier.ready;
for (const [g, m] of merged) {
  const before = m.indices.length / 3;
  const out = budget(m, BUDGET[g] ?? 3000);
  merged.set(g, out);
  console.log(g.padEnd(14), String(before).padStart(7), "→", String(out.indices.length / 3).padStart(6), "tris");
}

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene("body");
for (const [g, m] of merged) {
  const pos = new Float32Array(m.positions);
  for (let i = 0; i < pos.length; i += 3) {
    pos[i + 1] += shiftY;
    pos[i + 2] += shiftZ;
  }
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(pos).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(m.indices).setBuffer(buffer));
  const mesh = doc.createMesh(g).addPrimitive(prim);
  scene.addChild(doc.createNode(g).setMesh(mesh));
}

await MeshoptEncoder.ready;
await doc.transform(normals({ overwrite: true }), dedup(), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
doc.createExtension(KHRMeshQuantization).setRequired(true);
doc.createExtension(EXTMeshoptCompression).setRequired(true);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
await io.write(OUT, doc);

let tris = 0;
for (const mesh of doc.getRoot().listMeshes()) {
  const prim = mesh.listPrimitives()[0];
  const t = (prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION").getCount()) / 3;
  tris += t;
  console.log(mesh.getName().padEnd(14), String(Math.round(t)).padStart(7), "tris");
}
console.log(`total ${Math.round(tris)} tris → ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);

// ---------------------------------------------------------------- helpers

/** Weld duplicate vertices (BodyParts3D files don't share them), then simplify to a triangle budget. */
function budget(m, maxTris) {
  const key = new Map();
  const remap = new Uint32Array(m.positions.length / 3);
  const pos = [];
  for (let i = 0; i < remap.length; i++) {
    const k = `${Math.round(m.positions[i * 3] * 1e4)},${Math.round(m.positions[i * 3 + 1] * 1e4)},${Math.round(m.positions[i * 3 + 2] * 1e4)}`;
    let v = key.get(k);
    if (v === undefined) {
      v = pos.length / 3;
      key.set(k, v);
      pos.push(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]);
    }
    remap[i] = v;
  }
  const positions = new Float32Array(pos);
  let indices = Uint32Array.from(m.indices, (i) => remap[i]);
  if (indices.length / 3 > maxTris) {
    [indices] = MeshoptSimplifier.simplify(indices, positions, 3, maxTris * 3, 0.05, []);
  }
  // Drop vertices no triangle uses any more.
  const used = new Int32Array(positions.length / 3).fill(-1);
  const out = [];
  const idx = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i];
    if (used[v] < 0) {
      used[v] = out.length / 3;
      out.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    }
    idx[i] = used[v];
  }
  return { positions: new Float32Array(out), indices: idx };
}

function centroid(p, a, b, c) {
  return [
    (p[a * 3] + p[b * 3] + p[c * 3]) / 3,
    (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3,
    (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3,
  ];
}

function filterTriangles(m, keep) {
  const out = [];
  for (let i = 0; i < m.indices.length; i += 3) {
    const [a, b, c] = [m.indices[i], m.indices[i + 1], m.indices[i + 2]];
    if (keep(centroid(m.positions, a, b, c))) out.push(a, b, c);
  }
  return { positions: m.positions, indices: new Uint32Array(out) };
}

function trianglesOf(m) {
  const t = [];
  for (let i = 0; i < m.indices.length; i += 3) {
    const v = [m.indices[i], m.indices[i + 1], m.indices[i + 2]].map((k) => [
      m.positions[k * 3],
      m.positions[k * 3 + 1],
      m.positions[k * 3 + 2],
    ]);
    t.push(v);
  }
  return t;
}

/** Möller–Trumbore; returns distance along the ray or null. */
function intersect(o, d, [v0, v1, v2]) {
  const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
  const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
  const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  const s = [o[0] - v0[0], o[1] - v0[1], o[2] - v0[2]];
  const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv;
  if (u < 0 || u > 1) return null;
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
  const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv;
  if (v < 0 || u + v > 1) return null;
  const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
  return t > 0 ? t : null;
}

/**
 * Generic surface patch. A grid over (u, v) parameter space; `ray(u, v)` gives an origin and unit
 * direction pointing into the body; `depth(u, v)` returns how far below the skin the surface sits
 * (null = not part of the patch). `pick: "near"` takes the first skin hit; `"far"` takes the last hit
 * before `maxT`, which skips an arm hanging between the ray origin and the torso. Faces point back toward the ray origin (out of the body).
 */
function castPatch(tris, { us, vs, step, ray, depth, maxT = 10, bbox, pick = "near", accept }) {
  const region = bbox
    ? tris.filter((t) => t.some((p) => p[0] >= bbox[0][0] && p[0] <= bbox[1][0] && p[1] >= bbox[0][1] && p[1] <= bbox[1][1]))
    : tris;
  const nu = Math.round((us[1] - us[0]) / step[0]) + 1;
  const nv = Math.round((vs[1] - vs[0]) / step[1]) + 1;
  const grid = new Array(nu * nv).fill(null);
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const u = us[0] + i * step[0];
      const v = vs[0] + j * step[1];
      const d = depth(u, v);
      if (d === null) continue;
      const { o, dir } = ray(u, v);
      let best = null;
      for (const t of region) {
        const hit = intersect(o, dir, t);
        if (hit === null || hit >= maxT) continue;
        if (best === null || (pick === "far" ? hit > best : hit < best)) best = hit;
      }
      if (best === null) continue;
      if (accept && !accept([o[0] + dir[0] * best, o[1] + dir[1] * best, o[2] + dir[2] * best])) continue;
      const k = best + d;
      grid[j * nu + i] = [o[0] + dir[0] * k, o[1] + dir[1] * k, o[2] + dir[2] * k];
    }
  }
  const positions = [];
  const indices = [];
  const id = new Map();
  const vert = (k) => {
    if (!id.has(k)) {
      id.set(k, positions.length / 3);
      positions.push(...grid[k]);
    }
    return id.get(k);
  };
  for (let j = 0; j + 1 < nv; j++) {
    for (let i = 0; i + 1 < nu; i++) {
      const a = j * nu + i;
      const b = a + 1;
      const c = a + nu;
      const e = c + 1;
      if (!grid[a] || !grid[b] || !grid[c] || !grid[e]) continue;
      indices.push(vert(a), vert(b), vert(e), vert(a), vert(e), vert(c));
    }
  }
  // Orient faces so their normals point away from the body (against the ray).
  const out = new Uint32Array(indices);
  for (let t = 0; t < out.length; t += 3) {
    const [p, q, r] = [out[t], out[t + 1], out[t + 2]].map((k) => positions.slice(k * 3, k * 3 + 3));
    const n = cross(sub(q, p), sub(r, p));
    const centre = [(p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3, (p[2] + q[2] + r[2]) / 3];
    const { dir } = rayAtPoint(centre);
    if (dot(n, dir) > 0) [out[t + 1], out[t + 2]] = [out[t + 2], out[t + 1]];
  }
  return { positions: new Float32Array(positions), indices: out };

  function rayAtPoint(pt) {
    // Re-derive the ray direction for orientation using the same u/v mapping is awkward; approximate
    // with the direction from the nearest grid ray, which is constant for planar casts and smooth for cylindrical ones.
    return ray.at ? ray.at(pt) : ray(0, 0);
  }
}

/** Rectus abdominis: eight rounded, pillowed blocks either side of the linea alba. */
function absPatch(tris) {
  return castPatch(tris, {
    us: [-0.085, 0.085],
    vs: [ABS_BOTTOM, ABS_TOP],
    step: [0.0025, 0.0025],
    ray: frontRay,
    bbox: [
      [-0.11, ABS_BOTTOM - 0.03],
      [0.11, ABS_TOP + 0.03],
    ],
    depth: (x, y) => {
      const ax = Math.abs(x);
      const w = absWidth(y);
      const gap = 0.0035;
      if (ax < 0.008 || ax > w) return null;
      const row = ABS_ROWS.findIndex((h, k) => k + 1 < ABS_ROWS.length && y <= h && y >= ABS_ROWS[k + 1]);
      if (row < 0) return null;
      const top = ABS_ROWS[row] - (row === 0 ? 0 : gap);
      const bottom = ABS_ROWS[row + 1] + (row === ABS_ROWS.length - 2 ? 0 : gap);
      if (y > top || y < bottom) return null;
      const u = (ax - 0.008) / (w - 0.008);
      const v = (y - bottom) / (top - bottom);
      // Rounded-rectangle footprint (superellipse) with a pillow profile.
      const r = Math.pow(Math.abs(2 * u - 1), 4) + Math.pow(Math.abs(2 * v - 1), row === 3 ? 3 : 4);
      if (r > 1) return null;
      const pillow = Math.sqrt(1 - r);
      return 0.008 - 0.0075 * pillow; // edges tuck 8 mm under, centres sit just below the skin
    },
  });
}

/** Ivory sheath behind the abs so the gaps read as tendon lines, as on an écorché. */
function rectusSheath(tris) {
  return castPatch(tris, {
    us: [-0.09, 0.09],
    vs: [ABS_BOTTOM - 0.01, ABS_TOP + 0.005],
    step: [0.004, 0.004],
    ray: frontRay,
    bbox: [
      [-0.12, ABS_BOTTOM - 0.04],
      [0.12, ABS_TOP + 0.04],
    ],
    depth: (x, y) => (Math.abs(x) <= absWidth(Math.min(ABS_TOP, Math.max(ABS_BOTTOM, y))) + 0.006 ? 0.0085 : null),
  });
}

/** Thoracolumbar fascia: the pale diamond over the lower back, under the erectors and lats. */
function lumbarFascia(tris) {
  return castPatch(tris, {
    us: [-0.13, 0.13],
    vs: [0.86, 1.15],
    step: [0.004, 0.004],
    ray: backRay,
    bbox: [
      [-0.16, 0.82],
      [0.16, 1.19],
    ],
    depth: (x, y) => {
      const t = (y - 0.86) / 0.29;
      const w = 0.03 + 0.06 * Math.sin(Math.PI * Math.min(1, t));
      return Math.abs(x) <= w ? 0.016 : null;
    },
  });
}

/** Erector spinae seen through the thoracolumbar fascia: two long columns beside the spine. */
function erectorPatch(tris) {
  return castPatch(tris, {
    us: [-0.06, 0.06],
    vs: [0.9, 1.18],
    step: [0.003, 0.003],
    ray: backRay,
    bbox: [
      [-0.09, 0.86],
      [0.09, 1.22],
    ],
    depth: (x, y) => {
      const ax = Math.abs(x);
      const t = (y - 0.9) / 0.28;
      const outer = 0.055 - 0.014 * t;
      if (ax < 0.009 || ax > outer) return null;
      const u = (ax - 0.009) / (outer - 0.009);
      const fade = smooth(0, 0.15, t) * smooth(1, 0.8, t);
      return 0.011 - 0.01 * Math.pow(Math.sin(Math.PI * u), 0.8) * fade;
    },
  });
}

/**
 * Latissimus dorsi, cast cylindrically around the torso so it wraps from the lower back,
 * around the ribs, up into the armpit. u = angle from the back midline (radians), v = height.
 */
function latsPatch(tris) {
  const R = 0.6;
  const ray = Object.assign((u, v) => ({ o: [Math.sin(u) * R, v, TORSO_Z - Math.cos(u) * R], dir: [-Math.sin(u), 0, Math.cos(u)] }), {
    at: (pt) => {
      const u = Math.atan2(pt[0], TORSO_Z - pt[2]);
      return { dir: [-Math.sin(u), 0, Math.cos(u)] };
    },
  });
  return castPatch(tris, {
    us: [-1.6, 1.6],
    vs: [LAT_BOTTOM, LAT_TOP],
    step: [0.012, 0.003],
    ray,
    maxT: R,
    pick: "far",
    // Only the torso: reject hits on the arm hanging beside it.
    accept: (p) => Math.hypot(p[0], p[2] - TORSO_Z) < 0.175,
    bbox: [
      [-0.3, LAT_BOTTOM - 0.03],
      [0.3, LAT_TOP + 0.03],
    ],
    depth: (u, y) => {
      const a = Math.abs(u);
      const t = (y - LAT_BOTTOM) / (LAT_TOP - LAT_BOTTOM); // 0 waist, 1 armpit
      const inner = 0.1 + 0.62 * Math.pow(t, 1.5); // hugs the spine low, clears the scapula high up
      const outer = 0.95 + 0.35 * Math.sqrt(t); // wraps to the side and into the armpit
      if (a < inner || a > outer) return null;
      if (t > 0.85 && a < 1.05) return null; // top edge tucks under the teres major / armpit
      const s = (a - inner) / (outer - inner);
      const fade = smooth(0, 0.12, t) * smooth(1, 0.85, t);
      return 0.009 - 0.008 * Math.pow(Math.sin(Math.PI * s), 0.7) * fade;
    },
  });
}
