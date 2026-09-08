// "Ink Diffusion" — shared timing, sizing and per-version tuning.
//
// Compositions are authored at 4K so they can be rendered at full size later;
// the 1080p deliverables come from `--scale=0.5`, which only changes the
// device pixel ratio, never the layout.

export const FPS = 30;
export const DURATION_IN_FRAMES = 600; // 20s
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Frame with the most interesting structure — used for the still exports. */
export const STILL_FRAME = 340;

export type Variant = "black-on-white" | "colour-on-black" | "milk";

/**
 * One dye injection: a Gaussian point source that is switched on for a short
 * window, pushes fluid outward while it is active, and then diffuses.
 * Positions are in aspect-corrected space (y in [-0.5, 0.5], x in
 * [-0.889, 0.889] at 16:9), origin at frame centre.
 */
export type Injection = {
  x: number;
  y: number;
  /** Seconds into the clip when the source switches on. */
  start: number;
  /** How long it keeps injecting, in seconds. */
  duration: number;
  /** Dye deposited per second. */
  strength: number;
  /** Radius of the injection nozzle, before diffusion. */
  sigma: number;
  /** Which of the two dye fields this feeds (0 or 1). */
  channel: 0 | 1;
  /** Outward push this injection gives the fluid while it is fresh. */
  jet: number;
};

export type InkParams = {
  background: [number, number, number];
  /** Colour of the dye at low density (channel 0) and at high density. */
  inkThin: [number, number, number];
  inkDense: [number, number, number];
  /** Second dye field — only V2 uses a different colour here. */
  inkThin2: [number, number, number];
  inkDense2: [number, number, number];
  /** true = dye is added to a dark background, false = dye darkens a light one. */
  additive: boolean;
  /** Opacity ramp: how quickly accumulated dye saturates. */
  opacityGain: number;
  /** Amplitude of the three curl-noise octaves. */
  octaveAmp: [number, number, number];
  /** Peak flow speed, in units per second, before the decay envelope. */
  flowSpeed: number;
  /** Seconds for the flow to decay to 1/e of its opening strength. */
  flowDecay: number;
  /** Residual fraction of the flow that never decays away. */
  flowFloor: number;
  /** Diffusion constant — how fast dye softens as it ages. */
  diffusion: number;
  /**
   * How hard diffusion fades the dye it softens. 1 conserves mass exactly and
   * washes the old cores out; lower keeps them readable.
   */
  diffusionFade: number;
  /** Spatial frequency and depth of the texture stamped into each injection. */
  sourceTexFreq: number;
  sourceTexAmp: number;
  grain: number;
  vignette: number;
  injections: Injection[];
};

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// Injection points are staggered across the first two seconds (frames 0-60)
// so several fronts interact instead of one blob reading as a graphic.
const CLASSIC_INJECTIONS: Injection[] = [
  { x: -0.14, y: 0.14, start: 0.0, duration: 1.5, strength: 4.2, sigma: 0.026, channel: 0, jet: 0.115 },
  { x: 0.36, y: 0.03, start: 0.5, duration: 1.4, strength: 3.8, sigma: 0.024, channel: 1, jet: 0.108 },
  { x: 0.08, y: -0.08, start: 1.1, duration: 1.2, strength: 3.1, sigma: 0.021, channel: 0, jet: 0.094 },
  { x: 0.52, y: 0.25, start: 1.7, duration: 1.0, strength: 2.7, sigma: 0.019, channel: 1, jet: 0.086 },
  { x: -0.3, y: -0.04, start: 2.3, duration: 0.9, strength: 2.3, sigma: 0.018, channel: 1, jet: 0.08 },
];

// V2 keeps the two dyes apart at first so they bloom toward each other and
// overlap into violet in the middle of the frame.
const DUAL_DYE_INJECTIONS: Injection[] = [
  { x: -0.2, y: 0.14, start: 0.0, duration: 1.6, strength: 4.4, sigma: 0.027, channel: 0, jet: 0.118 },
  { x: -0.06, y: 0.05, start: 0.35, duration: 1.5, strength: 4.2, sigma: 0.026, channel: 1, jet: 0.112 },
  { x: 0.36, y: 0.06, start: 0.9, duration: 1.3, strength: 3.6, sigma: 0.023, channel: 1, jet: 0.1 },
  { x: 0.24, y: -0.09, start: 1.4, duration: 1.2, strength: 3.4, sigma: 0.022, channel: 0, jet: 0.094 },
  { x: -0.3, y: -0.04, start: 2.1, duration: 1.0, strength: 2.8, sigma: 0.02, channel: 1, jet: 0.084 },
];

