import * as THREE from "three";
import { mulberry32 } from "../lib/random";

// A periodic 40 x 40 patch of ~900 loosely piled boxes, "settled" once at load with a
// seeded heightfield drop (no physics at render time). Tiled along the travel direction.
export const TILE = 40;
export const BOX_COUNT = 900;
const GRID = 0.1;
const N = TILE / GRID;

export interface BoxSpec {
  pos: THREE.Vector3; // centre, in tile coordinates [0, 40)
  quat: THREE.Quaternion;
  size: THREE.Vector3; // w (x), h (y), d (z)
  decalType: number; // 0 none, 1 label, 2 pictograms
  decalCell: number;
  decalFace: number; // 0 top, 1 +z side
  decalRect: THREE.Vector4; // cu, cv, width, height in face metres
  variation: number;
}

export const buildLayout = (): BoxSpec[] => {
  const rng = mulberry32(0xb0c5);
  const hf = new Float32Array(N * N);
  const idx = (x: number, z: number) => {
    const i = ((Math.floor(x / GRID) % N) + N) % N;
    const j = ((Math.floor(z / GRID) % N) + N) % N;
    return j * N + i;
  };
  const boxes: BoxSpec[] = [];
  const cols = 25;
  const rows = 24;
  for (let b = 0; b < BOX_COUNT; b++) {
    const s = 0.6 + 1.8 * Math.pow(rng(), 1.2);
    // Base-layer boxes fit their grid cell so they sit side by side without overlapping.
    const cap = b < cols * rows ? 1.5 : 2.4;
    const w = Math.min(cap, Math.max(0.6, s * (0.75 + 0.5 * rng())));
    const d = Math.min(cap, Math.max(0.6, s * (0.75 + 0.5 * rng())));
    let h = Math.max(0.4, s * (0.42 + 0.4 * rng()));
    const extraX = (rng() - 0.5) * 0.1, extraZ = (rng() - 0.5) * 0.1;
    // Try a few seeded spots and settle into the lowest one (boxes fill gaps first).
    let best: { x: number; z: number; yaw: number; gx: number; gz: number; base: number } | null = null;
    const tries = b < cols * rows ? 1 : 16;
    for (let tr = 0; tr < tries; tr++) {
      let x: number, z: number;
      if (b < cols * rows) {
        const cx = b % cols, cz = Math.floor(b / cols);
        x = ((cx + 0.5 + 0.12 * (rng() - 0.5)) * TILE) / cols;
        z = ((cz + 0.5 + 0.12 * (rng() - 0.5)) * TILE) / rows;
      } else {
        x = rng() * TILE;
        z = rng() * TILE;
      }
      const yaw = b < cols * rows ? Math.floor(rng() * 4) * (Math.PI / 2) + (rng() - 0.5) * 0.3 : rng() * Math.PI * 2;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const pts: { dx: number; dz: number; h: number }[] = [];
      const K = 6;
      for (let a = 0; a <= K; a++) for (let c = 0; c <= K; c++) {
        const lx = (a / K - 0.5) * w * 0.96, lz = (c / K - 0.5) * d * 0.96;
        const dx = lx * cy + lz * sy, dz = -lx * sy + lz * cy;
        pts.push({ dx, dz, h: hf[idx(x + dx, z + dz)] });
      }
      // Least-squares support plane.
      let sxx = 0, szz = 0, sxz = 0, sxh = 0, szh = 0, mh = 0;
      for (const p of pts) mh += p.h;
      mh /= pts.length;
      for (const p of pts) {
        sxx += p.dx * p.dx; szz += p.dz * p.dz; sxz += p.dx * p.dz;
        sxh += p.dx * (p.h - mh); szh += p.dz * (p.h - mh);
      }
      const det = sxx * szz - sxz * sxz || 1;
      const onFloor = b < cols * rows;
      let gx = (onFloor ? 0 : (sxh * szz - szh * sxz) / det) + extraX;
      let gz = (onFloor ? 0 : (szh * sxx - sxh * sxz) / det) + extraZ;
      const maxG = Math.tan((25 * Math.PI) / 180);
      const gl = Math.hypot(gx, gz);
      if (gl > maxG) { gx *= maxG / gl; gz *= maxG / gl; }
      // Rest on the support: high points let the box lean, but it may press a little
      // into neighbours (loose pile) rather than balancing on a single corner.
      const rel = pts.map((p) => p.h - (gx * p.dx + gz * p.dz)).sort((u, v) => u - v);
      const base = b < cols * rows ? 0 : Math.max(0, rel[rel.length - 1]);
      if (!best || base < best.base) best = { x, z, yaw, gx, gz, base };
    }
    const { x, z, yaw, gx, gz, base } = best!;
    // Keep the pile to 2-3 loose layers: a box landing high is a flatter carton.
    const TOP_CAP = 2.5;
    const reach = base + 0.5 * Math.max(w, d) * Math.hypot(gx, gz) + h;
    if (reach > TOP_CAP) h = Math.max(0.35, h - (reach - TOP_CAP));
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const n = new THREE.Vector3(-gx, 1, -gz).normalize();
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const qTilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    const quat = qTilt.multiply(qYaw);
    const pos = new THREE.Vector3(x, base, z).addScaledVector(n, h / 2);
    pos.x += 0; // keep centre in tile coordinates
    // Stamp the new top surface.
    const KS = Math.ceil(Math.max(w, d) / GRID) + 2;
    const topC = base + h / n.y;
    for (let a = 0; a <= KS; a++) for (let c = 0; c <= KS; c++) {
      const lx = (a / KS - 0.5) * w, lz = (c / KS - 0.5) * d;
      const dx = lx * cy + lz * sy, dz = -lx * sy + lz * cy;
      const i = idx(x + dx, z + dz);
      hf[i] = Math.max(hf[i], topC + gx * dx + gz * dz);
    }
    // Decals on ~25% of boxes: labels (most) or handling pictograms; top or the +z side.
    let decalType = 0, decalCell = 0, decalFace = 0;
    const decalRect = new THREE.Vector4();
    const r = rng();
    if (r < 0.25) {
      decalType = r < 0.19 ? 1 : 2;
      decalFace = rng() < 0.55 ? 0 : 1;
      const fw = w, fh = decalFace === 0 ? d : h;
      if (decalType === 1) {
        decalCell = Math.floor(rng() * 5);
        const lw = Math.min(0.62, fw * 0.5), lh = lw * 0.5;
        decalRect.set((rng() - 0.5) * (fw - lw) * 0.6 + (rng() < 0.5 ? -1 : 1) * Math.min(0.2, fw * 0.18), (rng() - 0.5) * (fh - lh) * 0.5, lw, lh);
      } else {
        decalCell = 5 + Math.floor(rng() * 3);
        const lw = Math.min(0.8, fw * 0.6), lh = lw * 0.5;
        decalRect.set((rng() < 0.5 ? -1 : 1) * fw * 0.22, decalFace === 0 ? (rng() - 0.5) * fh * 0.4 : fh * 0.18, lw, lh);
      }
    }
    boxes.push({ pos, quat, size: new THREE.Vector3(w, h, d), decalType, decalCell, decalFace, decalRect, variation: rng() });
  }
  return boxes;
};

export const LAYOUT = buildLayout();
export const PILE_TOP = (() => {
  const tops = LAYOUT.map((b) => b.pos.y + b.size.y / 2).sort((a, b) => a - b);
  return tops[Math.floor(tops.length * 0.9)];
})();
