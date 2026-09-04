import { mulberry32, int, range } from "../lib/rng";
import { SEED } from "../config";
import { GLYPH_NAMES, type GlyphName } from "../lib/glyphs";
import { PANEL_SPECS } from "../lib/uiTextures";

/**
 * Scene layout in world units. The camera frames roughly 13 units of height at
 * the platform, so these numbers are the composition.
 */

export const CORE = { x: 0, y: 0.16, z: 0 };

/** Concentric HUD rings lying flat on the circuit plane. */
export type RingSpec = {
  inner: number;
  outer: number;
  /** Full turns per second; sign sets the direction. */
  spin: number;
  /** Number of arc segments; 0 means a solid ring. */
  segments: number;
  /** Fraction of each segment that is drawn. */
  duty: number;
  ticks: number;
  intensity: number;
  /** Frames over which the ring sweeps on. */
  drawStart: number;
  drawEnd: number;
  /** Direction of the sweep-on. */
  drawDir: 1 | -1;
};

export const RINGS: readonly RingSpec[] = [
  { inner: 1.46, outer: 1.56, spin: 0.055, segments: 0, duty: 1, ticks: 0, intensity: 1.15, drawStart: 62, drawEnd: 104, drawDir: 1 },
  { inner: 2.18, outer: 2.5, spin: -0.03, segments: 0, duty: 1, ticks: 64, intensity: 0.72, drawStart: 70, drawEnd: 116, drawDir: -1 },
  { inner: 3.02, outer: 3.2, spin: 0.021, segments: 6, duty: 0.62, ticks: 0, intensity: 0.95, drawStart: 78, drawEnd: 122, drawDir: 1 },
  { inner: 4.0, outer: 4.06, spin: -0.014, segments: 0, duty: 1, ticks: 0, intensity: 0.5, drawStart: 86, drawEnd: 128, drawDir: -1 },
  { inner: 4.52, outer: 4.6, spin: 0.017, segments: 24, duty: 0.42, ticks: 0, intensity: 0.42, drawStart: 92, drawEnd: 134, drawDir: 1 },
];

/** The orbit path the icon nodes ride. Slightly elliptical, lying just above the plane. */
export const ORBIT = {
  radius: 6.7,
  /** Squash on X so the path is a real ellipse, not just a perspective one. */
  stretchX: 1.14,
  y: 0.62,
  /** Turns per second. */
  speed: -0.012,
};

export type NodeSpec = {
  angle: number;
  glyph: GlyphName;
  size: number;
  bob: number;
  bobPhase: number;
};

export type PanelSpec3d = {
  index: number;
  angle: number;
  radius: number;
  y: number;
  width: number;
  /** Extra yaw on top of facing the centre. */
  yaw: number;
  tilt: number;
  driftPhase: number;
  driftAmount: number;
  fadeInStart: number;
  /** Panels breathe in and out over the run rather than sitting static. */
  cyclePeriod: number;
  cyclePhase: number;
};

const rng = mulberry32(SEED ^ 0x1234_5678);

export const NODE_COUNT = 10;

export const NODES: readonly NodeSpec[] = Array.from({ length: NODE_COUNT }, (_, i) => ({
  angle: (i / NODE_COUNT) * Math.PI * 2 + range(rng, -0.06, 0.06),
  glyph: GLYPH_NAMES[(i * 5 + int(rng, 0, 1)) % GLYPH_NAMES.length],
  size: range(rng, 0.82, 0.98),
  bob: range(rng, 0.06, 0.16),
  bobPhase: rng() * Math.PI * 2,
}));

/**
 * Panel bearings, in degrees. Deliberately hand-placed rather than evenly
 * spread: the sector the camera occupies is left clear, so no panel ever swings
 * between the viewer and the platform.
 */
const PANEL_ANGLES_DEG = [25, 155, 205, 250, 295, 335];

export const PANELS: readonly PanelSpec3d[] = PANEL_SPECS.map((spec, i) => {
  const angle = (PANEL_ANGLES_DEG[i] * Math.PI) / 180 + range(rng, -0.06, 0.06);
  return {
    index: i,
    angle,
    radius: range(rng, 6.3, 8.9),
    y: range(rng, 1.7, 3.9),
    width: range(rng, 1.5, 2.35) * (spec.aspect > 1.7 ? 1.15 : 1),
    yaw: range(rng, -0.22, 0.22),
    tilt: range(rng, -0.12, 0.1),
    driftPhase: rng() * Math.PI * 2,
    driftAmount: range(rng, 0.1, 0.26),
    fadeInStart: 200 + i * 22 + int(rng, 0, 14),
    cyclePeriod: range(rng, 11, 17),
    cyclePhase: rng() * Math.PI * 2,
  };
});

/** Travelling lights on the circuit plane, orbiting outside the platform. */
export const PULSE_COUNT = 26;
export const PULSES = Array.from({ length: PULSE_COUNT }, () => ({
  radius: range(rng, 5.5, 34),
  angle: rng() * Math.PI * 2,
  /** Radians per second along its arc; alternates direction. */
  speed: range(rng, 0.05, 0.16) * (rng() < 0.5 ? -1 : 1),
  size: range(rng, 0.16, 0.34),
  phase: rng() * Math.PI * 2,
}));

export const PARTICLE_COUNT = 1500;

/**
 * Atmosphere particles: an r^2 distribution biased toward the platform, so the
 * haze thickens near the core without a visible boundary.
 */
export const PARTICLES = Array.from({ length: PARTICLE_COUNT }, () => {
  const u = rng();
  const r = 1.2 + Math.pow(u, 0.55) * 30;
  const a = rng() * Math.PI * 2;
  return {
    x: Math.cos(a) * r,
    z: Math.sin(a) * r,
    y: Math.pow(rng(), 1.7) * 12 + 0.1,
    size: range(rng, 0.035, 0.115),
    drift: range(rng, 0.12, 0.5),
    phase: rng() * Math.PI * 2,
    twinkle: range(rng, 0.35, 1),
    alpha: range(rng, 0.25, 0.95),
  };
});

export const CARD = {
  width: 3.35,
  y: 4.75,
  /** Y it rises from. */
  fromY: 0.9,
};
