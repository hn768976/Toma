// Growing Fibre Strands — static strand definitions, seeded at module level.
// Positions at any frame are pure functions of (strand, frame): see
// strandPoint() below. Nothing is simulated or accumulated.
import { mulberry32, clamp, TAU } from "../lib/random";

export const DURATION = 450;
export const POINTS = 44; // samples per strand

// World framing (camera at z = 10, fov 30): visible y in [-2.68, 2.68]
export const VIEW_HALF_H = 10 * Math.tan((15 * Math.PI) / 180);
export const BASE_Y = -VIEW_HALF_H - 0.55; // strands start below the frame
// Highest a head may reach: keeps the top ~third of frame empty (pure black)
export const MAX_TIP_Y = VIEW_HALF_H * 0.2;

export type Strand = {
  parent: number; // -1 for root strands
  lean: number; // shared by the clump: the bundle's trunk bends together
  leanK: number;
  branchAt: number; // s on the parent where this child starts
  bx: number;
  bz: number;
  height: number;
  spread: number;
  droop: number;
  curlA: number;
  curlK: number;
  curlP: number;
  dz: number;
  t0: number; // growth start frame
  dur: number; // growth duration (frames)
  swayA: number;
  swayP1: number;
  swayP2: number;
  width: number;
  bright: number;
  headSize: number;
  twC: number;
  twP: number;
};

const build = () => {
  const rnd = mulberry32(0x5e7a11);
  const strands: Strand[] = [];
  // clumps across the frame (x), like bundles of fibres fanning upwards
  // tree-like bundles: a tight trunk of near-parallel strands that fans out
  // and droops near the top; edge bundles lean outwards; jagged skyline
  const clumps = [
    { x: -5.7, n: 22, h: 2.9, sp: 1.3, lean: -0.7 },
    { x: -3.5, n: 50, h: 4.6, sp: 1.9, lean: -0.35 },
    { x: -0.7, n: 58, h: 4.8, sp: 2.0, lean: 0.1 },
    { x: 1.9, n: 44, h: 3.6, sp: 1.7, lean: 0.35 },
    { x: 4.2, n: 42, h: 3.1, sp: 1.8, lean: 0.55 },
    { x: 5.9, n: 24, h: 2.5, sp: 1.2, lean: 0.8 },
  ];
  const order = [2, 1, 3, 4, 0, 5];
  clumps.forEach((c, ci) => {
    const clumpStart = 22 + order.indexOf(ci) * 14 + rnd() * 10;
    for (let k = 0; k < c.n; k++) {
      const t0 = clumpStart + Math.pow(rnd(), 1.4) * 120;
      const dur = 85 + rnd() * 80;
      const hRaw = c.h * (0.4 + 0.6 * Math.pow(rnd(), 0.6));
      const spread = (rnd() - 0.5) * 2 * c.sp;
      const s: Strand = {
        parent: -1,
        lean: c.lean * (0.8 + rnd() * 0.4),
        leanK: 1.8 + rnd() * 0.5,
        branchAt: 0,
        bx: c.x + (rnd() - 0.5) * 0.4,
        bz: (rnd() - 0.5) * 1.2,
        height: Math.min(hRaw, MAX_TIP_Y - BASE_Y - 0.05),
        spread,
        // wide-flung strands droop like willow branches
        droop: 0.05 + Math.min(0.5, Math.abs(spread) / c.sp) * (0.25 + rnd() * 0.25),
        curlA: (rnd() - 0.5) * 0.35,
        curlK: 0.8 + rnd() * 1.2,
        curlP: rnd() * TAU,
        dz: (rnd() - 0.5) * 0.8,
        t0,
        dur: Math.min(dur, 292 - t0),
        swayA: 0.05 + rnd() * 0.08,
        swayP1: rnd() * TAU,
        swayP2: rnd() * TAU,
        width: 0.8 + rnd() * 0.4,
        bright: 0.6 + rnd() * 0.5,
        headSize: 0.75 + rnd() * 0.35,
        twC: 0.6 + rnd() * 1.6,
        twP: rnd() * TAU,
      };
      strands.push(s);
    }
  });
  // branches: some strands split in two near the top
  const roots = strands.length;
  for (let i = 0; i < roots; i++) {
    if (rnd() > 0.3) continue;
    const p = strands[i];
    const branchAt = 0.62 + rnd() * 0.22;
    const branchY = BASE_Y + p.height * (branchAt - p.droop * branchAt ** 3);
    const childH = Math.min(
      p.height * (1 - branchAt) * (0.6 + rnd() * 0.5),
      MAX_TIP_Y - branchY - 0.05,
    );
    strands.push({
      ...p,
      parent: i,
      lean: 0,
      branchAt,
      height: Math.max(0.1, childH),
      spread: (rnd() < 0.5 ? -1 : 1) * (0.25 + rnd() * 0.55),
      droop: rnd() * 0.3,
      curlA: (rnd() - 0.5) * 0.25,
      curlP: rnd() * TAU,
      dz: (rnd() - 0.5) * 0.3,
      width: p.width * 0.8,
      bright: p.bright * (0.8 + rnd() * 0.3),
      headSize: 0.6 + rnd() * 0.5,
      twC: 0.6 + rnd() * 1.6,
      twP: rnd() * TAU,
    });
  }
  return strands;
};

export const STRANDS = build();

const easeOut = (x: number) => 1 - Math.pow(1 - x, 2.2);

// Growth progress of a strand (0..1) at a frame.
export const growth = (i: number, frame: number): number => {
  const s = STRANDS[i];
  if (s.parent >= 0) {
    const pp = growth(s.parent, frame);
    return clamp((pp - s.branchAt) / (1 - s.branchAt), 0, 1);
  }
  return easeOut(clamp((frame - s.t0) / s.dur, 0, 1));
};

// Point on strand i at parameter u (0..1 of its full length), at a frame.
export const strandPoint = (
  i: number,
  u: number,
  frame: number,
  out: [number, number, number],
) => {
  const s = STRANDS[i];
  let ox: number;
  let oy: number;
  let oz: number;
  let sway0 = 0;
  if (s.parent >= 0) {
    strandPoint(s.parent, s.branchAt, frame, out);
    ox = out[0];
    oy = out[1];
    oz = out[2];
    sway0 = 1;
  } else {
    ox = s.bx;
    oy = BASE_Y;
    oz = s.bz;
  }
  // trunk (shared lean of the bundle) + individual fan-out that opens up
  // mostly in the upper part, so bundles stay tight low down
  const x =
    s.lean * Math.pow(u, s.leanK) +
    s.spread * Math.pow(u, s.parent >= 0 ? 1.4 : 2.8) +
    s.curlA * Math.sin(Math.PI * s.curlK * u + s.curlP) * u * u;
  const y = s.height * (u - s.droop * u * u * u);
  const z = s.dz * u;
  // gentle noise-like sway: two incommensurate slow sines, stronger up top
  const t = frame / 30;
  const amp = s.swayA * Math.pow(u, 1.5) * (s.parent >= 0 ? 0.6 : 1);
  const sw =
    amp *
    (0.62 * Math.sin(t * 0.9 + s.swayP1 + 1.7 * u) +
      0.38 * Math.sin(t * 1.53 + s.swayP2 + 2.9 * u));
  out[0] = ox + x + sw;
  out[1] = oy + y + sw * 0.15 * sway0;
  out[2] = oz + z;
};
