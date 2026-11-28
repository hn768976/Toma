import { mulberry32 } from "./rng";

/**
 * Counts, timings and geometry. Everything that is not "look" lives here.
 * (Colours, exposure, depth of field, glow and grain live in look.ts.)
 */

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Reference clip: 37.533 s (2252 frames @ 60 fps) = 1126 frames @ 30 fps. */
export const DURATION_IN_FRAMES = 1126;

/** Look-dev key moments (frame numbers at 30 fps). */
export const MOMENTS = { start: 0, middle: 563, peak: 844 } as const;
export type Moment = keyof typeof MOMENTS;

/** Camera. World unit = camera height above the resting surface. */
export const CAMERA = {
  height: 1.0,
  /** Degrees the optical axis points below the horizon. */
  pitchDeg: 13.5,
  /** Vertical field of view in degrees. */
  fovDeg: 22.0,
} as const;

/**
 * The surface is a "projected grid": a screen-aligned grid cast onto the
 * resting plane, so mesh and height-map density follow the picture, not the
 * world. The grid over-scans the frame because displaced waves slide into view.
 * Values are NDC extents (the visible frame is -1..1).
 */
export const GRID = {
  ndcLeft: -1.2,
  ndcRight: 1.2,
  ndcBottom: -2.7,
  ndcTop: 1.32,
  /**
   * Rows are spread unevenly: the over-scan strip below the frame (always far
   * out of focus) gets `sparse` times fewer rows than the visible frame.
   * The change-over happens between v = blendStart and blendStart + blendWidth.
   */
  sparse: 4.0,
  blendStart: 0.1,
  blendWidth: 0.08,
  /** Mesh density: output pixels per mesh column / row (inside the frame). */
  pixelsPerColumn: 3.0,
  pixelsPerRow: 1.5,
  /** Height-map texels per output pixel inside the frame. */
  heightMapScale: 1.0,
  /** Max shading taps along a pixel's footprint on edge-on crests. */
  footprintTaps: 12,
  /** MSAA samples of the surface pass. 4 keeps hairline crest silhouettes from beading; 0 is ~30% faster. */
  samples: 4,
} as const;

const rnd = mulberry32(20240911);
const offset = (): [number, number, number] => [rnd() * 64 - 32, rnd() * 64 - 32, rnd() * 16];

/**
 * Wave field. Lengths in world units, speeds per second.
 * Every layer is smooth simplex noise; `stretch` < 1 elongates a layer along
 * the flow (x) so it reads as long silky filaments instead of round bumps.
 */
export type WaveLayer = {
  /** Spatial frequency (cycles per world unit, across the flow). */
  scale: number;
  /** Frequency multiplier along the flow: 1 = round, 0.2 = long streaks. */
  stretch: number;
  /** Height amplitude. */
  amp: number;
  /** How fast the layer morphs (noise time units per second). */
  evolve: number;
  /** Rotation of the layer, degrees. */
  rotateDeg: number;
  offset: [number, number, number];
};
const layer = (scale: number, stretch: number, amp: number, evolve: number, rotateDeg: number): WaveLayer => ({
  scale,
  stretch,
  amp,
  evolve,
  rotateDeg,
  offset: offset(),
});

export const WAVES = {
  /** Overall size of the wave field (scales every wavelength and height). */
  size: 1.45,
  /** Multiplies every layer's morph rate (1 = as listed below). */
  tempo: 1.3,
  /** Whole pattern drifts this way, world units per second (x = screen right, z = towards camera). */
  drift: [0.34, 0.04] as [number, number],
  /** Large, slow domain warp: bends everything so crests meander. */
  warp: { scale: 0.3, amount: 0.55, evolve: 0.06, offsetA: offset(), offsetB: offset() },
  /** Small, faster warp applied to the filament layers only (curls and kinks). */
  curl: { scale: 1.5, amount: 0.11, evolve: 0.16, offsetA: offset(), offsetB: offset() },
  /** Fine warp on the filaments: breaks long ribbons into short, wiry crinkles. */
  crinkle: { scale: 5.5, amount: 0.018, evolve: 0.3, offsetA: offset(), offsetB: offset() },
  /** Broad swells, then rounder chop that gives crests, kinks and dark faces. */
  swells: [
    layer(0.2, 0.8, 0.09, 0.07, 0),
    layer(0.47, 0.7, 0.095, 0.11, 24),
    layer(1.0, 0.7, 0.06, 0.16, -17),
    layer(2.1, 0.7, 0.045, 0.22, 31),
    layer(4.1, 0.75, 0.022, 0.3, -38),
  ],
  /** Filaments: fine, stretched ripples that catch the rim light as wiry strands. */
  filaments: [
    layer(4.4, 0.4, 0.02, 0.26, 22),
    layer(9.0, 0.22, 0.0115, 0.32, -27),
    layer(17.0, 0.2, 0.004, 0.4, 12),
  ],
} as const;
