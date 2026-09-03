import { random } from "remotion";
import {
  HEIGHT,
  SAMPLES_ARC,
  SAMPLES_RUN,
  SAMPLES_TUNNEL,
  SAMPLES_WALL,
  STRAND_W_MAX,
  STRAND_W_MIN,
  WIDTH,
} from "./constants";
import {
  bendingStrandPath,
  clamp,
  depthBrightness,
  depthWidth,
  normalsFor,
  TAU,
  type PathPoint,
} from "../lib";
import type { Variant } from "./variants";

export type Sample = {
  /** Base position, before undulation and camera drift. */
  x: number;
  y: number;
  /** Unit normal, used to push the sample sideways when it undulates. */
  nx: number;
  ny: number;
  /** Depth: 0 at the horizon, 1 at the camera. Drives width and brightness. */
  d: number;
  /** Arc parameter, 0 at the strand's camera end, 1 at its far end. */
  u: number;
  /** Half-width at 4K, in px. */
  w: number;
  /** Brightness multiplier. */
  b: number;
  /** The strand's own fade at this sample, independent of depth. */
  fade: number;
};

export type Packet = {
  /** Frames per traversal. Always a divisor of LOOP, so the loop closes. */
  cycle: number;
  /** Start offset within the cycle, 0..1. */
  phase: number;
  /** The ~12% minority that read noticeably larger and brighter. */
  hot: boolean;
  /** Per-packet size jitter. */
  size: number;
};

export type Strand = {
  key: string;
  side: 1 | -1;
  /** Seeded per-strand brightness, so no two fibres carry the same light. */
  gain: number;
  samples: Sample[];
  /** Arc-parameter window covered by the bend. [-1,-1] when there is none. */
  bendU: [number, number];
  /** Undulation terms. k1/k2 are integer cycles per LOOP so this closes. */
  und: {
    amp: number;
    k1: number;
    k2: number;
    p1: number;
    p2: number;
    s1: number;
    s2: number;
  };
  packets: Packet[];
};

/** Distance from the vanishing point to the frame edge along an angle. */
const exitRadius = (vpx: number, vpy: number, cos: number, sin: number) => {
  const rx = cos > 0 ? (WIDTH - vpx) / cos : cos < 0 ? -vpx / cos : Infinity;
  const ry = sin > 0 ? (HEIGHT - vpy) / sin : sin < 0 ? -vpy / sin : Infinity;
  return Math.min(rx, ry);
};

/** Fill in u, normals, width and brightness for a raw point list. */
const finish = (pts: PathPoint[], nearFalloff: number): Sample[] => {
  const n = pts.length;
  const norms = normalsFor(pts);
  const out: Sample[] = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = {
      x: pts[i].x,
      y: pts[i].y,
      nx: norms[i].nx,
      ny: norms[i].ny,
      d: pts[i].d,
      u: i / (n - 1),
      w: depthWidth(pts[i].d, STRAND_W_MIN, STRAND_W_MAX),
      b: depthBrightness(pts[i].d, nearFalloff) * pts[i].bMul,
      fade: pts[i].bMul,
    };
  }
  return out;
};

const makePackets = (key: string, v: Variant): Packet[] => {
  const [lo, hi] = v.packets.countRange;
  const count = lo + Math.floor(random(`${key}-pc`) * (hi - lo + 1));
  const packets: Packet[] = [];
  for (let i = 0; i < count; i++) {
    const cycles = v.packets.cyclesFrames;
    const cycle = cycles[Math.floor(random(`${key}-pcy${i}`) * cycles.length)];
    packets.push({
      cycle,
      phase: random(`${key}-pph${i}`),
      hot: random(`${key}-phot${i}`) < v.packets.hotFraction,
      size: 0.82 + 0.36 * random(`${key}-psz${i}`),
    });
  }
  return packets;
};

const makeUndulation = (key: string) => ({
  // ~12px at 4K, scaled per sample by depth when it is applied.
  amp: 9 + 7 * random(`${key}-ua`),
  // Integer cycles per LOOP: the undulation returns exactly to frame 0.
  k1: 1 + Math.floor(random(`${key}-uk1`) * 3),
  k2: 2 + Math.floor(random(`${key}-uk2`) * 4),
  p1: random(`${key}-up1`) * TAU,
  p2: random(`${key}-up2`) * TAU,
  s1: 1.5 + random(`${key}-us1`) * 2.5,
  s2: 3.0 + random(`${key}-us2`) * 4.0,
});

