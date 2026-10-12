import { mulberry32, TAU } from "../../engine/rng";
import { SEG_STRIDE } from "../../engine/lines";

// Plexus: ~1,800 points around the bulb, denser at the upper right and top.
// Each point runs a closed loop (whole cycles per 600 frames) around its home,
// and the whole cloud sways around the bulb's vertical axis (also periodic).
// Links are rebuilt from the frame's positions every frame with a fixed
// spatial grid and a fixed pair order — nothing is carried between frames.

export const PLEXUS_N = 1800;
export const LINK_R = 0.46;
export const MAX_LINKS = 14000;

const C = { x: 0, y: 1.6, z: 0 };

type Pt = {
  hx: number; hy: number; hz: number; // home
  e1: [number, number, number]; e2: [number, number, number]; // loop plane
  rho: number; n: number; ph: number; // loop radius, cycles per loop, phase
  size: number; inten: number;
  d0: number; // distance from envelope centre (for draw-on)
};

const sig = (x: number) => 1 / (1 + Math.exp(-x));

export const PLEXUS: Pt[] = (() => {
  const r = mulberry32(0xb01b);
  const out: Pt[] = [];
  let guard = 0;
  while (out.length < PLEXUS_N && guard++ < 2_000_000) {
    const x = -4.6 + r() * 11.6;
    const y = -1.8 + r() * 9.6;
    const z = -3.6 + r() * 7.2;
    const dx = x - C.x,
      dy = y - C.y,
      dz = z - C.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1.08) continue;
    if (Math.hypot(x, z) < 0.5 && y < 0.9 && y > -1.1) continue;
    // Shell around the glass, biased up and to the right, plus a plume rising off the top right.
    const shell = 1.0 * Math.exp(-(d - 1.08) / 0.6) + 0.35 * Math.exp(-(d - 1.08) / 1.5);
    const bias = 0.3 + 0.7 * sig((dx * 0.8 + dy * 0.7) / 0.9);
    const plumeX = 1.1 + 0.3 * (y - 2.0);
    const plume = Math.exp(-((x - plumeX) ** 2) / 2.2) * Math.min(1, Math.max(0, (y - 2.2) / 1.5)) * Math.exp(-(z * z) / 4);
    const w = 0.75 * shell * bias + 0.14 * plume;
    if (r() > w / 1.15) continue;
    // Loop plane: random orthonormal pair.
    const a = r() * TAU,
      b = Math.acos(2 * r() - 1);
    const nrm: [number, number, number] = [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)];
    const tmp: [number, number, number] = Math.abs(nrm[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const e1 = norm(cross(nrm, tmp));
    const e2 = cross(nrm, e1);
    const bright = r() < 0.12;
    out.push({
      hx: x,
      hy: y,
      hz: z,
      e1,
      e2,
      rho: 0.1 + r() * 0.32,
      n: r() < 0.5 ? 1 : r() < 0.6 ? -1 : 2,
      ph: r() * TAU,
      size: bright ? 1.8 + r() * 0.8 : 1.0 + r() * 0.5,
      inten: bright ? 1.4 : 0.55 + r() * 0.5,
      d0: d,
    });
  }
  return out;
})();

