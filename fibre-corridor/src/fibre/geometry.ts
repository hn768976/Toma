import { random } from "remotion";
import {
  HEIGHT,
  LOOP,
  SAMPLES_ARC,
  SAMPLES_RUN,
  SAMPLES_TUNNEL,
  SAMPLES_WALL,
  STRAND_W_MAX,
  STRAND_W_MIN,
  WIDTH,
} from "./constants";
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

const TAU = Math.PI * 2;

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

/** Depth-derived half-width. Near strands are thick, distant ones hairlines. */
const widthAt = (d: number) =>
  0.5 * (STRAND_W_MIN + (STRAND_W_MAX - STRAND_W_MIN) * Math.pow(d, 1.7));

/**
 * Depth-derived brightness. It climbs with depth, then falls away again over
 * the nearest stretch: those strands are thick and heavily defocused, and at
 * full brightness the whole foreground saturates into a single white mass
 * instead of reading as separate soft streaks.
 */
const brightAt = (d: number) => {
  const rise = 0.26 + 0.74 * Math.pow(d, 1.15);
  const t = clamp((d - 0.5) / 0.5, 0, 1);
  return rise * (1 - 0.62 * t * t * (3 - 2 * t));
};

/** Distance from the vanishing point to the frame edge along an angle. */
const exitRadius = (vpx: number, vpy: number, cos: number, sin: number) => {
  const rx = cos > 0 ? (WIDTH - vpx) / cos : cos < 0 ? -vpx / cos : Infinity;
  const ry = sin > 0 ? (HEIGHT - vpy) / sin : sin < 0 ? -vpy / sin : Infinity;
  return Math.min(rx, ry);
};

const bezier = (
  p0: number,
  c1: number,
  c2: number,
  p3: number,
  t: number,
) => {
  const s = 1 - t;
  return s * s * s * p0 + 3 * s * s * t * c1 + 3 * s * t * t * c2 + t * t * t * p3;
};

