import fs from "node:fs";
import path from "node:path";

/**
 * Minimal Wavefront OBJ reader for BodyParts3D files (v + f lines only).
 * Converts BodyParts3D's millimetre, Z-up, front = -Y space into
 * three.js metres, Y-up, front = +Z.
 */
export function readObj(file) {
  const text = fs.readFileSync(file, "utf8");
  const pos = [];
  const idx = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.trim().split(/\s+/).map(Number);
      pos.push(x / 1000, z / 1000, -y / 1000);
    } else if (line.startsWith("f ")) {
      const f = line
        .trim()
        .split(/\s+/)
        .slice(1)
        .map((t) => parseInt(t.split("/")[0], 10) - 1);
      for (let i = 1; i + 1 < f.length; i++) idx.push(f[0], f[i], f[i + 1]);
    }
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

export function merge(meshes) {
  let vCount = 0;
  let iCount = 0;
  for (const m of meshes) {
    vCount += m.positions.length;
    iCount += m.indices.length;
  }
  const positions = new Float32Array(vCount);
  const indices = new Uint32Array(iCount);
  let vo = 0;
  let io = 0;
  for (const m of meshes) {
    positions.set(m.positions, vo);
    const base = vo / 3;
    for (let i = 0; i < m.indices.length; i++) indices[io + i] = m.indices[i] + base;
    vo += m.positions.length;
    io += m.indices.length;
  }
  return { positions, indices };
}

export function bounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }
  return { min, max };
}

/** name → element file ids, from isa_element_parts.txt, keeping only files that exist. */
export function loadIndex(dataDir) {
  const objDir = path.join(dataDir, "isa", "isa_BP3D_4.0_obj_99");
  const have = new Set(fs.readdirSync(objDir).map((f) => f.replace(/\.obj$/, "")));
  const byName = new Map();
  const lines = fs.readFileSync(path.join(dataDir, "isa_element_parts.txt"), "utf8").split("\n").slice(1);
  for (const line of lines) {
    const [, name, fj] = line.split("\t");
    if (!name || !fj || !have.has(fj.trim())) continue;
    const list = byName.get(name) ?? new Set();
    list.add(fj.trim());
    byName.set(name, list);
  }
  return { objDir, byName };
}