function cross(a: number[], b: number[]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// Fixed grid over the bounding box (with margin for the motion).
const G0 = { x: -7, y: -3.2, z: -6.5 };
const GX = Math.ceil(16 / LINK_R),
  GY = Math.ceil(12.6 / LINK_R),
  GZ = Math.ceil(13 / LINK_R);
const cellCount = GX * GY * GZ;

// Scratch buffers: fully rewritten on every call (no state survives a frame).
const pos = new Float32Array(PLEXUS_N * 3);
const vis = new Float32Array(PLEXUS_N);
const cellOf = new Int32Array(PLEXUS_N);
const cellStart = new Int32Array(cellCount + 1);
const cellItems = new Int32Array(PLEXUS_N);

export type PlexusOut = { positions: Float32Array; si: Float32Array; segs: Float32Array; segCount: number };

/**
 * Positions, point size/intensity and link segments for loop phase t (0..1)
 * and a draw-on radius `reveal` (distance from the glass centre; Infinity = all).
 */
export const plexusFrame = (t: number, reveal: number, out: PlexusOut) => {
  const sway = 0.2 * Math.sin(TAU * t + 0.6) + 0.06 * Math.sin(TAU * 2 * t + 2.0);
  const cs = Math.cos(sway),
    sn = Math.sin(sway);
  for (let i = 0; i < PLEXUS_N; i++) {
    const p = PLEXUS[i];
    const th = p.ph + TAU * p.n * t;
    const c = Math.cos(th) * p.rho,
      s = Math.sin(th) * p.rho;
    let x = p.hx + p.e1[0] * c + p.e2[0] * s;
    const y = p.hy + p.e1[1] * c + p.e2[1] * s + 0.08 * Math.sin(TAU * t + p.hx);
    let z = p.hz + p.e1[2] * c + p.e2[2] * s;
    // Sway about the bulb's vertical axis.
    const rx = x * cs - z * sn,
      rz = x * sn + z * cs;
    x = rx;
    z = rz;
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    const v = reveal === Infinity ? 1 : 1 - smooth(reveal - 1.4, reveal, p.d0);
    vis[i] = v;
    out.positions[i * 3] = x;
    out.positions[i * 3 + 1] = y;
    out.positions[i * 3 + 2] = z;
    out.si[i * 2] = p.size * (0.4 + 0.6 * v);
    out.si[i * 2 + 1] = p.inten * v;
  }

  // Counting sort into grid cells (stable: ascending point index).
  cellStart.fill(0);
  for (let i = 0; i < PLEXUS_N; i++) {
    const cx = clampi(Math.floor((pos[i * 3] - G0.x) / LINK_R), GX),
      cy = clampi(Math.floor((pos[i * 3 + 1] - G0.y) / LINK_R), GY),
      cz = clampi(Math.floor((pos[i * 3 + 2] - G0.z) / LINK_R), GZ);
    const c = (cx * GY + cy) * GZ + cz;
    cellOf[i] = c;
    cellStart[c + 1]++;
  }
  for (let c = 0; c < cellCount; c++) cellStart[c + 1] += cellStart[c];
  const fill = cellStart.slice(0, cellCount);
  for (let i = 0; i < PLEXUS_N; i++) cellItems[fill[cellOf[i]]++] = i;

  // Pairs within LINK_R, in a fixed order: i ascending, neighbour cells in a
  // fixed order, j ascending within a cell, j > i.
  let n = 0;
  const R2 = LINK_R * LINK_R;
  const segs = out.segs;
  for (let i = 0; i < PLEXUS_N && n < MAX_LINKS; i++) {
    if (vis[i] <= 0.001) continue;
    const c = cellOf[i];
    const cz = c % GZ,
      cy = Math.floor(c / GZ) % GY,
      cx = Math.floor(c / (GZ * GY));
    const xi = pos[i * 3],
      yi = pos[i * 3 + 1],
      zi = pos[i * 3 + 2];
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++)
        for (let oz = -1; oz <= 1; oz++) {
          const nx = cx + ox,
            ny = cy + oy,
            nz = cz + oz;
          if (nx < 0 || ny < 0 || nz < 0 || nx >= GX || ny >= GY || nz >= GZ) continue;
          const nc = (nx * GY + ny) * GZ + nz;
          for (let k = cellStart[nc]; k < cellStart[nc + 1]; k++) {
            const j = cellItems[k];
            if (j <= i || vis[j] <= 0.001) continue;
            const dx = pos[j * 3] - xi,
              dy = pos[j * 3 + 1] - yi,
              dz = pos[j * 3 + 2] - zi;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 >= R2) continue;
            const f = 1 - Math.sqrt(d2) / LINK_R;
            const a = f * f * Math.min(vis[i], vis[j]);
            const o = n * SEG_STRIDE;
            segs[o] = xi;
            segs[o + 1] = yi;
            segs[o + 2] = zi;
            segs[o + 3] = pos[j * 3];
            segs[o + 4] = pos[j * 3 + 1];
            segs[o + 5] = pos[j * 3 + 2];
            segs[o + 6] = a;
            segs[o + 7] = a;
            n++;
            if (n >= MAX_LINKS) break;
          }
        }
  }
  out.segCount = n;
  return out;
};

const clampi = (v: number, n: number) => (v < 0 ? 0 : v >= n ? n - 1 : v);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
