import { z } from "zod";

/**
 * Per-variant cloth definitions.
 *
 * Every field was set against a measurement taken off the corresponding
 * reference clip -- thread pitch from the autocorrelation of a frame, target
 * luminance and contrast from its histogram, and the step cadence from the
 * hard-cut structure of the clip. See `constants.ts` for the cadence numbers.
 */

export const weaveVariantSchema = z.object({
  /** Warp threads across the frame width. Ref A measured ~220, Ref B ~238. */
  threads: z.number().min(20).max(600),

  /** Cut cadence. holdInFrames * states must divide the 300-frame duration. */
  holdInFrames: z.number().int().min(1).max(30),
  states: z.number().int().min(1).max(60),
  /** How far the cloth shifts between held stills, in cell units. */
  jitterAmount: z.number().min(0).max(40),
  /** Per-state exposure wobble, as a fraction. */
  exposureWobble: z.number().min(0).max(0.2),

  threadWidth: z.number().min(0.2).max(1.4),
  weftWidth: z.number().min(0.2).max(1.4),
  twistAmp: z.number().min(0).max(1),
  twistFreq: z.number().min(0).max(8),
  twistJitter: z.number().min(0).max(1),
  slub: z.number().min(0).max(1.5),
  wander: z.number().min(0).max(8),
  wanderScale: z.number().min(0.01).max(4),
  threadShade: z.number().min(0).max(1),
  fuzz: z.number().min(0).max(1),
  fuzzScale: z.number().min(0.1).max(20),
  parityBias: z.number().min(0).max(1),

  warpColor: z.tuple([z.number(), z.number(), z.number()]),
  weftColor: z.tuple([z.number(), z.number(), z.number()]),
  groundColor: z.tuple([z.number(), z.number(), z.number()]),

  lightAngle: z.number(),
  lightHeight: z.number().min(0.05).max(4),
  ambient: z.number().min(0).max(2),
  ambientRamp: z.number().min(-1).max(1),
  diffuse: z.number().min(0).max(3),
  specular: z.number().min(0).max(2),
  shininess: z.number().min(1).max(200),
  occlusion: z.number().min(0).max(1),
  axisContrast: z.number().min(0).max(1),
  relief: z.number().min(0.3).max(8),
  exposure: z.number().min(0.1).max(3),
  contrast: z.number().min(0.1).max(3),
  lift: z.number().min(0).max(0.6),
  highlightKnee: z.number().min(0.3).max(1),
  shoulder: z.number().min(0).max(1),

  bloomCenter: z.tuple([z.number(), z.number()]),
  bloomRadius: z.number().min(0.05).max(3),
  bloomStrength: z.number().min(0).max(1.5),
  vignette: z.number().min(-1).max(1.5),
  streakStrength: z.number().min(0).max(1),
  streakScale: z.number().min(0.5).max(200),
  mottle: z.number().min(0).max(1),
  mottleScale: z.number().min(0.2).max(60),
  grain: z.number().min(0).max(0.3),

  /** 1 = no supersampling, 2 = 2x2 rotated grid inside the shader. */
  supersample: z.union([z.literal(1), z.literal(2)]),
});

export type WeaveVariant = z.infer<typeof weaveVariantSchema>;

/**
 * Variant 01 -- bright cotton canvas, after Ref A (istock 2233990621).
 *
 * Measured: luma mean 226/255 (0.886), sigma ~30, thread pitch ~3.5px at 768w
 * (=> ~220 threads across), autocorrelation peak only 0.38 so the weave is
 * loose and irregular, and soft vertical streaking down the left of frame.
 * Cadence: 5 unique stills on a 12-frame hold at 60fps -> 6 frames at 30fps,
 * giving 50 steps over 300 frames and exactly 10 cycles. Loops seamlessly.
 */
