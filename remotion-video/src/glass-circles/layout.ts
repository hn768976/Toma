import { cosc, osc } from "./loop";

/**
 * Camera framing. Half-height of the z=0 plane is `distance * tan(fov/2)`,
 * which with these values is ~1.607 world units, so the 16:9 frame spans
 * roughly x in [-2.86, 2.86] and y in [-1.61, 1.61].
 */
export const CAMERA = { fov: 30, distance: 6 } as const;

/**
 * Constant sheet thickness for the V1/V2 rig -- every disc there is cut from
 * the same sheet of glass, which is why the small circle's rim reads
 * proportionally thicker than the hero circle's.
 */
export const SHEET_HALF_THICKNESS = 0.032;

export type DiscSpec = {
  name: string;
  radius: number;
  /**
   * Half the glass thickness. Small next to the radius gives a thin sheet;
   * a large fraction of it gives a body that reads as a sphere, with a wide
   * rounded rim for the crescent highlight to live in.
   */
  halfThickness: number;
  center: [number, number, number];
  /** Drift amplitudes and whole-cycle frequencies, per axis. */
  drift: {
    amplitude: [number, number, number];
    frequency: [number, number, number];
    phase: [number, number, number];
  };
  /** Slow tilt away from camera-facing, in radians. */
  tilt: { amplitude: [number, number]; frequency: [number, number]; phase: [number, number] };
  /** Rotation about the disc's own axis, in radians. */
  spin: { amplitude: number; frequency: number; phase: number };
};

/**
 * Three overlapping discs, matching the structure both references settle into:
 * one hero circle filling most of the frame, a small one clipped by the top-left
 * corner, and a large one entering from the right edge.
 */
export const THREE_CIRCLE_LAYOUT: DiscSpec[] = [
  {
    name: "hero",
    radius: 1.95,
    halfThickness: SHEET_HALF_THICKNESS,
    center: [0.25, -0.12, 0],
    drift: {
      amplitude: [0.2, 0.14, 0.1],
      frequency: [1, 1, 2],
      phase: [0.0, 0.25, 0.12],
    },
    tilt: {
      amplitude: [0.055, 0.07],
      frequency: [1, 1],
      phase: [0.1, 0.62],
    },
    spin: { amplitude: 0.22, frequency: 1, phase: 0.3 },
  },
  {
    name: "small",
    radius: 0.56,
    halfThickness: SHEET_HALF_THICKNESS,
    center: [-2.05, 1.18, 0.62],
    drift: {
      amplitude: [0.16, 0.12, 0.08],
      frequency: [1, 2, 1],
      phase: [0.45, 0.1, 0.7],
    },
    tilt: {
      amplitude: [0.12, 0.1],
      frequency: [1, 1],
      phase: [0.55, 0.2],
    },
    spin: { amplitude: 0.5, frequency: 1, phase: 0.8 },
  },
  {
    name: "edge",
    radius: 1.55,
    halfThickness: SHEET_HALF_THICKNESS,
    center: [2.95, -0.75, -0.55],
    drift: {
      amplitude: [0.22, 0.18, 0.12],
      frequency: [1, 1, 1],
      phase: [0.7, 0.85, 0.4],
    },
    tilt: {
      amplitude: [0.07, 0.085],
      frequency: [1, 1],
      phase: [0.35, 0.9],
    },
    spin: { amplitude: 0.3, frequency: 1, phase: 0.15 },
  },
];


/** Small deterministic PRNG, so a field is identical on every render tab. */
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type FieldOptions = {
  columns: number;
  rows: number;
  /** Half-extent the cell centres span, in world units. */
  spread: [number, number];
  /** Radius is picked per disc from this range. */
  radius: [number, number];
  depth: [number, number];
  /** Half the glass thickness, in world units. Constant across the field. */
  halfThickness: number;
  /** How far a disc may wander from its cell centre, as a fraction of the cell. */
  jitter: number;
  /** Drift amplitude per axis. */
  drift: [number, number, number];
  seed: number;
};

