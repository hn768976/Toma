import { mulberry32 } from "../../lib/random";

// The network is generated once, at module level, from a fixed seed.
export type GNode = {
  x: number;
  y: number;
  r: number;
  shade: 0 | 1 | 2;
  parent: number;
  t: number; // seconds when the badge pops in
};
export type GLink = { a: number; b: number; dashed: boolean; t0: number; t1: number };

const rng = mulberry32(1013125088);
const RX = 575;
const OX = -60; // network centre relative to the hub
const OY = 50;
const RY = 355;
const TARGET = 220;
const SIZES = [13.5, 16.5, 20.5, 26];

const nodes: GNode[] = [{ x: 0, y: 0, r: 36, shade: 0, parent: -1, t: 0 }];
let attempts = 0;
while (nodes.length < TARGET && attempts < 200000) {
  attempts++;
  const x = (rng() * 2 - 1) * RX + OX;
  const y = (rng() * 2 - 1) * RY + OY;
  // soft superellipse boundary, a little ragged
  if (Math.pow(Math.abs((x - OX) / RX), 2.6) + Math.pow(Math.abs((y - OY) / RY), 2.6) > 0.85 + 0.15 * rng()) continue;
  // keep the counter label beside the hub clear
  if (x > 0 && x < 175 && Math.abs(y) < 45) continue;
  const roll = rng();
  const r = SIZES[roll < 0.34 ? 0 : roll < 0.68 ? 1 : roll < 0.9 ? 2 : 3];
  let ok = true;
  for (const n of nodes) {
    const dx = n.x - x;
    const dy = n.y - y;
    const min = n.r + r + (n.r > 30 ? 46 : 8);
    if (dx * dx + dy * dy < min * min) {
      ok = false;
      break;
    }
  }
  if (!ok) continue;
  const d = Math.hypot(x / RX, y / RY);
  const paleP = 0.12 + 0.45 * d * d;
  const s = rng();
  const shade: 0 | 1 | 2 = s < paleP ? 2 : s < paleP + 0.22 ? 1 : 0;
  nodes.push({ x, y, r, shade, parent: -1, t: 0 });
}

// Order by (elliptic) distance from the centre: the growth wave.
const nd = (n: GNode) => Math.hypot(n.x / RX, n.y / RY);
export const FADED = new Set<number>();
const centre = nodes[0];
const rest = nodes.slice(1).sort((p, q) => nd(p) - nd(q));
export const NODES: GNode[] = [centre, ...rest];

// Parent: nearest earlier node, except about 12 long spokes from the hub,
// one per angular sector, picked among badges 150-330 px away.
const SPOKE_TARGETS = new Set<number>();
for (let sec = 0; sec < 12; sec++) {
  const want = ((sec + 0.5) / 12) * Math.PI * 2;
  const wantR = 170 + rng() * 140;
  let best = -1;
  let bestErr = Infinity;
  for (let i = 4; i < NODES.length; i++) {
    const n = NODES[i];
    const d = Math.hypot(n.x, n.y);
    if (d < 150 || d > 340) continue;
    let da = Math.abs(Math.atan2(n.y, n.x) + Math.PI - want);
    da = Math.min(da, Math.PI * 2 - da);
    const err = da * 200 + Math.abs(d - wantR);
    if (da < Math.PI / 12 && err < bestErr) {
      bestErr = err;
      best = i;
    }
  }
  if (best > 0) SPOKE_TARGETS.add(best);
}
for (let i = 1; i < NODES.length; i++) {
  const n = NODES[i];
  if (i <= 3 || SPOKE_TARGETS.has(i)) {
    n.parent = 0;
    continue;
  }
  let best = 0;
  let bestCost = Infinity;
  for (let j = 1; j < i; j++) {
    const m = NODES[j];
    const dist = Math.hypot(n.x - m.x, n.y - m.y);
    if (dist < bestCost) {
      bestCost = dist;
      best = j;
    }
  }
  n.parent = best;
}

// Pop-in times: first three children 0-2s, then outward waves from 2s to 14s.
const N = NODES.length;
for (let i = 1; i < N; i++) {
  if (i <= 3) {
    NODES[i].t = 0.55 + (i - 1) * 0.55;
    continue;
  }
  const u = (i - 4) / (N - 5);
  const W = 7;
  const wave = Math.floor(u * W);
  const f = u * W - wave;
  const eased = Math.pow(f, 0.75);
  NODES[i].t = 2.2 + 11.6 * ((wave + eased) / W);
}

export const LINKS: GLink[] = [];
for (let i = 1; i < N; i++) {
  const n = NODES[i];
  const p = NODES[n.parent];
  const len = Math.hypot(n.x - p.x, n.y - p.y);
  const dur = Math.min(0.75, 0.22 + len / 420, Math.max(0.15, n.t - p.t));
  LINKS.push({ a: n.parent, b: i, dashed: rng() < (n.parent === 0 ? 0.4 : 0.3), t0: n.t - dur, t1: n.t });
}
// Extra cross links between neighbours.
const seen = new Set<string>();
for (let i = 1; i < N; i++) {
  if (rng() > 0.3) continue;
  const n = NODES[i];
  let best = -1;
  let bd = 150;
  for (let j = 1; j < N; j++) {
    if (j === i || j === n.parent || NODES[j].parent === i) continue;
    const dd = Math.hypot(n.x - NODES[j].x, n.y - NODES[j].y);
    if (dd < bd) {
      bd = dd;
      best = j;
    }
  }
  if (best < 0) continue;
  const key = i < best ? `${i}-${best}` : `${best}-${i}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const t0 = Math.max(n.t, NODES[best].t) + 0.15;
  LINKS.push({ a: i, b: best, dashed: rng() < 0.5, t0, t1: t0 + 0.5 });
}

// Pulses running along links during the hold.
export const PULSES = LINKS.filter(() => rng() < 0.1).map((l) => ({ link: l, phase: rng(), speed: 0.35 + rng() * 0.3 }));

// Small floating dots.
export const SPECKS = Array.from({ length: 9 }, () => {
  const a = rng() * Math.PI * 2;
  const rr = 0.25 + rng() * 0.6;
  return { x: Math.cos(a) * rr * RX, y: Math.sin(a) * rr * RY, r: 4 + rng() * 5, t: 2 + rng() * 12, shade: (rng() < 0.6 ? 0 : 1) as 0 | 1, ring: rng() < 0.3 };
});

// A few ghosted (half-transparent) badges that may overlap neighbours.
export const GHOSTS = Array.from({ length: 7 }, () => {
  const i = 1 + Math.floor(rng() * (NODES.length - 1));
  const a = rng() * Math.PI * 2;
  const n = NODES[i];
  return { x: n.x + Math.cos(a) * n.r * 1.3, y: n.y + Math.sin(a) * n.r * 1.3, r: n.r * (0.9 + rng() * 0.4), t: n.t + 0.4, alpha: 0.35 + rng() * 0.25 };
});

export const NODE_PHASE = NODES.map(() => [rng() * Math.PI * 2, rng() * Math.PI * 2] as const);