/**
 * One strand of the "bend" geometry: a single continuous curve that runs
 * along a plane, turns through a fillet arc of a seeded radius, and continues
 * perpendicular to the plane until it leaves the frame.
 *
 * The plane the strand runs along, the direction of the turn and the side the
 * wall stands on are all derived from `v.bendDir`; nothing here assumes a
 * floor rising into a wall.
 */
const buildBendStrand = (key: string, side: 1 | -1, lane: number, v: Variant) => {
  const dir = v.bendDir;
  const vpy = HEIGHT * v.horizonY;

  const rN = random(`${key}-r`);
  // A larger radius begins bending earlier — but not in lockstep, or every
  // strand would reach the wall at the same height and leave a hard seam.
  const bendDepth = clamp(
    0.36 + 0.3 * rN + 0.26 * (random(`${key}-dbj`) - 0.5),
    0.24,
    0.92,
  );

  const path = bendingStrandPath({
    vpx: WIDTH / 2,
    vpy,
    // The plane's near edge: the bottom of the frame when the strands run
    // along a floor, the top of the frame when they run along a ceiling.
    nearEdgeY: dir > 0 ? HEIGHT : 0,
    // Past the bend the strand travels away from the plane and off the frame.
    exitY: dir > 0 ? -0.14 * HEIGHT : 1.14 * HEIGHT,
    lane,
    spread: WIDTH * v.laneSpread,
    radius: HEIGHT * (0.11 + 0.34 * rN),
    bendDepth,
    direction: dir,
    samplesRun: SAMPLES_RUN,
    samplesArc: SAMPLES_ARC,
    samplesExit: SAMPLES_WALL,
  });

  const n = path.points.length;
  return {
    key,
    side,
    gain: 0.5 + 0.72 * random(`${key}-gain`),
    samples: finish(path.points, v.nearFalloff),
    bendU: [
      path.bendRange[0] / (n - 1),
      path.bendRange[1] / (n - 1),
    ] as [number, number],
    und: makeUndulation(key),
    packets: makePackets(key, v),
  } satisfies Strand;
};

/**
 * One strand of the "tunnel" geometry: no bend at all. The strand runs from
 * the frame's edge toward the vanishing point at a seeded angle around the
 * tube, curving only with the perspective.
 */
const buildTunnelStrand = (
  key: string,
  side: 1 | -1,
  theta: number,
  v: Variant,
) => {
  const vpx = WIDTH / 2;
  const vpy = HEIGHT * v.horizonY;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  // Strands sit at a range of radii around the tube's axis, so the wall has
  // thickness instead of being one shell of evenly spaced rays.
  const reach =
    exitRadius(vpx, vpy, cos, sin) * (1.05 + 1.15 * random(`${key}-reach`));
  const twist = (random(`${key}-tw`) - 0.5) * 0.26;
  // Each strand dissolves into the distance at its own depth rather than
  // running all the way to the vanishing point. Rays that all stay bright
  // down to a single convergence point read as a starburst; strands that fade
  // out at scattered depths layer into a tube receding through fog.
  const dMin = 0.05 + 0.12 * random(`${key}-dmin`);
  const fadeD = 0.46 + 0.36 * random(`${key}-fade`);
  // A slow angular wobble, so the strand is a curve along the tube wall
  // rather than a perfectly straight ray out of the centre.
  const wobAmp = 0.02 + 0.045 * random(`${key}-wa`);
  const wobFreq = 1 + Math.floor(random(`${key}-wf`) * 2);
  const wobPhase = random(`${key}-wp`) * TAU;

  const pts: PathPoint[] = [];
  for (let j = 0; j < SAMPLES_TUNNEL; j++) {
    // Denser sampling near the camera, where d² spreads the fastest.
    const frac = j / (SAMPLES_TUNNEL - 1);
    const t = Math.pow(frac, 0.7);
    const d = dMin + (1 - dMin) * (1 - t);
    const a = theta + twist * d * d + wobAmp * Math.sin(wobFreq * TAU * d + wobPhase);
    const rr = reach * d * d;
    // Fade by depth, not by position along the strand: the point is that
    // each fibre stops being visible at its own distance.
    const fadeT = clamp((d - fadeD * 0.4) / (fadeD * 0.6), 0, 1);
    pts.push({
      x: vpx + Math.cos(a) * rr,
      y: vpy + Math.sin(a) * rr,
      d,
      bMul: fadeT * fadeT * (3 - 2 * fadeT),
    });
  }

  return {
    key,
    side,
    gain: 0.5 + 0.72 * random(`${key}-gain`),
    samples: finish(pts, v.nearFalloff),
    bendU: [-1, -1] as [number, number],
    und: makeUndulation(key),
    packets: makePackets(key, v),
  } satisfies Strand;
};

