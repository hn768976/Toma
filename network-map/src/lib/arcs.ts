import {random} from 'remotion';
import {LOOP_FRAMES, type Route, type VariantConfig} from '../config';
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

/** Keeps arcs clear of the very edge of the projected map box. */
const ARC_INSET = 18;

export type Bounds = {left: number; right: number; top: number; bottom: number};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Exact bounding box of a quadratic bezier: the endpoints plus the axis
 * extrema, which for a quadratic are the single t where the derivative is zero.
 */
const curveBounds = (start: Point, control: Point, end: Point): Bounds => {
  let left = Math.min(start.x, end.x);
  let right = Math.max(start.x, end.x);
  let top = Math.min(start.y, end.y);
  let bottom = Math.max(start.y, end.y);

  const extend = (p0: number, pc: number, p1: number, axis: 'x' | 'y') => {
    const denominator = p0 - 2 * pc + p1;
    if (denominator === 0) return;
    const t = (p0 - pc) / denominator;
    if (t <= 0 || t >= 1) return;
    const u = 1 - t;
    const value = u * u * p0 + 2 * u * t * pc + t * t * p1;
    if (axis === 'x') {
      left = Math.min(left, value);
      right = Math.max(right, value);
    } else {
      top = Math.min(top, value);
      bottom = Math.max(bottom, value);
    }
  };

  extend(start.x, control.x, end.x, 'x');
  extend(start.y, control.y, end.y, 'y');
  return {left, right, top, bottom};
};

/**
 * Largest apex height, in pixels above the endpoint midpoint, that keeps the
 * whole curve below `top`.
 *
 * With the control point at `mid.y - 2h` the curve reduces to
 * `lerp(y0, y1, t) - 4h * t * (1 - t)`, whose minimum is
 * `midY - h - d^2 / (16h)` when the turning point falls inside the segment.
 * Solving that against the headroom `M` gives the quadratic below. When the
 * headroom is too small for any turning point to fit, the curve's highest
 * point is an endpoint instead, which is already inside the map.
 */
const maxApex = (startY: number, endY: number, top: number): number => {
  const midY = (startY + endY) / 2;
  const d = endY - startY;
  const headroom = midY - top;
  if (headroom <= 0) return 0;
  if (headroom < Math.abs(d) / 2) return (Math.abs(d) / 4) * 0.98;
  return (headroom + Math.sqrt(headroom * headroom - (d * d) / 4)) / 2;
};

/**
 * One distinct colour per arc. The palette is shuffled with a seeded
 * Fisher-Yates so the two variants do not come out in the same order, but every
 * arc still gets its own colour - no two arcs share one.
 */
const assignColors = (count: number, config: VariantConfig): string[] => {
  if (count > ARC_PALETTE.length) {
    throw new Error(
      `Variant "${config.seed}" wants ${count} arcs but only ${ARC_PALETTE.length} ` +
        'arc colours exist, and no two arcs may share a colour',
    );
  }

  const pool = [...ARC_PALETTE] as string[];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random(`${config.seed}-shuffle-${i}`) * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, count);
};

/** No endpoint may serve two arcs, so no two arcs ever meet at a point. */
const assertDistinctEndpoints = (routes: Route[], config: VariantConfig): void => {
  const seen = new Set<string>();
  for (const route of routes) {
    for (const endpoint of [route.from, route.to]) {
      if (seen.has(endpoint)) {
        throw new Error(
          `Variant "${config.seed}" reuses endpoint "${endpoint}"; ` +
            'each arc needs its own pair of points',
        );
      }
      seen.add(endpoint);
    }
  }
};

export const buildArcs = (
  config: VariantConfig,
  projection: Projection,
): Arc[] => {
  const routes = config.routes.slice(0, config.arcCount);
  assertDistinctEndpoints(routes, config);
  const colors = assignColors(routes.length, config);

  // Nothing is allowed to leave the map: every endpoint and every point along
  // every curve stays inside this box.
  const bounds: Bounds = {
    left: projection.originX + ARC_INSET,
    right: projection.originX + projection.mapWidth - ARC_INSET,
    top: projection.originY + ARC_INSET,
    bottom: projection.originY + projection.mapHeight - ARC_INSET,
  };

  return routes.map((route, id) => {
    const from = config.points[route.from];
    const to = config.points[route.to];
    if (!from || !to) {
      throw new Error(`Unknown endpoint in route ${route.from} -> ${route.to}`);
    }

    const start = {
      x: clamp(projection.projectX(from[0]), bounds.left, bounds.right),
      y: clamp(projection.projectY(from[1]), bounds.top, bounds.bottom),
    };
    const end = {
      x: clamp(projection.projectX(to[0]), bounds.left, bounds.right),
      y: clamp(projection.projectY(to[1]), bounds.top, bounds.bottom),
    };

    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    if (distance < config.minArcLength) {
      throw new Error(
        `Route ${route.from} -> ${route.to} is ${Math.round(distance)}px, ` +
          `below the ${config.minArcLength}px minimum for variant "${config.seed}"`,
      );
    }
    // Bow height scales with distance, so long routes arc high and short hops
    // stay flat. The factor is per-variant because "long" is relative. The
    // apex is then capped at whatever headroom the map's top edge leaves, so a
    // long route near the top of the map flattens instead of arcing out.
    const bow = Math.min(
      config.bowMax,
      Math.max(config.bowMin, distance * config.bowFactor),
      maxApex(start.y, end.y, bounds.top),
    );

    const seed = `${config.seed}-arc-${id}`;
    const midX = (start.x + end.x) / 2;
    // The control point's horizontal offset shows up at half strength on the
    // curve, so the skew is clamped against twice the remaining side margin.
    const skew = clamp(
      (random(`${seed}-skew`) - 0.5) * distance * 0.06,
      2 * (bounds.left - midX),
      2 * (bounds.right - midX),
    );
    // A quadratic bezier passes at half the control point's offset, so the
    // control sits twice the intended apex height above the midpoint.
    let control = {x: midX + skew, y: (start.y + end.y) / 2 - bow * 2};

    // Belt and braces: the closed form above should always be enough, but the
    // invariant is worth guaranteeing rather than deriving.
    for (let attempt = 0; attempt < 30; attempt++) {
      const box = curveBounds(start, control, end);
      if (
        box.left >= bounds.left - 0.5 &&
        box.right <= bounds.right + 0.5 &&
        box.top >= bounds.top - 0.5 &&
        box.bottom <= bounds.bottom + 0.5
      ) {
        break;
      }
      control = {
        x: midX + (control.x - midX) * 0.8,
        y: (start.y + end.y) / 2 + (control.y - (start.y + end.y) / 2) * 0.8,
      };
    }

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
