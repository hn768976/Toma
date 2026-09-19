import { z } from "zod";

/** Every composition renders at 30fps, matching the reference clips. */
export const FPS = 30;

export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;
export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a #rrggbb colour");

export const gradientSchema = z.object({
  /** Six palette stops, low end of the field to high end. */
  palette: z.tuple([
    hexColor,
    hexColor,
    hexColor,
    hexColor,
    hexColor,
    hexColor,
  ]),

  // Field shape
  scale: z.number().min(0.2).max(6),
  warpA: z.number().min(0).max(4),
  warpB: z.number().min(0).max(6),
  loopRadius: z.number().min(0.05).max(1.5),
  drift: z.number().min(0).max(2),
  detail: z.number().min(0).max(0.6),
  seed: z.number(),

  // Tonality
  biasX: z.number().min(-1).max(1),
  biasY: z.number().min(-1).max(1),
  swirl: z.number().min(0).max(1.5),
  fieldAmount: z.number().min(0).max(2),
  offset: z.number().min(-0.5).max(1.5),
  contrast: z.number().min(0.2).max(3),

  /**
   * Two standing light sources, positioned in aspect-corrected space:
   * x spans about +/-0.89 at 16:9, y spans +/-0.5 with +0.5 at the top.
   * Placing them just outside the frame gives a bloom that bleeds inward.
   */
  glow1: z.object({
    pos: z.tuple([z.number(), z.number()]),
    radius: z.number().min(0.05).max(3),
    amount: z.number().min(-1).max(1),
  }),
  glow2: z.object({
    pos: z.tuple([z.number(), z.number()]),
    radius: z.number().min(0.05).max(3),
    amount: z.number().min(-1).max(1),
  }),
  glowWarp: z.number().min(0).max(1),
  gamma: z.number().min(0.3).max(3),
  exposure: z.number().min(0.2).max(3),
  saturation: z.number().min(0).max(2),

  // Iridescence (cosine palette blended over the ramp)
  iridescence: z.number().min(0).max(1),
  iridescenceFreq: z.number().min(0.2).max(4),
  iridescenceA: z.tuple([z.number(), z.number(), z.number()]),
  iridescenceB: z.tuple([z.number(), z.number(), z.number()]),
  iridescenceC: z.tuple([z.number(), z.number(), z.number()]),
  iridescenceD: z.tuple([z.number(), z.number(), z.number()]),

  // Finishing
  vignette: z.number().min(0).max(1.5),
  vignetteSoft: z.number().min(0).max(1.2),
  grain: z.number().min(0).max(0.2),
  grainSize: z.number().min(1).max(6),
  /** Height of the offscreen noise field. Absolute, so 4K and 1080p match. */
  fieldHeight: z.number().min(90).max(1080),
});

export type GradientProps = z.infer<typeof gradientSchema>;

const NEUTRAL_IRIDESCENCE = {
  iridescence: 0,
  iridescenceFreq: 1,
  iridescenceA: [0.5, 0.5, 0.5],
  iridescenceB: [0.5, 0.5, 0.5],
  iridescenceC: [1, 1, 1],
  iridescenceD: [0, 0.33, 0.67],
} satisfies Partial<GradientProps>;

/**
 * V1 -- Midnight Bloom.
 * Near-black plate with deep blue and magenta blooms rising from the lower
 * edge. Low key, heavy vignette, slow.
 */
export const midnightBloom: GradientProps = {
  palette: ["#000106", "#01030f", "#06183f", "#0f46b4", "#5a23b0", "#b026d3"],
  scale: 0.55,
  warpA: 0.4,
  warpB: 0.6,
  detail: 0.15,
  loopRadius: 0.2,
  drift: 0.08,
  seed: 11.3,
  biasX: 0.06,
  biasY: -0.22,
  swirl: 0.12,
  fieldAmount: 0.75,
  offset: 0.3,
  glow1: { pos: [-0.38, -0.5], radius: 0.9, amount: 0.38 },
  glow2: { pos: [0.58, -0.62], radius: 0.58, amount: 0.3 },
  glowWarp: 0.45,
  contrast: 1.0,
  gamma: 1.3,
  exposure: 1.0,
  saturation: 1.06,
  ...NEUTRAL_IRIDESCENCE,
  vignette: 0.5,
  vignetteSoft: 0.3,
  grain: 0.022,
  grainSize: 1,
  fieldHeight: 360,
};

/**
 * V2 -- Holographic Foil.
 * Saturated iridescent liquid. Strong double warp gives the folded, marbled
 * banding; the cosine palette supplies the continuous rainbow cycle, and the
 * grain is deliberately coarse to match the reference's texture.
 */
