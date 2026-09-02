import { midpointDisplace } from "../lib/midpointCurve";
import {
  buildAngularCdf,
  distanceToEdge,
  sampleAngle,
} from "../lib/radialPlaces";
import { rnd, rndInt, rndPick, rndRange, rndSigned, smoothstep } from "../lib/rand";
import { Layout, LOOP, TAU } from "./layout";
import { angularWeight, VariantConfig } from "./variants";

/**
 * Filament geometry.
 *
 * Every filament is built ONCE, in a frame-independent form, and the
 * per-frame work is only the undulation offset. Regenerating 320
 * recursive curves per frame would both cost heavily and make the whole
 * field writhe, because the seeds would have to change with the frame.
 *
 * A filament lives in its own polar frame: a unit vector `u` along its
 * ray and `v` perpendicular to it. A vertex is
 *
 *     origin + u * r[i] + v * (o[i] + undulation(i, frame))
 *
 * which keeps the "sinuous ray" shape explicit and makes the animated
 * part a single scalar per vertex.
 *
 * Vertices are ordered from the EMISSION end to the far end. For an
 * outward burst that is origin -> frame edge; for an inward one it is
 * frame edge -> origin. Brightness pulses always travel index 0 -> n-1,
 * so reversing `burstDirection` reverses them for free. Width and
 * opacity, by contrast, are functions of RADIUS, so a filament is always
 * thickest and brightest at the origin end whichever way it is running —
 * which is exactly the inverted taper the inward variant needs.
 */

/** Recursion depth for the midpoint displacement: 2^5 + 1 = 33 vertices. */
const DEPTH = 5;
/** Low displacement scale keeps the curves sinuous rather than jagged. */
const DISPLACE_SCALE = 0.055;
const ROUGHNESS = 0.52;
const BRANCH_PROBABILITY = 0.13;

/** Pulse periods, all exact divisors of the 600-frame loop. */
const PULSE_PERIODS = [50, 60, 75, 100, 120, 150, 200] as const;

export type Filament = {
  ux: number;
  uy: number;
  vx: number;
  vy: number;
  /** Radius from the origin at each vertex. */
  r: Float64Array;
  /** Static perpendicular offset at each vertex. */
  o: Float64Array;
  /** Undulation envelope at each vertex: 0 at the origin, 1 out in the field. */
  env: Float64Array;
  rNear: number;
  rFar: number;
  widthScale: number;
  alphaScale: number;
  undA1: number;
  undK1: number;
  undP1: number;
  undA2: number;
  undK2: number;
  undP2: number;
  waveSpan: number;
  pulsePeriod: number;
  pulsePhase: number;
  pulseStrength: number;
};

type Frame = { ux: number; uy: number; vx: number; vy: number };

const frameFor = (angle: number): Frame => ({
  ux: Math.cos(angle),
  uy: Math.sin(angle),
  vx: -Math.sin(angle),
  vy: Math.cos(angle),
});

const buildOne = (
  seed: string,
  angle: number,
  rEmit: number,
  rEnd: number,
  layout: Layout,
  config: VariantConfig,
  widthScale: number,
  alphaScale: number,
  startOffset: number,
): Filament => {
  const f = frameFor(angle);
  const count = (1 << DEPTH) + 1;
  const span = rEnd - rEmit;
  const length = Math.abs(span);

  // The end nearest the origin is pinned close to the ray so filaments
  // converge on (or spring from) a point rather than a smear.
  const outward = config.burstDirection === 1;
  const nearOffset = rndSigned(`${seed}:near`, 3);
  const farOffset = rndSigned(`${seed}:far`, length * 0.06);
  const o = midpointDisplace(
    seed,
    DEPTH,
    length,
    DISPLACE_SCALE,
    ROUGHNESS,
    outward ? nearOffset : startOffset || farOffset,
    outward ? farOffset : nearOffset,
  );

  const r = new Float64Array(count);
  const env = new Float64Array(count);
  const rampEnd = layout.maxRadius * 0.22;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    r[i] = rEmit + span * t;
    const e = smoothstep(0, rampEnd, r[i]);
    env[i] = e;
    o[i] *= e;
  }

  return {
    ...f,
    r,
    o,
    env,
    rNear: Math.min(rEmit, rEnd),
    rFar: Math.max(rEmit, rEnd),
    widthScale,
    alphaScale,
    undA1: rndRange(`${seed}:a1`, 11, 19),
    undK1: rndInt(`${seed}:k1`, 1, 2),
    undP1: rnd(`${seed}:p1`) * TAU,
    undA2: rndRange(`${seed}:a2`, 5, 10),
    undK2: rndInt(`${seed}:k2`, 2, 4),
    undP2: rnd(`${seed}:p2`) * TAU,
    waveSpan: rndRange(`${seed}:ws`, 1.6, 3.4),
    pulsePeriod: rndPick(`${seed}:pp`, PULSE_PERIODS),
    pulsePhase: rnd(`${seed}:ph`),
    pulseStrength: rndRange(`${seed}:ps`, 0.35, 1),
  };
};