export const canvasWhite: WeaveVariant = {
  threads: 220,
  holdInFrames: 6,
  states: 5,
  jitterAmount: 13.0,
  exposureWobble: 0.011,

  threadWidth: 0.88,
  weftWidth: 0.85,
  twistAmp: 0.36,
  twistFreq: 1.15,
  twistJitter: 1.0,
  slub: 0.3,
  // Ref A's autocorrelation peaks at only 0.38, so this weave has to be
  // genuinely irregular -- but the irregularity is kept at thread scale by the
  // high wanderScale, otherwise it shows as banding across the frame.
  wander: 0.42,
  wanderScale: 0.62,
  threadShade: 0.17,
  fuzz: 0.17,
  fuzzScale: 3.1,
  parityBias: 0.12,

  warpColor: [1.0, 0.993, 0.976],
  weftColor: [0.985, 0.974, 0.952],
  groundColor: [0.27, 0.264, 0.25],

  lightAngle: -2.85,
  lightHeight: 0.42,
  ambient: 0.58,
  ambientRamp: 0.0,
  diffuse: 0.72,
  specular: 0.1,
  shininess: 22,
  occlusion: 0.44,
  axisContrast: 0.75,
  relief: 1.7,
  exposure: 1.115,
  contrast: 1.24,
  lift: 0.035,
  highlightKnee: 0.88,
  shoulder: 0.08,

  bloomCenter: [0.72, 0.42],
  bloomRadius: 0.78,
  bloomStrength: 0.03,
  vignette: -0.02,
  streakStrength: 0.022,
  streakScale: 26,
  mottle: 0.04,
  mottleScale: 7.0,
  grain: 0.02,

  supersample: 2,
};

/**
 * Variant 02 -- dense grey weave, after Ref B (istock 2268264442).
 *
 * Measured: luma mean ~170/255 (0.667), sigma ~50 so roughly 1.6x the contrast
 * of Ref A, thread pitch ~3.23px at 768w (=> ~238 threads across), and an
 * autocorrelation peak of 0.85 -- a tight, very regular weave. Soft bloom
 * through the middle of frame, no streaking.
 * Cadence: 10 unique stills on an 11-frame hold at 60fps -> 5 frames at 30fps,
 * giving 60 steps over 300 frames and exactly 6 cycles. Loops seamlessly.
 */
export const weaveGrey: WeaveVariant = {
  threads: 246,
  holdInFrames: 5,
  states: 10,
  jitterAmount: 17.0,
  exposureWobble: 0.042,

  threadWidth: 1.04,
  weftWidth: 1.02,
  twistAmp: 0.42,
  twistFreq: 1.0,
  twistJitter: 0.12,
  slub: 0.08,
  // Ref B autocorrelates at 0.85 -- a tight, machine-regular weave -- so the
  // wander, slub, fuzz and per-thread shade spread are all held right down.
  wander: 0.09,
  wanderScale: 0.55,
  threadShade: 0.14,
  fuzz: 0.12,
  fuzzScale: 3.6,
  parityBias: 0.1,

  warpColor: [0.9, 0.9, 0.895],
  weftColor: [0.865, 0.863, 0.857],
  groundColor: [0.04, 0.04, 0.045],

  lightAngle: -3.02,
  lightHeight: 0.34,
  ambient: 0.34,
  ambientRamp: 0.17,
  diffuse: 1.1,
  specular: 0.2,
  shininess: 28,
  occlusion: 0.3,
  axisContrast: 0.64,
  relief: 2.4,
  exposure: 1.14,
  contrast: 1.26,
  lift: 0.0,
  highlightKnee: 0.66,
  shoulder: 0.72,

  bloomCenter: [0.5, 0.26],
  bloomRadius: 0.75,
  bloomStrength: 0.06,
  vignette: -0.09,
  streakStrength: 0.0,
  streakScale: 14,
  mottle: 0.1,
  mottleScale: 9.0,
  grain: 0.02,

  supersample: 2,
};

export const weaveVariants = {
  "01-canvas-white": canvasWhite,
  "02-weave-grey": weaveGrey,
} satisfies Record<string, WeaveVariant>;

export type WeaveVariantName = keyof typeof weaveVariants;