export const holographicFoil: GradientProps = {
  palette: ["#22d3ee", "#4f7cf5", "#8b5cf6", "#e879b9", "#f9d38a", "#5eead4"],
  scale: 0.8,
  warpA: 0.8,
  warpB: 1.0,
  detail: 0.18,
  loopRadius: 0.22,
  drift: 0.1,
  seed: 4.7,
  biasX: 0,
  biasY: 0,
  swirl: 0.28,
  fieldAmount: 1.0,
  offset: 0.5,
  glow1: { pos: [0, 0], radius: 1, amount: 0 },
  glow2: { pos: [0, 0], radius: 1, amount: 0 },
  glowWarp: 0,
  contrast: 1.2,
  gamma: 1.0,
  exposure: 1.0,
  saturation: 1.15,
  iridescence: 0.5,
  iridescenceFreq: 1.0,
  iridescenceA: [0.56, 0.53, 0.58],
  iridescenceB: [0.4, 0.4, 0.42],
  iridescenceC: [1, 1, 1],
  iridescenceD: [0.0, 0.33, 0.67],
  vignette: 0.08,
  vignetteSoft: 0.45,
  grain: 0.055,
  grainSize: 1,
  fieldHeight: 360,
};

/**
 * V3 -- Cyan Drift.
 * High key. Large soft blobs of cream and pale mint floating over blue, with
 * almost no vignette so the frame stays open and airy.
 */
export const cyanDrift: GradientProps = {
  palette: ["#0a4fa8", "#1370c4", "#4fb4d2", "#a5dbd6", "#e8f2ea", "#f8fbf6"],
  scale: 0.7,
  warpA: 0.45,
  warpB: 0.6,
  detail: 0.14,
  loopRadius: 0.2,
  drift: 0.08,
  seed: 27.9,
  biasX: -0.08,
  biasY: 0.04,
  swirl: 0.28,
  fieldAmount: 1.0,
  offset: 0.4,
  glow1: { pos: [0.4, 0.12], radius: 0.52, amount: 0.2 },
  glow2: { pos: [-0.62, -0.22], radius: 0.48, amount: 0.16 },
  glowWarp: 0.3,
  contrast: 1.2,
  gamma: 1.0,
  exposure: 1.0,
  saturation: 1.0,
  ...NEUTRAL_IRIDESCENCE,
  vignette: 0.05,
  vignetteSoft: 0.5,
  grain: 0.014,
  grainSize: 1,
  fieldHeight: 360,
};

/**
 * V4 -- Deep Current.
 * Dark like V1 but colder and more vivid: navy falling away to a turquoise
 * core that glows up from the bottom of frame.
 */
export const deepCurrent: GradientProps = {
  palette: ["#01030a", "#03102e", "#0a3487", "#1565f0", "#0cbdd2", "#3af0d8"],
  scale: 0.6,
  warpA: 0.45,
  warpB: 0.6,
  detail: 0.15,
  loopRadius: 0.2,
  drift: 0.09,
  seed: 63.1,
  biasX: -0.05,
  biasY: -0.2,
  swirl: 0.15,
  fieldAmount: 0.78,
  offset: 0.3,
  glow1: { pos: [0.42, -0.5], radius: 0.85, amount: 0.38 },
  glow2: { pos: [-0.62, -0.3], radius: 0.6, amount: 0.26 },
  glowWarp: 0.45,
  contrast: 1.0,
  gamma: 1.2,
  exposure: 1.05,
  saturation: 1.05,
  ...NEUTRAL_IRIDESCENCE,
  vignette: 0.4,
  vignetteSoft: 0.32,
  grain: 0.02,
  grainSize: 1,
  fieldHeight: 360,
};

export type VariantDefinition = {
  id: string;
  title: string;
  /** Matches the length of the reference clip it was built against. */
  durationInFrames: number;
  props: GradientProps;
};

export const VARIANTS: VariantDefinition[] = [
  {
    id: "V1-MidnightBloom",
    title: "Midnight Bloom",
    durationInFrames: 10 * FPS,
    props: midnightBloom,
  },
  {
    id: "V2-HolographicFoil",
    title: "Holographic Foil",
    durationInFrames: 20 * FPS,
    props: holographicFoil,
  },
  {
    id: "V3-CyanDrift",
    title: "Cyan Drift",
    durationInFrames: 15 * FPS,
    props: cyanDrift,
  },
  {
    id: "V4-DeepCurrent",
    title: "Deep Current",
    durationInFrames: 20 * FPS,
    props: deepCurrent,
  },
];
