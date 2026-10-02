import { mulberry32 } from "../../lib/random";
import { clamp, easeInOutCubic, smoothstep } from "../../lib/math";

/**
 * All node data is seeded here, once, at module level:
 *  - a sphere position (fuzzy shell: dense core, defined surface, loose fringe),
 *  - a column position derived from the sphere position (polar angle -> height,
 *    azimuth kept, radius scaled) so sphere neighbours stay close in the column,
 *  - reveal time and morph delay.
 * nodePosition(i, frame) is a pure function of the frame.
 */
export const NODE_COUNT = 3000;
export const DURATION = 450;

const COL_TOP = 1.78;
const COL_BOTTOM = -1.5;
const COL_RADIUS = 0.62;

const rand = mulberry32(0x91e5a7);

export type Node = {
  sx: number; sy: number; sz: number; // sphere
  cx: number; cy: number; cz: number; // column
  reveal: number; // frame the node pops in
  morph: number; // frame its column -> sphere move starts
  fringe: boolean;
  size: number;
  colorPick: number; // 0..1, mapped to the version palette
  bright: boolean;
  rx: number; ry: number; rz: number; spin: number;
  wx: number; wy: number; wz: number; pw: number; // stray drift
};

const randomDir = (): [number, number, number] => {
  const y = rand() * 2 - 1;
  const a = rand() * Math.PI * 2;
  const s = Math.sqrt(1 - y * y);
  return [Math.cos(a) * s, y, Math.sin(a) * s];
};

export const NODES: Node[] = [];
for (let i = 0; i < NODE_COUNT; i++) {
  const kind = rand();
  const fringe = kind > 0.92;
  let r: number;
  if (kind < 0.78) r = 0.98 * Math.pow(rand(), 0.5); // dense body
  else if (kind < 0.92) r = 0.86 + 0.16 * rand(); // surface
  else r = 1.06 + 0.6 * Math.pow(rand(), 1.6); // stray fringe
  const [dx, dy, dz] = randomDir();
  const az = Math.atan2(dz, dx);
  const radial = COL_RADIUS * r * (0.85 + 0.3 * rand());
  const cy = (COL_TOP + COL_BOTTOM) / 2 + dy * ((COL_TOP - COL_BOTTOM) / 2) * (0.97 + 0.06 * rand());
  // Reveal: a front grows down the column (0..95) while the allowed radius widens (45..210).
  const tFront = (95 * (COL_TOP - cy)) / (COL_TOP - COL_BOTTOM);
  const tRadius = radial <= 0.08 ? 0 : 45 + 165 * Math.pow(clamp((radial - 0.08) / 1.1), 1 / 1.6);
  const reveal = Math.max(tFront, Math.min(205, tRadius)) + rand() * 10;
  const hNorm = clamp((cy - COL_BOTTOM) / (COL_TOP - COL_BOTTOM));
  NODES.push({
    sx: dx * r, sy: dy * r, sz: dz * r,
    cx: Math.cos(az) * radial, cy, cz: Math.sin(az) * radial,
    reveal,
    morph: 180 + hNorm * 80 + rand() * 15,
    fringe,
    size: 0.019 * (0.7 + 0.6 * rand()),
    colorPick: rand(),
    bright: rand() < 0.05,
    rx: rand() * 6.28, ry: rand() * 6.28, rz: rand() * 6.28, spin: (rand() - 0.5) * 0.02,
    wx: 0.01 + rand() * 0.02, wy: 0.01 + rand() * 0.02, wz: 0.01 + rand() * 0.02, pw: rand() * 6.28,
  });
}

/** 3-4 nearest neighbours in the final sphere, deduplicated. */
export const LINKS: Array<[number, number]> = (() => {
  const seen = new Set<number>();
  const out: Array<[number, number]> = [];
  const best = new Array<[number, number]>(4);
  for (let i = 0; i < NODE_COUNT; i++) {
    const a = NODES[i];
    const k = a.fringe ? 2 : rand() < 0.5 ? 3 : 4;
    let n = 0;
    for (let j = 0; j < NODE_COUNT; j++) {
      if (j === i) continue;
      const b = NODES[j];
      const d = (a.sx - b.sx) ** 2 + (a.sy - b.sy) ** 2 + (a.sz - b.sz) ** 2;
      let m: number;
      if (n < k) {
        best[n] = [d, j];
        m = n++;
      } else if (d < best[k - 1][0]) {
        best[k - 1] = [d, j];
        m = k - 1;
      } else continue;
      {
        for (; m > 0 && best[m][0] < best[m - 1][0]; m--) {
          const t = best[m];
          best[m] = best[m - 1];
          best[m - 1] = t;
        }
      }
    }
    for (let m = 0; m < k; m++) {
      const j = best[m][1];
      const key = Math.min(i, j) * NODE_COUNT + Math.max(i, j);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([i, j]);
    }
  }
  return out;
})();

const POP = 10;
/** Node appear amount (0..1) at a frame. */
export const nodeAppear = (n: Node, frame: number) => smoothstep(0, 1, (frame - n.reveal) / POP);

/** Writes the node's group-space position at `frame` into out[o..o+2]. */
export const nodePosition = (n: Node, frame: number, out: Float32Array, o: number) => {
  const e = easeInOutCubic((frame - n.morph) / 50);
  // Bulge outward along the path so nodes flow, not slide.
  const bulge = 0.28 * Math.sin(Math.PI * e);
  const cl = Math.hypot(n.cx, n.cz) || 1;
  let x = n.cx + (n.sx - n.cx) * e + (n.cx / cl) * bulge;
  let y = n.cy + (n.sy - n.cy) * e;
  let z = n.cz + (n.sz - n.cz) * e + (n.cz / cl) * bulge;
  if (n.fringe) {
    const amp = 0.09 * smoothstep(290, 360, frame);
    x += amp * Math.sin(frame * n.wx + n.pw);
    y += amp * Math.sin(frame * n.wy + n.pw * 1.3);
    z += amp * Math.sin(frame * n.wz + n.pw * 0.7);
  }
  out[o] = x;
  out[o + 1] = y;
  out[o + 2] = z;
};
