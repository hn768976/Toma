import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  DURATION_IN_FRAMES,
  ENVELOPE_AT_CHIP,
  ENVELOPE_AT_EDGE,
  CHIP_GAP,
  LANES_PER_SIDE,
  PARTICLES_PER_LANE_MAX,
  PARTICLES_PER_LANE_MIN,
} from "./constants";
import { FlowPalette, hexToRgb, mixRgb } from "./palettes";

// Deterministic PRNG so every render (and every frame) sees the same lanes.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export type Side = -1 | 1; // -1 = left (incoming), 1 = right (outgoing)

export type Lane = {
  side: Side;
  u: number; // -1 (top) .. 1 (bottom) position inside the envelope
  spread: number; // per-lane envelope multiplier so threads cross slightly
  phase: number; // offsets the sway so lanes don't move in lockstep
  threadAlpha: number;
  color: [number, number, number];
};

export type Particle = {
  lane: number;
  cycles: number; // whole trips per loop -> seamless
  offset: number;
  length: number; // streak length, design px
  brightness: number;
  headSize: number;
};

export const CENTER_X = DESIGN_WIDTH / 2;
export const CENTER_Y = DESIGN_HEIGHT / 2;
// Distance from chip edge to frame edge; d=1 lands exactly on the edge.
export const PATH_LENGTH = CENTER_X - CHIP_GAP;

const smoothstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

// Funnel profile (measured off the reference): a narrow neck at the chip,
// an S-shaped flare through the middle, then easing out at the frame edge.
const envelope = (d: number) => {
  const flare = smoothstep(d) + 0.25 * Math.max(0, d - 1);
  return ENVELOPE_AT_CHIP + (ENVELOPE_AT_EDGE - ENVELOPE_AT_CHIP) * flare;
};

// Point on a lane at normalised distance `d` from the chip, at loop time
// `loopT` (0..1). Returns design-space coordinates.
export const lanePoint = (
  lane: Lane,
  d: number,
  loopT: number,
): [number, number] => {
  const x = CENTER_X + lane.side * (CHIP_GAP + d * PATH_LENGTH);
  const away = smoothstep(d / 0.35); // motion is pinned at the chip
  const TAU = Math.PI * 2;
  // Envelope "breathes" once per loop, travelling outward along the path.
  const breathe =
    1 + 0.08 * Math.sin(TAU * loopT - d * 2.4 + (lane.side > 0 ? 1.3 : 0));
  // Gentle vertical sway, twice per loop.
  const sway =
    22 * away * Math.sin(TAU * (2 * loopT) - d * 3.1 + lane.phase * 0.6) +
    10 * away * Math.sin(TAU * loopT + d * 5 + lane.phase);
  const spread = 1 + (lane.spread - 1) * away;
  const y = CENTER_Y + lane.u * envelope(d) * spread * breathe + sway;
  return [x, y];
};

export const buildStreams = (palette: FlowPalette, seed = 7) => {
  const rand = mulberry32(seed);
  const lanes: Lane[] = [];
  const particles: Particle[] = [];

  const leftA = hexToRgb(palette.left[0]);
  const leftB = hexToRgb(palette.left[1]);
  const top = hexToRgb(palette.rightTop);
  const mid = hexToRgb(palette.rightMid);
  const bottom = hexToRgb(palette.rightBottom);

  for (const side of [-1, 1] as Side[]) {
    for (let i = 0; i < LANES_PER_SIDE; i++) {
      const u = -1 + (2 * (i + 0.15 + rand() * 0.7)) / LANES_PER_SIDE;
      let color: [number, number, number];
      if (side < 0) {
        color = mixRgb(leftA, leftB, rand() * 0.8);
      } else {
        // Grade top->mid->bottom with jitter so bands blend organically.
        const t = Math.min(1, Math.max(0, (u + 1) / 2 + (rand() - 0.5) * 0.3));
        color = t < 0.5 ? mixRgb(top, mid, t * 2) : mixRgb(mid, bottom, t * 2 - 1);
      }
      const laneIndex = lanes.length;
      lanes.push({
        side,
        u,
        spread: 0.88 + rand() * 0.24,
        phase: rand() * Math.PI * 2,
        threadAlpha: 0.05 + rand() * 0.09,
        color,
      });

      const count =
        PARTICLES_PER_LANE_MIN +
        Math.floor(rand() * (PARTICLES_PER_LANE_MAX - PARTICLES_PER_LANE_MIN + 1));
      for (let p = 0; p < count; p++) {
        particles.push({
          lane: laneIndex,
          cycles: 3 + Math.floor(rand() * 4), // 3..6 trips per 15s
          offset: rand(),
          length: 40 + rand() ** 1.5 * 150,
          brightness: 0.45 + rand() * 0.55,
          headSize: 1.4 + rand() * 1.6,
        });
      }
    }
  }
  return { lanes, particles };
};

export const LOOP_FRAMES = DURATION_IN_FRAMES;
