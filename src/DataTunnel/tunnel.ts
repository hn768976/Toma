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

  return {
    x: c.driftX * Math.sin(TAU * (t + c.driftXPhase)),
    y: c.axisOffsetY + c.driftY * Math.sin(TAU * (2 * t + c.driftYPhase)),
    z: -travel,
    f,
    cx: width / 2,
    cy: height / 2,
    sinRoll: Math.sin(((c.rollDeg * Math.PI) / 180) * Math.sin(TAU * (t + c.rollPhase))),
    cosRoll: Math.cos(((c.rollDeg * Math.PI) / 180) * Math.sin(TAU * (t + c.rollPhase))),
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
export const planeY = (x: number, sign: number): number => {
  const { halfHeight, curve } = config.tunnel;
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
): readonly Drifter[] => {
  const rng = mulberry32(config.seed ^ seedSalt);
  const L = loopDistance();
  const out: Drifter[] = [];
  for (let i = 0; i < count; i++) {
    // Squared distribution pushes more of them toward the corridor axis.
    const rx = rng() * 2 - 1;
    const ry = rng() * 2 - 1;
    out.push({
      x: rx * Math.abs(rx) * spreadX,
      y: ry * Math.abs(ry) * spreadY,
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
);

export const DUST = buildDrifters(
  config.dust.count,
  config.dust.spreadX,
  config.dust.spreadY,
  config.dust.size.min,
  config.dust.size.max,
  0x2222,
);

/**
 * Depth of a drifting element at a given travel distance. Wraps through the
 * slab, so it is exactly periodic over one loop.
 */
export const drifterDepth = (d: Drifter, travel: number): number =>
  mod(d.z0 - travel, loopDistance());