export const buildFilaments = (
  config: VariantConfig,
  layout: Layout,
  seedPrefix: string,
): Filament[] => {
  // Angles are drawn from a weighted CDF rather than spaced evenly:
  // even spacing produces a sunburst, which reads as clip art.
  const cdf = buildAngularCdf(
    (a) => {
      // Straight up is -PI/2 in canvas coordinates.
      const phi = Math.abs(
        Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)),
      );
      return angularWeight(config.angular, phi);
    },
    { bins: 1440 },
  );

  const outward = config.burstDirection === 1;
  const out: Filament[] = [];

  for (let i = 0; i < config.filamentCount; i++) {
    const seed = `${seedPrefix}:fil:${i}`;
    const angle = sampleAngle(cdf, rnd(`${seed}:u`));
    const edge = distanceToEdge(
      layout.originX,
      layout.originY,
      layout.width,
      layout.height,
      angle,
    );
    const reach =
      edge * rndRange(`${seed}:reach`, config.reach.min, config.reach.max);
    const nearRadius = rndRange(`${seed}:r0`, 22, 95);
    const rEmit = outward ? nearRadius : reach;
    const rEnd = outward ? reach : nearRadius;

    const widthScale = rndRange(`${seed}:w`, 0.55, 1.35);
    const alphaScale = Math.pow(rnd(`${seed}:al`), 0.75) * 0.62 + 0.38;

    const parent = buildOne(
      seed,
      angle,
      rEmit,
      rEnd,
      layout,
      config,
      widthScale,
      alphaScale,
      0,
    );
    out.push(parent);

    // Occasional forks, so the field has branches without becoming a
    // tangle. The child is expressed in its own rotated frame, so its
    // start radius/offset are the parent's junction point re-projected
    // into that frame — otherwise the fork would visibly detach.
    if (rnd(`${seed}:br`) < BRANCH_PROBABILITY) {
      const n = parent.r.length;
      const j = Math.round(rndRange(`${seed}:bj`, 0.34, 0.66) * (n - 1));
      const jr = parent.r[j];
      const jo = parent.o[j];
      const delta =
        rndRange(`${seed}:bd`, 0.06, 0.17) *
        (rnd(`${seed}:bs`) < 0.5 ? -1 : 1);
      const childAngle = angle + delta;
      const phi = Math.atan2(jo, jr);
      const radius = Math.hypot(jr, jo);
      const rel = angle + phi - childAngle;
      const childEmit = radius * Math.cos(rel);
      const childStartOffset = radius * Math.sin(rel);
      const childEnd = outward
        ? childEmit + (parent.rFar - childEmit) * rndRange(`${seed}:bl`, 0.5, 0.95)
        : rndRange(`${seed}:bl2`, 22, 95);
      out.push(
        buildOne(
          `${seed}:child`,
          childAngle,
          childEmit,
          childEnd,
          layout,
          config,
          widthScale * 0.62,
          alphaScale * 0.72,
          childStartOffset,
        ),
      );
    }
  }

  return out;
};

/**
 * Writes the frame-`frame` vertex positions of `fil` into `xs`/`ys`.
 *
 * The undulation is a sum of two sines whose frequencies are integers in
 * cycles-per-loop, with a phase that shifts along the filament so the
 * wave travels rather than pumping. Integer frequencies are what make
 * frame 0 and frame LOOP identical.
 */
export const evaluateFilament = (
  fil: Filament,
  frame: number,
  originX: number,
  originY: number,
  xs: Float64Array,
  ys: Float64Array,
): void => {
  const n = fil.r.length;
  const w1 = (TAU * fil.undK1 * frame) / LOOP + fil.undP1;
  const w2 = (TAU * fil.undK2 * frame) / LOOP + fil.undP2;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const wobble =
      fil.undA1 * Math.sin(w1 + fil.waveSpan * t) +
      fil.undA2 * Math.sin(w2 - fil.waveSpan * 0.6 * t);
    const off = fil.o[i] + fil.env[i] * wobble;
    xs[i] = originX + fil.ux * fil.r[i] + fil.vx * off;
    ys[i] = originY + fil.uy * fil.r[i] + fil.vy * off;
  }
};

/**
 * Half-width at each vertex: thickest at the vertex closest to the
 * origin, thinning to nothing at the far end. Because it keys off radius
 * and not vertex index, reversing the burst inverts the taper on its own.
 */
export const filamentHalfWidths = (
  fil: Filament,
  baseWidth: number,
  scale: number,
  out: Float64Array,
): void => {
  const n = fil.r.length;
  const span = fil.rFar - fil.rNear || 1;
  const w = baseWidth * fil.widthScale * scale;
  for (let i = 0; i < n; i++) {
    const k = (fil.r[i] - fil.rNear) / span;
    out[i] = w * Math.pow(1 - k, 1.45);
  }
};

/** Position of the travelling brightness pulse, as a vertex index. */
export const pulseIndex = (fil: Filament, frame: number, n: number): number => {
  const p = (frame / fil.pulsePeriod + fil.pulsePhase) % 1;
  return p * (n - 1);
};
