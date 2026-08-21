import { mulberry32 } from "../lib/random";
import { config } from "./config";

const TAU = Math.PI * 2;

/** A resolved camera for one frame. Pure function of the frame number. */
export type TunnelCamera = {
  x: number;
  y: number;
  /** How far the camera has flown down the corridor, world units. */
  z: number;
  f: number;
  cx: number;
  cy: number;
  sinRoll: number;
  cosRoll: number;
  /**
   * Distance from the corridor axis to each plane, derived per resolution.
   *
   * A fixed world height does not survive an aspect change. The focal length
   * comes from the frame WIDTH, so a 9:16 frame has a far taller vertical
   * field: the planes then leave the frame only very close to the camera, and
   * the top and bottom of the frame go empty. Deriving the height from a target
   * `edgeDepth` instead keeps the same framing at any aspect.
   */
  halfHeight: number;
  /** Bow of the planes at the sides, scaled with halfHeight. */
  curve: number;
};

export const makeCamera = (
  frame: number,
  durationInFrames: number,
  width: number,
  height: number,
): TunnelCamera => {
  const c = config.camera;
  const t = frame / durationInFrames; // turns
  const f = width / 2 / Math.tan(((c.fovXDeg * Math.PI) / 180) / 2);

  // The whole loop rests on this: an integer number of grid cells travelled.
  const travel = t * config.motion.cellsPerLoop * config.tunnel.spacingZ;

  // Solve f * halfHeight / edgeDepth = height / 2, so the planes always cross
  // the frame edge at the same depth whatever the aspect ratio.
  const halfHeight = (config.tunnel.edgeDepth * (height / 2)) / f;

  const roll =
    ((c.rollDeg * Math.PI) / 180) * Math.sin(TAU * (t + c.rollPhase));

  return {
    x: c.driftX * Math.sin(TAU * (t + c.driftXPhase)),
    // Vertical offsets scale with the corridor, or they would be imperceptible
    // in the taller format.
    y:
      halfHeight *
      (c.axisOffsetFrac +
        c.driftYFrac * Math.sin(TAU * (2 * t + c.driftYPhase))),
    z: -travel,
    f,
    cx: width / 2,
    cy: height / 2,
    sinRoll: Math.sin(roll),
    cosRoll: Math.cos(roll),
    halfHeight,
    curve: halfHeight * config.tunnel.curveFrac,
  };
};

export type Projected = { sx: number; sy: number; d: number };

/** Pinhole projection plus roll about the frame centre. */
export const project = (
  cam: TunnelCamera,
  wx: number,
  wy: number,
  wz: number,
  out: Projected,
): Projected => {
  const d = cam.z - wz;
  out.d = d;
  if (d <= 0.05) {
    out.sx = NaN;
    out.sy = NaN;
    return out;
  }
  const ix = (cam.f * (wx - cam.x)) / d;
  const iy = (-cam.f * (wy - cam.y)) / d;
  out.sx = cam.cx + ix * cam.cosRoll - iy * cam.sinRoll;
  out.sy = cam.cy + ix * cam.sinRoll + iy * cam.cosRoll;
  return out;
};

/** Half-width of the grid in world units. */
export const gridHalfWidth = (): number =>
  config.tunnel.columns * config.tunnel.spacingX;

/**
 * Height of a plane at lateral position x. The planes bow away from the
 * corridor axis toward the sides — that curvature is what arcs the far edge of
 * each plane and keeps the middle of the frame open.
 *
 * `sign` is +1 for the ceiling, -1 for the floor.
 */
export const planeY = (
  x: number,
  sign: number,
  halfHeight: number,
  curve: number,
): number => {
  const u = x / gridHalfWidth();
  return sign * (halfHeight + curve * u * u);
};

/**
 * Deterministic per-dot value in [0, 1).
 *
 * `row` MUST already be reduced mod cellsPerLoop by the caller: the camera
 * advances a whole number of cells per loop, so a dot's random value has to
 * repeat with that same period or the wrap would be visible.
 */
export const dotHash = (col: number, rowMod: number, salt: number): number => {
  let h = (col * 73856093) ^ (rowMod * 19349663) ^ (salt * 83492791);
  h = Math.imul(h ^ (h >>> 15), h | 1);
  h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
  return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
};

/** Positive modulo. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n;

/**
 * Second noise octave: smooth value noise over a coarse lattice, used to clump
 * dot brightness into soft organic patches.
 *
 * Per-dot white noise alone leaves the grid looking mechanically even, and the
 * faint structure the raw hash does produce reads as regular. A low-frequency
 * octave on top breaks that up.
 *
 * `cellSize` must divide `motion.cellsPerLoop`, and the lattice row index wraps
 * on the same period, so the patches survive the loop wrap continuously —
 * including the interpolation across the seam.
 */
export const patchNoise = (
  latticeCol: number,
  fx: number,
  rowA: number,
  rowB: number,
  fy: number,
): number => {
  const n00 = dotHash(latticeCol, rowA, 7);
  const n10 = dotHash(latticeCol + 1, rowA, 7);
  const n01 = dotHash(latticeCol, rowB, 7);
  const n11 = dotHash(latticeCol + 1, rowB, 7);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  return (
    (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy
  );
};

/** Distance the corridor repeats over — one full loop of travel. */
export const loopDistance = (): number =>
  config.motion.cellsPerLoop * config.tunnel.spacingZ;

/**
 * Elements that drift toward the camera (dust, nebula) live in a slab one loop
 * long and wrap through it, so they return to their start after a full loop.
 */
export type Drifter = {
  x: number;
  y: number;
  /** Depth offset within the slab. */
  z0: number;
  size: number;
  intensity: number;
  hue: number;
};

const buildDrifters = (
  count: number,
  spreadX: number,
  spreadY: number,
  sizeMin: number,
  sizeMax: number,
  seedSalt: number,
  /**
   * 1 spreads evenly across the cross-section; higher values pull toward the
   * corridor axis. The axis projects to the vanishing point, so a strong bias
   * piles everything onto one spot in the middle of the frame.
   */
  bias: number,
): readonly Drifter[] => {
  const rng = mulberry32(config.seed ^ seedSalt);
  const L = loopDistance();
  const out: Drifter[] = [];
  for (let i = 0; i < count; i++) {
    const rx = rng() * 2 - 1;
    const ry = rng() * 2 - 1;
    out.push({
      x: Math.sign(rx) * Math.pow(Math.abs(rx), bias) * spreadX,
      y: Math.sign(ry) * Math.pow(Math.abs(ry), bias) * spreadY,
      z0: rng() * L,
      size: sizeMin + rng() * (sizeMax - sizeMin),
      intensity: 0.35 + rng() * 0.65,
      hue: rng(),
    });
  }
  return Object.freeze(out);
};

/** Built once at module load from the seeded PRNG. Never mutated. */
export const NEBULA = buildDrifters(
  config.nebula.count,
  config.nebula.spreadX,
  config.nebula.spreadY,
  config.nebula.radius.min,
  config.nebula.radius.max,
  0x1111,
  config.nebula.bias,
);

export const DUST = buildDrifters(
  config.dust.count,
  config.dust.spreadX,
  config.dust.spreadY,
  config.dust.size.min,
  config.dust.size.max,
  0x2222,
  config.dust.bias,
);

/**
 * Depth of a drifting element at a given travel distance. Wraps through the
 * slab, so it is exactly periodic over one loop.
 */
export const drifterDepth = (d: Drifter, travel: number): number =>
  mod(d.z0 - travel, loopDistance());
