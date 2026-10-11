// Sculpts the android head as a signed distance field, meshes it with
// marching cubes, smooths it with Taubin passes (held back near the panel
// seams so they stay crisp) and writes public/models/android/head.bin.
//
//   node scripts/build-android.mjs            (320^3 along the longest axis)
//   node scripts/build-android.mjs --res=160  (quick preview)
//
// head.bin layout (little endian):
//   uint32  headerBytes
//   JSON    header (space padded to a multiple of 4 bytes)
//   float32 positions[vertexCount * 3]
//   float32 normals[vertexCount * 3]
//   float32 seam[vertexCount]           0 = plastic, 1 = seam groove
//   uint32  indices[indexCount]
// The header holds the counts, byte offsets, eye positions and the face
// wireframe (points + edge polylines lying on the surface).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { edgeTable, triTable } from "three/examples/jsm/objects/MarchingCubes.js";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "public", "models", "android", "head.bin");
const argRes = process.argv.find((a) => a.startsWith("--res="));
const RES = argRes ? Number(argRes.slice(6)) : 320;

// ---------------------------------------------------------------- SDF kit
const length3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smin = (a, b, k) => {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
};
// Smooth subtraction: carve b out of a.
const ssub = (a, b, k) => {
  const h = clamp(0.5 - (0.5 * (a + b)) / k, 0, 1);
  return a + (-b - a) * h + k * h * (1 - h);
};
const smax = (a, b, k) => -smin(-a, -b, k);
// Ellipsoid (Inigo Quilez's bound), good enough near the surface.
const ellipsoid = (px, py, pz, rx, ry, rz) => {
  const k0 = length3(px / rx, py / ry, pz / rz);
  const k1 = length3(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
};
const roundBox = (px, py, pz, bx, by, bz, r) => {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  const qz = Math.abs(pz) - bz + r;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const oz = Math.max(qz, 0);
  return length3(ox, oy, oz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
};
// Capsule with radius varying from ra (at a) to rb (at b).
const roundCone = (px, py, pz, ax, ay, az, bx, by, bz, ra, rb) => {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return length3(dx, dy, dz) - (ra + (rb - ra) * h);
};
const cylY = (px, py, pz, r, y0, y1) => {
  const d = Math.sqrt(px * px + pz * pz) - r;
  const h = Math.max(y0 - py, py - y1);
  return Math.min(Math.max(d, h), 0) + length3(Math.max(d, 0), Math.max(h, 0), 0);
};
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- the head
// Units: the head is about 1.15 tall. +y up, +z out of the face, +x is the
// android's left (screen right when it faces the camera).
const EYE_Y = 0.075;
const EYE_X = 0.152;
const EYE_Z = 0.352;
const SEAM_DEPTH = 0.004;
const SEAM_W = 0.006;
const NECK_RINGS = [-0.55, -0.62, -0.69, -0.76];

// Panel seams, each as a signed distance to a curve across the surface
// (|value| small = on the seam). They are applied as a shallow groove and
// also written out as the per-vertex `seam` value.
const seamField = (x, y, z) => {
  let best = 1;
  const ax = Math.abs(x);
  // From under each eye down to the jaw, bowing outward over the cheek.
  if (z > 0.12 && y < EYE_Y - 0.06 && y > -0.42) {
    const t = (EYE_Y - 0.06 - y) / 0.36;
    const cx = 0.115 + 0.075 * t + 0.03 * Math.sin(t * Math.PI);
    best = Math.min(best, Math.abs(ax - cx));
  }
  // Around the ears.
  {
    const ex = ax - 0.405, ey = y - 0.0, ez = z - 0.01;
    if (ex > -0.08) {
      const r = Math.sqrt((ey / 1.25) ** 2 + ez * ez);
      best = Math.min(best, Math.abs(r - 0.125));
    }
  }
  // Hairline: an arc over the forehead and around the temples.
  if (y > 0.2) {
    const hy = 0.36 + 0.55 * x * x - 0.12 * Math.max(0, -z);
    if (z > -0.25) best = Math.min(best, Math.abs(y - hy));
  }
  // Neck rings.
  for (const ry of NECK_RINGS) {
    if (y < -0.45 && y > -0.85) best = Math.min(best, Math.abs(y - ry));
  }
  // Jawline: where the jaw panel meets the neck.
  if (y < -0.3 && y > -0.58) {
    const jy = -0.44 - 0.1 * (1 - smoothstep(0.0, 0.3, z + 0.1));
    best = Math.min(best, Math.abs(y - jy) + Math.max(0, ax - 0.33));
  }
  // Collarbone and shoulder plates.
  if (y < -0.8) {
    const cy = -0.9 - 0.05 * Math.abs(x) + 0.05 * x * x;
    if (z > -0.05) best = Math.min(best, Math.abs(y - cy) + Math.max(0, 0.12 - ax) * 2);
    // Shoulder plate seam, a vertical curve down each shoulder.
    best = Math.min(best, Math.abs(ax - (0.44 + 0.1 * (-0.9 - y))) + Math.max(0, y + 0.9));
  }
  return best;
};

const head = (x, y, z) => {
  const ax = Math.abs(x);
  // Cranium, the back slightly flattened.
  const zc = z + 0.02;
  const zb = zc < 0 ? zc * 1.28 : zc;
  // Spec proportions 0.42 x 0.52 x 0.47, with the crown pulled in a little
  // so the face does not read as a small part of a big egg.
  const yb = y - 0.06 > 0.15 ? 0.15 + (y - 0.06 - 0.15) * 1.25 : y - 0.06;
  let d = ellipsoid(x, yb, zb, 0.41, 0.48, 0.44);
  // Face plane: flatten the front a little.
  d = smax(d, z - 0.43, 0.12);
  // Brow ridge.
  d = smin(d, ellipsoid(x, y - 0.16, z - 0.345, 0.28, 0.05, 0.06), 0.1);
  // Cheekbones.
  d = smin(d, ellipsoid(ax - 0.19, y + 0.0, z - 0.29, 0.11, 0.08, 0.09), 0.08);
  // Jaw: a rounded box that tapers toward the chin.
  {
    const ty = clamp((y + 0.1) / -0.35, 0, 1); // 0 at top, 1 at the jaw line
    const w = 0.31 - 0.15 * ty * ty;
    const jaw = roundBox(x, y + 0.24, z - 0.12, w, 0.21, 0.27, 0.12);
    d = smin(d, jaw, 0.1);
  }
  // Chin.
  d = smin(d, ellipsoid(x, y + 0.405, z - 0.33, 0.1, 0.075, 0.08), 0.06);
  // Nose: a narrow tapered bridge and a soft tip.
  d = smin(d, roundCone(x, y, z, 0, 0.1, 0.405, 0, -0.08, 0.485, 0.024, 0.032), 0.06);
  d = smin(d, ellipsoid(x, y + 0.095, z - 0.445, 0.052, 0.03, 0.04), 0.05);
  // Philtrum: a soft ridge from the nose to the upper lip.
  d = smin(d, ellipsoid(x, y + 0.15, z - 0.425, 0.03, 0.04, 0.02), 0.04);
  // Lips, closed.
  d = smin(d, ellipsoid(x, y + 0.205, z - 0.416, 0.08, 0.024, 0.032), 0.03);
  d = smin(d, ellipsoid(x, y + 0.243, z - 0.41, 0.068, 0.026, 0.032), 0.03);
  // Mouth groove.
  if (z > 0.38) {
    const g = roundBox(x, y + 0.223, z - 0.46, 0.072, 0.003, 0.05, 0.002);
    d = ssub(d, g, 0.006);
  }
  // Eye sockets.
  d = ssub(d, ellipsoid(ax - EYE_X, y - EYE_Y, z - 0.43, 0.09, 0.056, 0.085), 0.03);
  // Eyelids: thin rims hugging the top and bottom of the eyeball.
  {
    const ex = ax - EYE_X, ey = y - EYE_Y, ez = z - EYE_Z;
    const r = Math.sqrt(ex * ex + ey * ey + ez * ez);
    const shell = Math.abs(r - 0.058) - 0.008;
    const lid = Math.max(shell, Math.abs(ey) < 0.024 ? 0.024 - Math.abs(ey) : -1, -ez - 0.01);
    d = smin(d, lid, 0.012);
  }
  // Ears: flat discs with a shallow dish.
  {
    const ex = ax - 0.4, ey = y - 0.0, ez = z - 0.01;
    let ear = ellipsoid(ex, ey, ez, 0.035, 0.12, 0.08);
    ear = ssub(ear, ellipsoid(ex - 0.03, ey, ez, 0.02, 0.085, 0.055), 0.015);
    d = smin(d, ear, 0.025);
  }
  // Neck with ring grooves and a front gap.
  {
    let neck = cylY(x, y, z + 0.04, 0.2, -0.95, -0.25);
    for (const ry of NECK_RINGS) {
      const tor = Math.sqrt((Math.sqrt(x * x + (z + 0.04) ** 2) - 0.207) ** 2 + (y - ry) ** 2) - 0.012;
      neck = ssub(neck, tor, 0.006);
    }
    d = smin(d, neck, 0.1);
    // Front vertical gap: the dark spine sits in it.
    const gap = roundBox(x, y + 0.7, z - 0.165, 0.009, 0.17, 0.05, 0.004);
    d = ssub(d, gap, 0.006);
  }
  // Shoulders and upper chest: trapezius slopes from the neck down to
  // compact deltoids; a tapered chest block with soft pectoral planes.
  {
    const ty = clamp((-0.9 - y) / 0.4, 0, 1);
    const w = 0.4 + 0.22 * Math.sqrt(ty);
    let body = roundBox(x, y + 1.22, z + 0.04, w, 0.3, 0.21, 0.16);
    body = smin(body, roundCone(ax, y, z, 0.0, -0.84, -0.05, 0.5, -0.98, -0.04, 0.13, 0.15), 0.12);
    body = smin(body, ellipsoid(ax - 0.56, y + 1.1, z + 0.03, 0.17, 0.19, 0.19), 0.14);
    body = smin(body, ellipsoid(ax - 0.19, y + 1.14, z - 0.1, 0.21, 0.14, 0.09), 0.1);
    d = smin(d, body, 0.08);
  }
  // Panel seams: shallow grooves.
  const s = seamField(x, y, z);
  if (s < SEAM_W * 2) d += SEAM_DEPTH * (1 - smoothstep(0, SEAM_W, s));
  return d;
};

const seamValue = (x, y, z) => {
  const s = seamField(x, y, z);
  let v = 1 - smoothstep(SEAM_W * 0.35, SEAM_W * 1.1, s);
  // Neck spine gap and mouth groove read as seams too.
  if (Math.abs(x) < 0.012 && y < -0.52 && y > -0.88 && z > 0.06) v = Math.max(v, 1);
  return v;
};

// ---------------------------------------------------------------- grid
const BOX = { x0: -0.98, x1: 0.98, y0: -1.4, y1: 0.68, z0: -0.56, z1: 0.6 };
const span = Math.max(BOX.x1 - BOX.x0, BOX.y1 - BOX.y0, BOX.z1 - BOX.z0);
const h = span / RES;
const nx = Math.ceil((BOX.x1 - BOX.x0) / h) + 1;
const ny = Math.ceil((BOX.y1 - BOX.y0) / h) + 1;
const nz = Math.ceil((BOX.z1 - BOX.z0) / h) + 1;
console.log(`grid ${nx} x ${ny} x ${nz} (voxel ${h.toFixed(5)})`);
const idx = (i, j, k) => i + nx * (j + ny * k);
const field = new Float32Array(nx * ny * nz);
const t0 = Date.now();
// Coarse pass: skip far-away blocks (only the sign matters there).
const B = 6;
for (let k0 = 0; k0 < nz; k0 += B)
  for (let j0 = 0; j0 < ny; j0 += B)
    for (let i0 = 0; i0 < nx; i0 += B) {
      const cx = BOX.x0 + (i0 + B / 2) * h;
      const cy = BOX.y0 + (j0 + B / 2) * h;
      const cz = BOX.z0 + (k0 + B / 2) * h;
      const dc = head(cx, cy, cz);
      const far = Math.abs(dc) > B * h * 1.2;
      for (let k = k0; k < Math.min(k0 + B, nz); k++)
        for (let j = j0; j < Math.min(j0 + B, ny); j++)
          for (let i = i0; i < Math.min(i0 + B, nx); i++)
            field[idx(i, j, k)] = far ? dc : head(BOX.x0 + i * h, BOX.y0 + j * h, BOX.z0 + k * h);
    }
// Close the mesh at the bottom of the box (the chest is cut flat).
for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) field[idx(i, 0, k)] = Math.max(field[idx(i, 0, k)], h);
console.log(`field ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ---------------------------------------------------------------- marching cubes
// One vertex per crossed grid edge, so the mesh comes out welded.
const edgeVert = new Int32Array(nx * ny * nz * 3).fill(-1);
const pos = [];
const tris = [];
const vertOnEdge = (i, j, k, axis) => {
  const key = idx(i, j, k) * 3 + axis;
  if (edgeVert[key] >= 0) return edgeVert[key];
  const a = field[idx(i, j, k)];
  const i2 = i + (axis === 0 ? 1 : 0), j2 = j + (axis === 1 ? 1 : 0), k2 = k + (axis === 2 ? 1 : 0);
  const b = field[idx(i2, j2, k2)];
  const t = a / (a - b);
  const x = BOX.x0 + (i + (axis === 0 ? t : 0)) * h;
  const y = BOX.y0 + (j + (axis === 1 ? t : 0)) * h;
  const z = BOX.z0 + (k + (axis === 2 ? t : 0)) * h;
  const id = pos.length / 3;
  pos.push(x, y, z);
  edgeVert[key] = id;
  return id;
};
// Edge -> (corner offset, axis), matching three.js' table layout.
const EDGES = [
  [0, 0, 0, 0], [1, 0, 0, 1], [0, 1, 0, 0], [0, 0, 0, 1],
  [0, 0, 1, 0], [1, 0, 1, 1], [0, 1, 1, 0], [0, 0, 1, 1],
  [0, 0, 0, 2], [1, 0, 0, 2], [1, 1, 0, 2], [0, 1, 0, 2],
];
const CORNERS = [
  [0, 0, 0, 1], [1, 0, 0, 2], [1, 1, 0, 4], [0, 1, 0, 8],
  [0, 0, 1, 16], [1, 0, 1, 32], [1, 1, 1, 64], [0, 1, 1, 128],
];
const ev = new Int32Array(12);
for (let k = 0; k < nz - 1; k++)
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      let ci = 0;
      for (const [di, dj, dk, bit] of CORNERS) if (field[idx(i + di, j + dj, k + dk)] > 0) ci |= bit;
      const bits = edgeTable[ci];
      if (!bits) continue;
      for (let e = 0; e < 12; e++)
        if (bits & (1 << e)) {
          const [di, dj, dk, ax] = EDGES[e];
          ev[e] = vertOnEdge(i + di, j + dj, k + dk, ax);
        }
      const o = ci << 4;
      for (let t = 0; triTable[o + t] !== -1; t += 3)
        tris.push(ev[triTable[o + t]], ev[triTable[o + t + 1]], ev[triTable[o + t + 2]]);
    }
const vcount = pos.length / 3;
console.log(`mc ${vcount} verts, ${tris.length / 3} tris, ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ---------------------------------------------------------------- smoothing
const P = new Float32Array(pos);
const seam = new Float32Array(vcount);
for (let v = 0; v < vcount; v++) seam[v] = seamValue(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
// Vertex adjacency (CSR).
const deg = new Int32Array(vcount);
const edgesSeen = new Set();
const pairs = [];
for (let t = 0; t < tris.length; t += 3)
  for (let e = 0; e < 3; e++) {
    const a = tris[t + e], b = tris[t + ((e + 1) % 3)];
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const key = lo * 4294967296 + hi;
    if (edgesSeen.has(key)) continue;
    edgesSeen.add(key);
    pairs.push(lo, hi);
    deg[lo]++;
    deg[hi]++;
  }
edgesSeen.clear();
const start = new Int32Array(vcount + 1);
for (let v = 0; v < vcount; v++) start[v + 1] = start[v] + deg[v];
const fill = start.slice(0, vcount);
const adj = new Int32Array(start[vcount]);
for (let p = 0; p < pairs.length; p += 2) {
  adj[fill[pairs[p]]++] = pairs[p + 1];
  adj[fill[pairs[p + 1]]++] = pairs[p];
}
const laplace = (factor) => {
  const out = new Float32Array(P.length);
  for (let v = 0; v < vcount; v++) {
    let sx = 0, sy = 0, sz = 0;
    const n = start[v + 1] - start[v];
    for (let a = start[v]; a < start[v + 1]; a++) {
      const u = adj[a];
      sx += P[u * 3];
      sy += P[u * 3 + 1];
      sz += P[u * 3 + 2];
    }
    // Weighted down near the seams so the grooves stay sharp.
    const w = factor * (1 - 0.9 * seam[v]);
    out[v * 3] = P[v * 3] + w * (sx / n - P[v * 3]);
    out[v * 3 + 1] = P[v * 3 + 1] + w * (sy / n - P[v * 3 + 1]);
    out[v * 3 + 2] = P[v * 3 + 2] + w * (sz / n - P[v * 3 + 2]);
  }
  P.set(out);
};
for (let pass = 0; pass < 2; pass++) {
  laplace(0.5);
  laplace(-0.53);
}

// Normals from the SDF gradient (smoother than face normals).
const N = new Float32Array(P.length);
const e = h * 0.5;
for (let v = 0; v < vcount; v++) {
  const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
  let gx = head(x + e, y, z) - head(x - e, y, z);
  let gy = head(x, y + e, z) - head(x, y - e, z);
  let gz = head(x, y, z + e) - head(x, y, z - e);
  if (y < BOX.y0 + h * 1.5) { gx = 0; gy = -1; gz = 0; }
  const l = Math.hypot(gx, gy, gz) || 1;
  N[v * 3] = gx / l;
  N[v * 3 + 1] = gy / l;
  N[v * 3 + 2] = gz / l;
}
// Make the winding agree with the outward normals.
let agree = 0;
for (let t = 0; t < tris.length; t += 300) {
  const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
  const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
  const wx = P[c * 3] - P[a * 3], wy = P[c * 3 + 1] - P[a * 3 + 1], wz = P[c * 3 + 2] - P[a * 3 + 2];
  const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
  agree += Math.sign(cx * N[a * 3] + cy * N[a * 3 + 1] + cz * N[a * 3 + 2]);
}
const I = new Uint32Array(tris);
if (agree < 0) for (let t = 0; t < I.length; t += 3) [I[t + 1], I[t + 2]] = [I[t + 2], I[t + 1]];

// ---------------------------------------------------------------- wireframe
// About 140 points on the face's screen-right half (the android's left),
// projected onto the surface from the front, triangulated in face UV space
// (x, y), with each edge resampled along the surface.
const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const project = (x, y) => {
  let z = 0.75;
  for (let it = 0; it < 200; it++) {
    const d = head(x, y, z);
    if (d < 1e-5) break;
    z -= d * 0.8;
    if (z < 0) return null;
  }
  const ee = 0.002;
  const nxv = head(x + ee, y, z) - head(x - ee, y, z);
  const nyv = head(x, y + ee, z) - head(x, y - ee, z);
  const nzv = head(x, y, z + ee) - head(x, y, z - ee);
  const l = Math.hypot(nxv, nyv, nzv);
  return { p: [x, y, z], n: [nxv / l, nyv / l, nzv / l] };
};
const rnd = mulberry32(1338451);
const faceMask = (x, y) => {
  // Inside the face outline (front of the skull down to the chin).
  const fx = x / 0.36, fy = (y - 0.02) / 0.48;
  return fx * fx + fy * fy < 1;
};
const pts = [];
// Anchor points along the centre line and around the eye.
for (let i = 0; i < 9; i++) pts.push([0.0, 0.42 - i * 0.105]);
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  pts.push([EYE_X + Math.cos(a) * 0.105, EYE_Y + Math.sin(a) * 0.07]);
}
// Best-candidate sampling for the rest.
while (pts.length < 140) {
  let best = null, bestD = -1;
  for (let c = 0; c < 24; c++) {
    const x = 0.012 + rnd() * 0.37, y = -0.47 + rnd() * 0.92;
    if (!faceMask(x, y)) continue;
    let dmin = Infinity;
    for (const q of pts) dmin = Math.min(dmin, Math.hypot(q[0] - x, q[1] - y));
    if (dmin > bestD) { bestD = dmin; best = [x, y]; }
  }
  if (best) pts.push(best);
}
// Bowyer-Watson Delaunay in UV space.
const delaunay = (P2) => {
  const big = [[-10, -10], [10, -10], [0, 10]];
  const all = [...P2, ...big];
  const n0 = P2.length;
  let triangles = [[n0, n0 + 1, n0 + 2]];
  const circ = (t) => {
    const [a, b, c] = t.map((i) => all[i]);
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    const ux = ((a[0] ** 2 + a[1] ** 2) * (b[1] - c[1]) + (b[0] ** 2 + b[1] ** 2) * (c[1] - a[1]) + (c[0] ** 2 + c[1] ** 2) * (a[1] - b[1])) / d;
    const uy = ((a[0] ** 2 + a[1] ** 2) * (c[0] - b[0]) + (b[0] ** 2 + b[1] ** 2) * (a[0] - c[0]) + (c[0] ** 2 + c[1] ** 2) * (b[0] - a[0])) / d;
    return [ux, uy, (a[0] - ux) ** 2 + (a[1] - uy) ** 2];
  };
  for (let i = 0; i < n0; i++) {
    const p = all[i];
    const bad = [], good = [];
    for (const t of triangles) {
      const [cx, cy, r2] = circ(t);
      ((p[0] - cx) ** 2 + (p[1] - cy) ** 2 < r2 ? bad : good).push(t);
    }
    const edgeCount = new Map();
    for (const t of bad)
      for (let e2 = 0; e2 < 3; e2++) {
        const a = t[e2], b = t[(e2 + 1) % 3];
        const key = Math.min(a, b) + "," + Math.max(a, b);
        edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
      }
    triangles = good;
    for (const [key, cnt] of edgeCount)
      if (cnt === 1) {
        const [a, b] = key.split(",").map(Number);
        triangles.push([a, b, i]);
      }
  }
  return triangles.filter((t) => t.every((i) => i < n0));
};
const triangles = delaunay(pts);
const wfEdges = new Map();
for (const t of triangles)
  for (let e2 = 0; e2 < 3; e2++) {
    const a = t[e2], b = t[(e2 + 1) % 3];
    const len = Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);
    if (len > 0.2) continue;
    const key = Math.min(a, b) + "," + Math.max(a, b);
    wfEdges.set(key, [Math.min(a, b), Math.max(a, b)]);
  }
const wfPoints = [];
for (const [x, y] of pts) {
  const hit = project(x, y);
  wfPoints.push(hit ? hit.p.map((v, i) => v + hit.n[i] * 0.002) : [x, y, 0.4]);
}
const SUB = 6;
const wfLines = [];
for (const [a, b] of wfEdges.values()) {
  const line = [];
  for (let s2 = 0; s2 <= SUB; s2++) {
    const t = s2 / SUB;
    const x = pts[a][0] + (pts[b][0] - pts[a][0]) * t;
    const y = pts[a][1] + (pts[b][1] - pts[a][1]) * t;
    const hit = project(x, y);
    if (hit) line.push(hit.p.map((v, i) => +(v + hit.n[i] * 0.002).toFixed(5)));
  }
  if (line.length === SUB + 1) wfLines.push({ a, b, pts: line });
}
console.log(`wireframe ${wfPoints.length} points, ${wfLines.length} edges`);

// ---------------------------------------------------------------- write
const header = {
  version: 1,
  vertexCount: vcount,
  indexCount: I.length,
  resolution: RES,
  voxel: h,
  bounds: BOX,
  eyes: [
    { x: -EYE_X, y: EYE_Y, z: EYE_Z },
    { x: EYE_X, y: EYE_Y, z: EYE_Z },
  ],
  wireframe: {
    points: wfPoints.map((p) => p.map((v) => +v.toFixed(5))),
    edges: wfLines,
  },
};
let json = JSON.stringify(header);
while ((json.length + 4) % 4) json += " ";
const jsonBuf = Buffer.from(json, "utf8");
const hb = jsonBuf.length;
const offPos = 4 + hb;
const offNrm = offPos + P.byteLength;
const offSeam = offNrm + N.byteLength;
const offIdx = offSeam + seam.byteLength;
const total = offIdx + I.byteLength;
const buf = Buffer.alloc(total);
buf.writeUInt32LE(hb, 0);
jsonBuf.copy(buf, 4);
Buffer.from(P.buffer).copy(buf, offPos);
Buffer.from(N.buffer).copy(buf, offNrm);
Buffer.from(seam.buffer).copy(buf, offSeam);
Buffer.from(I.buffer).copy(buf, offIdx);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, buf);
console.log(`wrote ${OUT} (${(total / 1e6).toFixed(1)} MB) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