/** Fill in u, normals, width and brightness for a raw point list. */
const finish = (
  pts: { x: number; y: number; d: number; bMul: number }[],
): Sample[] => {
  const n = pts.length;
  const out: Sample[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    out[i] = {
      x: pts[i].x,
      y: pts[i].y,
      nx: -ty,
      ny: tx,
      d: pts[i].d,
      u: i / (n - 1),
      w: widthAt(pts[i].d),
      b: brightAt(pts[i].d) * pts[i].bMul,
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
  const vpx = WIDTH / 2;
  const vpy = HEIGHT * v.horizonY;
  // The plane's near edge: the bottom of the frame when the strands run along
  // a floor, the top of the frame when they run along a ceiling.
  const nearEdgeY = dir > 0 ? HEIGHT : 0;
  // Past the bend the strand travels away from the plane and off the frame.
  const wallExitY = dir > 0 ? -0.14 * HEIGHT : 1.14 * HEIGHT;
  const spread = WIDTH * v.laneSpread;

  const planeY = (d: number) => vpy + (nearEdgeY - vpy) * d;
  // Lanes spread with d², not linearly: a linear spread reads as a flat fan.
  const laneX = (d: number) => vpx + lane * spread * d * d;

  const rN = random(`${key}-r`);
  const radius = HEIGHT * (0.11 + 0.34 * rN);
  // A larger radius begins bending earlier — but not in lockstep, or every
  // strand would reach the wall at the same height and leave a hard seam.
  const dBend = clamp(
    0.36 + 0.3 * rN + 0.26 * (random(`${key}-dbj`) - 0.5),
    0.24,
    0.92,
  );

  const ax = laneX(dBend);
  const ay = planeY(dBend);
  // Screen-space tangent of the plane run at the bend, pointing horizonward.
  let tx = -lane * spread * 2 * dBend;
  let ty = -(nearEdgeY - vpy);
  const tl = Math.hypot(tx, ty) || 1;
  tx /= tl;
  ty /= tl;

  // The direction the strand leaves the bend in: perpendicular to the plane,
  // away from it.
  const ex = 0;
  const ey = -dir;

  // Circular fillet between the two tangents.
  const dot = clamp(tx * ex + ty * ey, -1, 1);
  const phi = Math.acos(dot);
  const tanHalf = Math.tan(phi / 2);
  const L = radius * tanHalf;
  const kx = ax + tx * L;
  const ky = ay + ty * L;
  const bx = kx + ex * L;
  const by = ky + ey * L;
  // Control-point offset that makes a cubic bezier match a circular arc.
  const h = phi > 1e-4 ? (4 / 3) * Math.tan(phi / 4) * radius : 0;

  const pts: { x: number; y: number; d: number; bMul: number }[] = [];

  // 1. the run along the plane, from the frame's near edge to the bend
  for (let j = 0; j < SAMPLES_RUN; j++) {
    const t = j / (SAMPLES_RUN - 1);
    const d = 1 + (dBend - 1) * t;
    pts.push({ x: laneX(d), y: planeY(d), d, bMul: 1 });
  }

  // 2. the bend: a smooth arc, never a corner
  const dArcEnd = dBend * 0.55;
  for (let j = 1; j <= SAMPLES_ARC; j++) {
    const t = j / SAMPLES_ARC;
    const d = dBend + (dArcEnd - dBend) * t;
    pts.push({
      x: bezier(ax, ax + tx * h, bx - ex * h, bx, t),
      y: bezier(ay, ay + ty * h, by - ey * h, by, t),
      d,
      bMul: 1,
    });
  }

  // 3. the wall: perpendicular to the plane, out through the frame's far edge
  for (let j = 1; j <= SAMPLES_WALL; j++) {
    const t = j / SAMPLES_WALL;
    pts.push({
      x: bx,
      y: by + (wallExitY - by) * t,
      d: dArcEnd,
      // Fade a little toward the frame edge so the wall does not end flat.
      bMul: 1 - 0.28 * t,
    });
  }

  const nTotal = pts.length;
  const bendU: [number, number] = [
    (SAMPLES_RUN - 1) / (nTotal - 1),
    (SAMPLES_RUN - 1 + SAMPLES_ARC) / (nTotal - 1),
  ];

  return {
    key,
    side,
    gain: 0.5 + 0.72 * random(`${key}-gain`),
    samples: finish(pts),
    bendU,
    und: makeUndulation(key),
    packets: makePackets(key, v),
  } satisfies Strand;
};

/**
 * One strand of the "tunnel" geometry: no bend at all. The strand runs from
 * the frame's edge to the vanishing point at a seeded angle around the tube,
 * curving only with the perspective.
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
  const reach =
    exitRadius(vpx, vpy, cos, sin) * (1.06 + 0.55 * random(`${key}-reach`));
  const twist = (random(`${key}-tw`) - 0.5) * 0.22;

  const pts: { x: number; y: number; d: number; bMul: number }[] = [];
  for (let j = 0; j < SAMPLES_TUNNEL; j++) {
    // Denser sampling near the camera, where d² spreads the fastest.
    const t = Math.pow(j / (SAMPLES_TUNNEL - 1), 0.7);
    const d = 1 - t * 0.985;
    const a = theta + twist * d * d;
    const rr = reach * d * d;
    pts.push({
      x: vpx + Math.cos(a) * rr,
      y: vpy + Math.sin(a) * rr,
      d,
      bMul: 1,
    });
  }

  return {
    key,
    side,
    gain: 0.5 + 0.72 * random(`${key}-gain`),
    samples: finish(pts),
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
        const base =
          (-Math.PI / 2) +
          (Math.PI * (i + 0.5)) / half +
          (random(`${v.name}-tj-${i}`) - 0.5) * (Math.PI / half) * 0.8;
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

export { clamp, TAU, LOOP };
