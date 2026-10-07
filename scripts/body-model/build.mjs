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
  ["tendons", /iliotibial tract|calcaneal tendon/],
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
  tendons: 1500,
  chest: 4500,
  quads: 4500,
  hamstrings: 3500,
  adductors: 3000,
  calves: 3500,
  glutes: 3500,
  biceps: 2500,
  triceps: 2500,
  lats: 4000,
  frontDelts: 1500,
  sideDelts: 1500,
  rearDelts: 1500,
  abs: 3000,
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
 * Cast a grid of rays at the skin and build a surface patch where `mask(x, y)` returns a
 * bulge amount (> 0 to include). `dir` is +1 for rays travelling toward +z (hitting the back).
 */
function surfacePatch(tris, { xs, ys, dir, inset, mask }) {
  const [x0, x1] = xs;
  const [y0, y1] = ys;
  const region = tris.filter((t) => t.some((v) => v[0] >= x0 - 0.02 && v[0] <= x1 + 0.02 && v[1] >= y0 - 0.02 && v[1] <= y1 + 0.02));
  const step = 0.004;
  const nx = Math.round((x1 - x0) / step) + 1;
  const ny = Math.round((y1 - y0) / step) + 1;
  const grid = new Array(nx * ny).fill(null);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * step;
      const y = y0 + j * step;
      const bulge = mask(x, y);
      if (bulge <= 0) continue;
      const o = [x, y, dir > 0 ? -1 : 1];
      const d = [0, 0, dir];
      let best = null;
      for (const t of region) {
        const hit = intersect(o, d, t);
        if (hit !== null && (best === null || hit < best)) best = hit;
      }
      if (best === null) continue;
      const z = o[2] + d[2] * best;
      grid[j * nx + i] = [x, y, z + dir * (inset - bulge)];
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
  for (let j = 0; j + 1 < ny; j++) {
    for (let i = 0; i + 1 < nx; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const e = c + 1;
      if (!grid[a] || !grid[b] || !grid[c] || !grid[e]) continue;
      // Wind so the face points out of the body.
      if (dir < 0) indices.push(vert(a), vert(b), vert(e), vert(a), vert(e), vert(c));
      else indices.push(vert(a), vert(e), vert(b), vert(a), vert(c), vert(e));
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

/** Rectus abdominis: two columns either side of the linea alba, split into four blocks each. */
function absPatch(tris) {
  const top = 1.19;
  const bottom = 0.86;
  const intersections = [1.105, 1.03, 0.955]; // tendinous intersections, top to bottom
  return surfacePatch(tris, {
    xs: [-0.075, 0.075],
    ys: [bottom, top],
    dir: -1,
    inset: 0.004,
    mask: (x, y) => {
      const ax = Math.abs(x);
      const t = (y - bottom) / (top - bottom);
      const width = 0.048 + 0.022 * t; // narrower toward the pubis
      if (ax < 0.006 || ax > width) return 0;
      if (intersections.some((h) => Math.abs(y - h) < 0.004)) return 0;
      // Pillow each block: higher in the middle of its column.
      const u = (ax - 0.006) / (width - 0.006);
      return 0.001 + 0.004 * Math.sin(Math.PI * u);
    },
  });
}

/** Erector spinae as seen through the thoracolumbar fascia: two columns beside the spine. */
function erectorPatch(tris) {
  return surfacePatch(tris, {
    xs: [-0.06, 0.06],
    ys: [0.9, 1.18],
    dir: 1,
    inset: 0.004,
    mask: (x, y) => {
      const ax = Math.abs(x);
      const t = (y - 0.9) / 0.28;
      const outer = 0.055 - 0.012 * t;
      if (ax < 0.008 || ax > outer) return 0;
      const u = (ax - 0.008) / (outer - 0.008);
      return 0.001 + 0.006 * Math.sin(Math.PI * u);
    },
  });
}

/** Latissimus dorsi: a fan from the armpit down to the lower back on each side. */
function latsPatch(tris) {
  return surfacePatch(tris, {
    xs: [-0.19, 0.19],
    ys: [0.95, 1.3],
    dir: 1,
    inset: 0.005,
    mask: (x, y) => {
      const ax = Math.abs(x);
      const t = (y - 0.95) / (1.3 - 0.95); // 0 at the waist, 1 at the armpit
      const inner = 0.035 + 0.075 * t * t; // hugs the spine low down, pulls away up top
      const outer = 0.11 + 0.07 * Math.sqrt(t);
      if (ax < inner || ax > outer) return 0;
      if (y > 1.24 && ax < 0.12) return 0; // trapezius and scapula cover the top middle
      const u = (ax - inner) / (outer - inner);
      return 0.001 + 0.003 * Math.sin(Math.PI * u);
    },
  });
}