/**
 * The whole field. Strands are mirrored about the frame's vertical centre in
 * ARRANGEMENT but not in seed — each side gets its own seed strings, so the
 * two halves share a structure without being a butterfly.
 */
export const buildStrands = (v: Variant): Strand[] => {
  const half = Math.round(v.strandDensity / 2);
  const strands: Strand[] = [];

  for (let i = 0; i < half; i++) {
    for (const side of [-1, 1] as const) {
      const key = `${v.name}-${side > 0 ? "R" : "L"}-${i}`;
      if (v.geometryMode === "tunnel") {
        // Angles are mirrored about the vertical axis; the seeds are not.
        // Generous angular jitter: evenly spaced rays read as a starburst,
        // clustered ones read as fibres bundled along a wall.
        const base =
          -Math.PI / 2 +
          (Math.PI * (i + 0.5)) / half +
          (random(`${v.name}-tj-${i}`) - 0.5) * (Math.PI / half) * 1.7;
        const theta = side > 0 ? base : Math.PI - base;
        strands.push(buildTunnelStrand(key, side, theta, v));
      } else {
        const m =
          Math.pow((i + 0.5) / half, 0.92) *
          (0.94 + 0.12 * random(`${v.name}-lj-${i}`));
        strands.push(buildBendStrand(key, side, side * m, v));
      }
    }
  }
  return strands;
};

/**
 * Lateral density of the field, sampled across the frame at the near edge.
 * The floor treatment brightens where strands cluster.
 */
export const laneDensity = (strands: Strand[], bins: number): number[] => {
  const hist = new Array(bins).fill(0) as number[];
  for (const s of strands) {
    const near = s.samples[0];
    const b = clamp(Math.floor((near.x / WIDTH) * bins), 0, bins - 1);
    hist[b] += 1;
  }
  // Soften so the bands read as broad pools rather than per-strand spikes.
  const out = new Array(bins).fill(0) as number[];
  const k = 3;
  for (let i = 0; i < bins; i++) {
    let sum = 0;
    let wsum = 0;
    for (let j = -k; j <= k; j++) {
      const idx = clamp(i + j, 0, bins - 1);
      const w = 1 - Math.abs(j) / (k + 1);
      sum += hist[idx] * w;
      wsum += w;
    }
    out[i] = sum / wsum;
  }
  const max = Math.max(...out, 1);
  return out.map((v2) => v2 / max);
};

/** Frame-local undulation offset for a sample. Closed over LOOP by design. */
export const undulate = (s: Strand, i: number, p: number) => {
  const sm = s.samples[i];
  const { amp, k1, k2, p1, p2, s1, s2 } = s.und;
  const a =
    Math.sin(TAU * (k1 * p) + p1 + sm.u * s1 * TAU) * 0.66 +
    Math.sin(TAU * (k2 * p) + p2 + sm.u * s2 * TAU) * 0.34;
  // Near strands undulate visibly; distant ones barely move.
  return a * amp * (0.35 + 0.65 * sm.d);
};

/**
 * Per-frame sample positions for a strand: the memoised base geometry plus
 * the undulation offset and the ambient camera drift. Nothing here is
 * regenerated per frame except these numbers.
 */
export const computePositions = (
  s: Strand,
  p: number,
  camX: number,
  camY: number,
): Float64Array => {
  const n = s.samples.length;
  const out = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const sm = s.samples[i];
    const o = undulate(s, i, p);
    out[i * 2] = sm.x + sm.nx * o + camX;
    out[i * 2 + 1] = sm.y + sm.ny * o + camY;
  }
  return out;
};
