/**
 * Builds the static PCB trace field that radiates out from the button.
 *
 * The reference's field is *static* — a 128-frame temporal average of it is
 * as crisp as any single frame — so the geometry is generated once, cached,
 * and only its brightness is animated (a wave on the reveal, then pulses
 * travelling along individual traces).
 *
 * Routing follows real PCB conventions: every segment is either axis-aligned
 * or at exactly 45 degrees, traces never turn back towards the centre, and
 * they frequently run in parallel bundles at a constant pitch.
 */

import {
  BUNDLE_COUNT,
  CENTER_X,
  CENTER_Y,
  FIELD_RADIUS,
  FRAGMENT_COUNT,
  TRACE_SEED,
} from "./constants";
import { intRange, mulberry32, range, weighted, type Rng } from "./rng";

type Pt = { x: number; y: number };

/** Unit vectors for the 8 PCB routing directions (0/45/90/... degrees). */
const DIRS: Pt[] = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  return { x: Math.cos(a), y: Math.sin(a) };
});

export type Trace = {
  /** SVG path data. */
  d: string;
  /** 0 = dim background routing, 1 = mid, 2 = bright foreground. */
  tier: 0 | 1 | 2;
  strokeWidth: number;
  /** Total arc length, needed to drive the travelling dash. */
  length: number;
  /** Radius of the trace's first vertex — how far out it starts. */
  startRadius: number;
  /** Set when this trace carries a travelling light pulse. */
  pulse?: { period: number; phase: number; dash: number };
};

export type Pad = { x: number; y: number; size: number; bright: boolean };

export type Field = { traces: Trace[]; pads: Pad[] };

const radiusOf = (p: Pt) => Math.hypot(p.x - CENTER_X, p.y - CENTER_Y);

/**
 * Where a trace is allowed to start: on an ellipse roughly tracing the
 * resting button, so everything looks like it is fanning out from under it.
 */
const buttonEllipseRadius = (angle: number) => {
  const a = 205;
  const b = 80;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return (a * b) / Math.hypot(b * c, a * s);
};

/**
 * Walks one polyline outward from `start`, heading roughly along `octant`,
 * until it has run `maxLength` or left the field.
 *
 * Capping the length is what keeps the field's density even: every trace
 * covers about the same amount of area no matter where it starts, so the
 * radial character comes from the *direction* the traces point rather than
 * from them piling up in the middle.
 */
const routeSpine = (
  rng: Rng,
  start: Pt,
  octant: number,
  maxLength: number,
): Pt[] => {
  const pts: Pt[] = [start];
  let dir = octant;
  let p = start;
  let run = 0;
  // A long first run reads as "leaving the pad", shorter runs afterwards.
  let step = range(rng, 50, 150);

  for (let i = 0; i < 11; i++) {
    const remaining = maxLength - run;
    if (remaining <= 20) break;
    const len = Math.min(step, remaining);
    const d = DIRS[((dir % 8) + 8) % 8];
    const next = { x: p.x + d.x * len, y: p.y + d.y * len };
    pts.push(next);
    run += len;
    p = next;
    if (radiusOf(p) > FIELD_RADIUS) break;

    // Turn by at most 45 degrees, and never stray more than 45 degrees off
    // the bundle's outward heading — that is what keeps the field radial.
    const turn = weighted(rng, [0.32, 0.4, 0.28]) - 1; // -1 | 0 | +1
    const candidate = dir + turn;
    dir = Math.abs(candidate - octant) > 1 ? octant : candidate;
    step = range(rng, 28, 110);
  }
  return pts;
};

const perp = (u: Pt): Pt => ({ x: -u.y, y: u.x });

/**
 * Offsets a polyline sideways by `t`, mitring each joint along its angle
 * bisector so parallel traces in a bundle keep a constant pitch through
 * every bend — exactly how a real bus is routed.
 */
const offsetPolyline = (pts: Pt[], t: number): Pt[] => {
  if (t === 0) return pts;
  const n = pts.length;
  const dirs: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    const len = Math.hypot(dx, dy) || 1;
    dirs.push({ x: dx / len, y: dy / len });
  }
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = dirs[Math.max(0, i - 1)];
    const b = dirs[Math.min(dirs.length - 1, i)];
    const na = perp(a);
    const nb = perp(b);
    let mx = na.x + nb.x;
    let my = na.y + nb.y;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) {
      out.push({ x: pts[i].x + nb.x * t, y: pts[i].y + nb.y * t });
      continue;
    }
    mx /= ml;
    my /= ml;
    // 1/cos(half-angle) keeps the perpendicular distance constant at joints.
    const scale = t / Math.max(0.35, mx * nb.x + my * nb.y);
    out.push({ x: pts[i].x + mx * scale, y: pts[i].y + my * scale });
  }
  return out;
};

const toPath = (pts: Pt[]) =>
  pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join("");

const polylineLength = (pts: Pt[]) => {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return total;
};

const TIER_WIDTH = [1.25, 1.5, 1.85] as const;

