import {random} from 'remotion';
import {LOOP_FRAMES, type VariantConfig} from '../config';
import {ARC_PALETTE} from '../theme';
import type {Projection} from './projection';

export type Point = {x: number; y: number};

export type Traveller = {
  /** Frames per lap. Always a divisor of LOOP_FRAMES so the loop closes. */
  period: number;
  /** Starting position along the path, 0..1. */
  phase: number;
  /** Slight size variation between travellers. */
  scale: number;
};

export type Arc = {
  id: number;
  start: Point;
  end: Point;
  control: Point;
  /** Approximate path length in frame pixels, used as the dash length. */
  length: number;
  color: string;
  width: number;
  /** Frames in this arc's draw / hold / fade / absent cycle. Divides 600. */
  cycle: number;
  /** Frame offset at which this arc's cycle begins. */
  offset: number;
  /** Frames spent drawing on. */
  drawFrames: number;
  /** Local frame at which the fade-out starts. */
  fadeStart: number;
  /** Frames spent fading out. */
  fadeFrames: number;
  travellers: Traveller[];
};

/** Cycle lengths available to an arc. Both divide LOOP_FRAMES exactly. */
const CYCLES = [LOOP_FRAMES, LOOP_FRAMES / 2];
/** Traveller lap lengths. All divide LOOP_FRAMES exactly. */
const TRAVELLER_PERIODS = [150, 200, 300];

// Loop closure depends entirely on every periodic quantity dividing the loop
// length, so it is asserted at module load rather than left as a comment.
for (const period of [...CYCLES, ...TRAVELLER_PERIODS]) {
  if (LOOP_FRAMES % period !== 0) {
    throw new Error(`Period ${period} does not divide ${LOOP_FRAMES} frames`);
  }
}

export const bezierPoint = (arc: Arc, t: number): Point => {
  const u = 1 - t;
  return {
    x: u * u * arc.start.x + 2 * u * t * arc.control.x + t * t * arc.end.x,
    y: u * u * arc.start.y + 2 * u * t * arc.control.y + t * t * arc.end.y,
  };
};

const bezierLength = (arc: Arc, steps = 96): number => {
  let total = 0;
  let prev = bezierPoint(arc, 0);
  for (let i = 1; i <= steps; i++) {
    const next = bezierPoint(arc, i / steps);
    total += Math.hypot(next.x - prev.x, next.y - prev.y);
    prev = next;
  }
  return total;
};

/**
 * Hands out arc colours by quota rather than by rolling a die per arc, so the
 * configured mix is hit exactly instead of approximately, then shuffles the
 * assignment with a seeded Fisher-Yates so the colours are not clustered.
 */
const assignColors = (count: number, config: VariantConfig): string[] => {
  const quotas = config.colorMix.map((share) => Math.floor(share * count));
  let assigned = quotas.reduce((a, b) => a + b, 0);
  // Hand any rounding remainder to the largest share first.
  const order = config.colorMix
    .map((share, i) => ({share, i}))
    .sort((a, b) => b.share - a.share);
  let cursor = 0;
  while (assigned < count) {
    quotas[order[cursor % order.length].i]++;
    assigned++;
    cursor++;
  }

  const pool: string[] = [];
  quotas.forEach((n, i) => {
    for (let k = 0; k < n; k++) pool.push(ARC_PALETTE[i]);
  });

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random(`${config.seed}-shuffle-${i}`) * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool;
};

export const buildArcs = (
  config: VariantConfig,
  projection: Projection,
): Arc[] => {
  const routes = config.routes.slice(0, config.arcCount);
  const colors = assignColors(routes.length, config);

  return routes.map((route, id) => {
    const from = config.points[route.from];
    const to = config.points[route.to];
    if (!from || !to) {
      throw new Error(`Unknown endpoint in route ${route.from} -> ${route.to}`);
    }

    const start = {x: projection.projectX(from[0]), y: projection.projectY(from[1])};
    const end = {x: projection.projectX(to[0]), y: projection.projectY(to[1])};

    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    // Bow height scales with distance, so long routes arc high and short hops
    // stay flat. The factor is per-variant because "long" is relative.
    const bow = Math.min(
      config.bowMax,
      Math.max(config.bowMin, distance * config.bowFactor),
    );

    const seed = `${config.seed}-arc-${id}`;
    // A quadratic bezier passes at half the control point's offset, so the
    // control sits twice the intended apex height above the midpoint.
    const control = {
      x: (start.x + end.x) / 2 + (random(`${seed}-skew`) - 0.5) * distance * 0.06,
      y: (start.y + end.y) / 2 - bow * 2,
    };

    const cycle = CYCLES[random(`${seed}-cycle`) < 0.72 ? 0 : 1];
    // Arcs enter across the first third of the loop.
    const offset = Math.floor(random(`${seed}-offset`) * (LOOP_FRAMES / 3)) % cycle;
    const drawFrames = Math.round(40 + random(`${seed}-draw`) * 30);
    const fadeFrames = 50;
    const gap = Math.round(20 + random(`${seed}-gap`) * 40);
    const fadeStart = cycle - fadeFrames - gap;

    const travellerCount = random(`${seed}-tcount`) < 0.5 ? 2 : 3;
    const travellers: Traveller[] = [];
    for (let t = 0; t < travellerCount; t++) {
      travellers.push({
        period:
          TRAVELLER_PERIODS[
            Math.floor(random(`${seed}-tp-${t}`) * TRAVELLER_PERIODS.length)
          ],
        phase: random(`${seed}-tphase-${t}`),
        scale: 0.75 + random(`${seed}-tscale-${t}`) * 0.5,
      });
    }

    const arc: Arc = {
      id,
      start,
      end,
      control,
      length: 0,
      color: colors[id],
      width: config.arcWidth,
      cycle,
      offset,
      drawFrames,
      fadeStart,
      fadeFrames,
      travellers,
    };
    arc.length = bezierLength(arc);
    return arc;
  });
};