// Milk is injected fatter and softer — it billows rather than threads.
const MILK_INJECTIONS: Injection[] = [
  { x: -0.14, y: 0.13, start: 0.0, duration: 1.8, strength: 2.9, sigma: 0.05, channel: 0, jet: 0.098 },
  { x: 0.32, y: -0.02, start: 0.6, duration: 1.6, strength: 2.75, sigma: 0.048, channel: 1, jet: 0.093 },
  { x: 0.05, y: 0.23, start: 1.4, duration: 1.3, strength: 2.3, sigma: 0.042, channel: 0, jet: 0.079 },
  { x: -0.33, y: -0.07, start: 2.2, duration: 1.1, strength: 2.1, sigma: 0.04, channel: 1, jet: 0.074 },
];

/** Last moment any of a version's injections is still running, in seconds. */
export const sourceEndTime = (injections: Injection[]) =>
  injections.reduce((end, i) => Math.max(end, i.start + i.duration), 0);

export const INK_PARAMS: Record<Variant, InkParams> = {
  // V1 — black ink in clear water, shot on white. Composites with multiply.
  "black-on-white": {
    background: rgb("#ffffff"),
    // Thin ink is never neutral grey: it goes slightly cool-blue where it is
    // barely there, and collapses to true black in the fresh cores.
    inkThin: rgb("#3d4757"),
    inkDense: rgb("#000000"),
    inkThin2: rgb("#463f4e"),
    inkDense2: rgb("#000000"),
    additive: false,
    opacityGain: 1.0,
    octaveAmp: [0.95, 0.78, 0.5],
    flowSpeed: 0.15,
    flowDecay: 5.6,
    flowFloor: 0.09,
    diffusion: 0.00009,
    diffusionFade: 0.5,
    sourceTexFreq: 24,
    sourceTexAmp: 0.85,
    grain: 0.01,
    vignette: 0,
    injections: CLASSIC_INJECTIONS,
  },
  // V2 — two dyes backlit in dark water. Composites with screen.
  "colour-on-black": {
    background: rgb("#02040a"),
    inkThin: rgb("#1a4ae0"),
    inkDense: rgb("#4f7bff"),
    inkThin2: rgb("#d02a9a"),
    inkDense2: rgb("#ff5cc0"),
    additive: true,
    opacityGain: 0.9,
    octaveAmp: [0.95, 0.8, 0.54],
    flowSpeed: 0.155,
    flowDecay: 5.8,
    flowFloor: 0.1,
    diffusion: 0.00009,
    diffusionFade: 0.5,
    sourceTexFreq: 25,
    sourceTexAmp: 0.85,
    grain: 0.02,
    vignette: 0.42,
    injections: DUAL_DYE_INJECTIONS,
  },
  // V3 — milk in water. Rounder forms, far less high-frequency detail.
  milk: {
    background: rgb("#e8eaec"),
    inkThin: rgb("#f7f9fb"),
    inkDense: rgb("#ffffff"),
    inkThin2: rgb("#f7f9fb"),
    inkDense2: rgb("#ffffff"),
    additive: false,
    // Kept well clear of saturation: at 9% contrast between the pale field and
    // pure white, the form has to read as gradation across the billows, and a
    // plume that clips to flat white has no form left at all.
    opacityGain: 0.7,
    // Third octave almost gone: milk billows, it does not thread. The middle
    // octave carries the rolling folds that give the billows their volume.
    octaveAmp: [1.0, 0.44, 0.06],
    flowSpeed: 0.115,
    flowDecay: 6.2,
    flowFloor: 0.09,
    diffusion: 0.00022,
    diffusionFade: 0.58,
    sourceTexFreq: 11,
    sourceTexAmp: 0.42,
    grain: 0.01,
    vignette: 0,
    injections: MILK_INJECTIONS,
  },
};