/**
 * A field of overlapping discs on a jittered grid.
 *
 * The grid keeps coverage even -- the references fill the frame edge to edge
 * with no bald patches -- while the jitter and the per-disc radius keep it from
 * reading as a grid. Placement is seeded so every render tab builds the same
 * field.
 */
export const buildField = (options: FieldOptions): DiscSpec[] => {
  const random = mulberry32(options.seed);
  const discs: DiscSpec[] = [];
  const cellWidth = (2 * options.spread[0]) / options.columns;
  const cellHeight = (2 * options.spread[1]) / options.rows;

  for (let row = 0; row < options.rows; row++) {
    for (let column = 0; column < options.columns; column++) {
      const x =
        (column + 0.5) * cellWidth -
        options.spread[0] +
        (random() - 0.5) * cellWidth * options.jitter;
      const y =
        (row + 0.5) * cellHeight -
        options.spread[1] +
        (random() - 0.5) * cellHeight * options.jitter;
      const radius =
        options.radius[0] + random() * (options.radius[1] - options.radius[0]);
      const z =
        options.depth[0] + random() * (options.depth[1] - options.depth[0]);

      // Frequencies stay whole so the drift closes the loop exactly.
      const frequency = (): number => (random() < 0.7 ? 1 : 2);

      discs.push({
        name: `field-${row}-${column}`,
        radius,
        halfThickness: options.halfThickness,
        center: [x, y, z],
        drift: {
          amplitude: [
            options.drift[0] * (0.6 + random() * 0.8),
            options.drift[1] * (0.6 + random() * 0.8),
            options.drift[2] * (0.6 + random() * 0.8),
          ],
          frequency: [frequency(), frequency(), frequency()],
          phase: [random(), random(), random()],
        },
        tilt: {
          amplitude: [0.05 + random() * 0.1, 0.05 + random() * 0.1],
          frequency: [1, 1],
          phase: [random(), random()],
        },
        spin: { amplitude: 0.2 + random() * 0.4, frequency: 1, phase: random() },
      });
    }
  }

  return discs;
};

export type DiscTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
};

/** Pure frame -> transform. `cycle` runs 0..1 across the clip. */
export const discTransform = (spec: DiscSpec, cycle: number): DiscTransform => {
  const { center, drift, tilt, spin } = spec;
  return {
    position: [
      center[0] + drift.amplitude[0] * osc(cycle, drift.frequency[0], drift.phase[0]),
      center[1] + drift.amplitude[1] * cosc(cycle, drift.frequency[1], drift.phase[1]),
      center[2] + drift.amplitude[2] * osc(cycle, drift.frequency[2], drift.phase[2]),
    ],
    rotation: [
      tilt.amplitude[0] * osc(cycle, tilt.frequency[0], tilt.phase[0]),
      tilt.amplitude[1] * cosc(cycle, tilt.frequency[1], tilt.phase[1]),
      spin.amplitude * osc(cycle, spin.frequency, spin.phase),
    ],
  };
};

/** Gentle parallax so the composition breathes without the framing drifting. */
export const cameraOffset = (cycle: number): [number, number] => [
  0.085 * osc(cycle, 1, 0.18),
  0.055 * cosc(cycle, 1, 0.55),
];

/** Slow swing of the lighting environment: the "light motion" in both briefs. */
export const environmentRotation = (cycle: number): [number, number, number] => [
  0.1 * osc(cycle, 1, 0.3),
  0.34 * osc(cycle, 1, 0.0),
  0.05 * cosc(cycle, 1, 0.7),
];

/** Path of the soft light pool drifting across the backdrop. */
export const backdropGlow = (cycle: number): [number, number] => [
  1.1 + 1.5 * osc(cycle, 1, 0.12),
  -0.6 + 0.9 * cosc(cycle, 1, 0.12),
];
