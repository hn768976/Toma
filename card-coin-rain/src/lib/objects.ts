import { Color } from "three";
import { CAM_DIST, makeTrack, visibleHalfWidth } from "./loop";
import { GOLD, Look, ROSE } from "./looks";
import { mulberry32, range, Rng, sign } from "./random";

/** Unit coin: radius 1, thickness COIN_THICK (scaled uniformly per instance). */
export const COIN_THICK = 0.17;
/** Gold bar (cm): base footprint, height, top taper. */
export const BAR = { length: 7.0, width: 3.1, height: 1.65, taper: 0.82, radius: 0.13 };
export const BAR_BOUND = Math.hypot(BAR.length / 2, BAR.height / 2, BAR.width / 2);

export type Falling = {
  kind: "coin" | "bar";
  role: "near" | "front" | "mid" | "far";
  depth: number; // cm in front of the base camera
  x: number;
  z: number;
  scale: number;
  boundR: number;
  k: number; // falls per loop
  y0: number;
  yTop: number;
  length: number;
  turns: [number, number, number];
  phases: [number, number, number];
  color: Color; // linear
  roughness: number;
  finish: string;
};

/**
 * Defocus model shared with the CoC shader (see three/DepthOfFieldRig.tsx):
 * thin-lens style |d - f| / d, separate near/far gains.
 */
export const cocNear = (depth: number, look: Look, focus = CAM_DIST) => {
  const rel = (depth - focus) / depth;
  return Math.min(1, Math.max(0, (-rel - 0.04) * look.dof.nearGain));
};
export const cocFar = (depth: number, look: Look, focus = CAM_DIST) => {
  const rel = (depth - focus) / depth;
  return Math.min(look.dof.farMax, Math.max(0, (rel - 0.04) * look.dof.farGain));
};
/** Generous estimate of the blur spill in px at 1080p (bokeh + fill + CoC blur). */
export const blurSpillPx1080 = (depth: number, look: Look) =>
  Math.max(cocNear(depth, look), cocFar(depth, look)) * look.dof.bokehPx1080 * 2.2 + 12;

const jitterColor = (rng: Rng, hex: string, lj: number, hj: number) => {
  const c = new Color(hex); // converted to linear working space
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h + range(rng, -hj, hj), hsl.s, Math.min(0.97, hsl.l + range(rng, -lj, lj)));
  return c;
};

const coinTurns = (rng: Rng): [number, number, number] => {
  const t: [number, number, number] = [0, 0, 0];
  for (let a = 0; a < 3; a++) t[a] = sign(rng) * (1 + Math.floor(rng() * 3)); // 1..3 turns
  if (rng() < 0.35) t[Math.floor(rng() * 3) % 3] = 0; // zero allowed on one axis
  return t;
};

const barTurns = (rng: Rng): [number, number, number] => {
  // Slower than coins: at most one full turn per axis per loop.
  const t: [number, number, number] = [sign(rng), sign(rng), 0];
  if (rng() < 0.5) t[2] = sign(rng);
  else t[Math.floor(rng() * 2)] = 0;
  return t;
};

type Placed = { depth: number; x: number; boundR: number };

const collides = (placed: Placed[], depth: number, x: number, boundR: number) =>
  placed.some(
    (p) =>
      Math.abs(p.depth - depth) < (p.boundR + boundR) * 1.15 &&
      Math.abs(p.x - x) < (p.boundR + boundR) * 1.15,
  );

/** Card half-width as a fraction of the visible half-width (same at every depth). */
const CARD_U = 0.43;