const makeTrace = (rng: Rng, pts: Pt[], tier: 0 | 1 | 2): Trace => {
  const length = polylineLength(pts);
  // Only the livelier traces carry a pulse, and only if they are long
  // enough for the dash to visibly travel.
  const wantsPulse = tier > 0 && length > 300 && rng() < 0.3;
  return {
    d: toPath(pts),
    tier,
    strokeWidth: TIER_WIDTH[tier],
    length,
    startRadius: radiusOf(pts[0]),
    pulse: wantsPulse
      ? {
          period: range(rng, 52, 150),
          phase: rng(),
          dash: range(rng, 55, 170),
        }
      : undefined,
  };
};

const buildField = (seed: number): Field => {
  const rng = mulberry32(seed);
  const traces: Trace[] = [];
  const pads: Pad[] = [];

  for (let b = 0; b < BUNDLE_COUNT; b++) {
    // A quarter of the bundles are anchored to the button so the shot keeps
    // its starburst; the rest are scattered evenly by area, which is what
    // makes the texture read as a real board instead of eight spokes.
    const anchored = rng() < 0.2;
    const angle = rng() * Math.PI * 2;

    let start: Pt;
    if (anchored) {
      const r = buttonEllipseRadius(angle) * range(rng, 0.85, 1.9);
      const lateral = range(rng, -0.9, 0.9) * r;
      start = {
        x: CENTER_X + Math.cos(angle) * r - Math.sin(angle) * lateral,
        y: CENTER_Y + Math.sin(angle) * r + Math.cos(angle) * lateral,
      };
    } else {
      // sqrt() spreads the points evenly per unit area rather than clumping
      // them near the middle.
      const r = 170 + Math.sqrt(rng()) * (FIELD_RADIUS - 170);
      start = {
        x: CENTER_X + Math.cos(angle) * r,
        y: CENTER_Y + Math.sin(angle) * r,
      };
    }

    // Head outward from wherever the trace actually starts, snapped to a PCB
    // direction. The two kinds of bundle want different spreads: anchored
    // ones aim straight out so the fan into the button stays readable, while
    // the scattered ones get a full 45 degrees either side — snapping those
    // to their exact octant packs the near-vertical ones into a single bright
    // column through the middle of the frame.
    const outward = Math.atan2(start.y - CENTER_Y, start.x - CENTER_X);
    const spread = anchored
      ? rng() < 0.15
        ? rng() < 0.5
          ? -1
          : 1
        : 0
      : weighted(rng, [0.28, 0.44, 0.28]) - 1;
    const octant = Math.round(outward / (Math.PI / 4)) + spread;

    const maxLength = anchored ? range(rng, 260, 640) : range(rng, 170, 560);
    const spine = routeSpine(rng, start, octant, maxLength);

    // Anchored bundles stay thin — a fat bus on each of the eight outward
    // rays would turn the convergence into a hard starburst.
    const size = anchored
      ? weighted(rng, [0.7, 0.3]) + 1
      : weighted(rng, [0.55, 0.24, 0.14, 0.07]) + 1; // 1..4 traces
    const pitch = range(rng, 6, 14);
    const tier = weighted(rng, [0.62, 0.27, 0.11]) as 0 | 1 | 2;

    for (let k = 0; k < size; k++) {
      // Centre the bundle on its spine so it still points at the button.
      const t = (k - (size - 1) / 2) * pitch;
      const pts = offsetPolyline(spine, t);
      // Vary the tier a little inside a bundle so buses are not flat.
      const jitter = rng() < 0.25 ? (rng() < 0.5 ? -1 : 1) : 0;
      const tk = Math.min(2, Math.max(0, tier + jitter)) as 0 | 1 | 2;
      traces.push(makeTrace(rng, pts, tk));
    }

    if (anchored && rng() < 0.35) {
      pads.push({
        x: start.x,
        y: start.y,
        size: range(rng, 4, 8),
        bright: tier === 2,
      });
    }
  }

  // Short unconnected dashes, scattered by area, that fill the gaps between
  // the long radial runs.
  for (let f = 0; f < FRAGMENT_COUNT; f++) {
    const angle = rng() * Math.PI * 2;
    // sqrt keeps the scatter even per unit area rather than clumping inside.
    const r = 180 + Math.sqrt(rng()) * (FIELD_RADIUS - 180);
    const p0 = {
      x: CENTER_X + Math.cos(angle) * r,
      y: CENTER_Y + Math.sin(angle) * r,
    };
    const octant = Math.round(angle / (Math.PI / 4)) + intRange(rng, -1, 1);
    const d0 = DIRS[((octant % 8) + 8) % 8];
    const len = range(rng, 20, 100);
    const pts: Pt[] = [p0, { x: p0.x + d0.x * len, y: p0.y + d0.y * len }];
    if (rng() < 0.3) {
      const d1 = DIRS[((octant + (rng() < 0.5 ? 1 : -1) + 8) % 8 + 8) % 8];
      const len1 = range(rng, 18, 62);
      const last = pts[pts.length - 1];
      pts.push({ x: last.x + d1.x * len1, y: last.y + d1.y * len1 });
    }
    const tier = weighted(rng, [0.66, 0.26, 0.08]) as 0 | 1 | 2;
    traces.push(makeTrace(rng, pts, tier));
  }

  return { traces, pads };
};

let cached: Field | null = null;

/** The field is expensive to build and identical on every frame, so cache it. */
export const getTraceField = (): Field => {
  if (!cached) cached = buildField(TRACE_SEED);
  return cached;
};