const build = (look: Look): Falling[] => {
  const rng = mulberry32(look.seed);
  const out: Falling[] = [];
  const placed: Placed[] = [];

  const add = (
    kind: Falling["kind"],
    role: Falling["role"],
    depthRange: [number, number],
    scale: number,
    boundR: number,
    uPick: (depth: number) => number,
    k: number,
    turns: [number, number, number],
    finishIdx: number,
  ) => {
    let depth = 0;
    let x = 0;
    for (let tries = 0; tries < 60; tries++) {
      depth = range(rng, depthRange[0], depthRange[1]);
      x = uPick(depth) * visibleHalfWidth(depth);
      if (!collides(placed, depth, x, boundR)) break;
    }
    placed.push({ depth, x, boundR });
    const track = makeTrack(depth, boundR, blurSpillPx1080(depth, look));
    const finish = look.coins.finishes[finishIdx % look.coins.finishes.length];
    out.push({
      kind,
      role,
      depth,
      x,
      z: CAM_DIST - depth,
      scale,
      boundR,
      k,
      y0: range(rng, 0, track.length),
      yTop: track.yTop,
      length: track.length,
      turns,
      phases: [rng(), rng(), rng()],
      color: jitterColor(rng, finish.color, finish.lightJitter, finish.hueJitter),
      roughness: range(rng, finish.roughness[0], finish.roughness[1]),
      finish: finish.name,
    });
  };

  const coinRadius = () => (rng() < 0.3 ? range(rng, 1.0, 1.32) : range(rng, 0.6, 0.88));
  const D = CAM_DIST;
  const c = look.coins;
  const mid = c.total - c.near - c.front - c.far;
  let fi = 0;
  const nextFinish = () => fi++;

  // Near-lens coins: big, blurred, kept to the sides so they frame the card.
  for (let i = 0; i < c.near; i++) {
    const r = range(rng, 0.95, 1.3);
    const side = i % 2 === 0 ? -1 : 1;
    add("coin", "near", [10.5, 16], r, r * 1.01, () => side * range(rng, 0.86, 1.14), 1 + (i % 2), coinTurns(rng), nextFinish());
  }
  // Coins that pass in front of the card (~10%).
  for (let i = 0; i < c.front; i++) {
    const r = coinRadius();
    // Crosses one end of the card, so it only ever covers part of it.
    const side = i % 2 === 0 ? -1 : 1;
    add("coin", "front", [D - 10, D - 3.5], r, r * 1.01, () => side * range(rng, 0.3, 0.46), 1 + (i % 2), coinTurns(rng), nextFinish());
  }
  // Mid coins around the card's depth: the sharp layer.
  for (let i = 0; i < mid; i++) {
    const r = coinRadius();
    add(
      "coin",
      "mid",
      [D - 7, D + 15],
      r,
      r * 1.01,
      (depth) => {
        if (depth < D - 1.2) {
          // In front of the card but not over it.
          const minU = CARD_U + r / visibleHalfWidth(depth) + 0.05;
          return sign(rng) * range(rng, minU, 1.08);
        }
        return range(rng, -1.08, 1.08);
      },
      2 + Math.floor(rng() * 2),
      coinTurns(rng),
      nextFinish(),
    );
  }
  // Far coins: small and soft.
  for (let i = 0; i < c.far; i++) {
    const r = coinRadius();
    add("coin", "far", [D + 25, D + 100], r, r * 1.01, () => range(rng, -1.1, 1.1), 1 + Math.floor(rng() * 2), coinTurns(rng), nextFinish());
  }

  if (look.bars) {
    const b = look.bars;
    for (let i = 0; i < b.near; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      add("bar", "near", [23, 27], 1, BAR_BOUND, () => side * range(rng, 0.9, 1.08), 1, barTurns(rng), i);
    }
    for (let i = 0; i < b.mid; i++) {
      add("bar", "mid", [D + 5, D + 22], 1, BAR_BOUND, () => range(rng, -0.95, 0.95), 1, barTurns(rng), i + 1);
    }
    for (let i = 0; i < b.far; i++) {
      add("bar", "far", [D + 50, D + 65], 1, BAR_BOUND, () => range(rng, -0.9, 0.9), 1, barTurns(rng), i + 2);
    }
  }
  return out;
};

/** Seeded once, at module level. */
export const OBJECTS = { gold: build(GOLD), rose: build(ROSE) } as const;
