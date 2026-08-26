import type { PaletteKey, Variant } from "./theme";

// ---------------------------------------------------------------------------
// Composition-wide constants. 189 frames @ 30fps = 6.3s, one-shot (not a loop).
// ---------------------------------------------------------------------------
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const DURATION_IN_FRAMES = 189;

// The swarm's origin and the background's dark centre share one point: the
// hollow core of the ring has to sit inside the dark patch or neither reads.
// Slightly above the middle of frame.
export const CENTER_X = WIDTH / 2;
export const CENTER_Y = HEIGHT * 0.47;

// ---------------------------------------------------------------------------
// Background (static, rendered once to an offscreen canvas): a plain blue
// gradient with a large soft dark radial vignette slightly above frame centre.
// The dark centre is what the bright particles read against.
// ---------------------------------------------------------------------------
export const VIGNETTE_RADIUS = HEIGHT * 0.8;
export const VIGNETTE_ALPHA = 0.55;

// ---------------------------------------------------------------------------
// Particles.
// ---------------------------------------------------------------------------
export const PARTICLE_COUNT = 2200;
export const PARTICLE_MIN_SIZE = 4;
export const PARTICLE_MAX_SIZE = 14;

// Positions snap to this grid so particles fall into faint rows and columns,
// reinforcing the pixel character of the grains themselves.
export const POSITION_GRID = 8;

// Weighted colour mix: ~55% cyan, ~20% white, ~17% blue, ~8% magenta.
export const PARTICLE_COLOR_MIX: { key: PaletteKey; weight: number }[] = [
  { key: "particleCyan", weight: 0.55 },
  { key: "particleWhite", weight: 0.2 },
  { key: "particleBlue", weight: 0.17 },
  { key: "particleMagenta", weight: 0.08 },
];

// Glow radius as a multiple of the particle's square size. The white grains
// bloom noticeably harder than the rest.
export const GLOW_SCALE: Record<string, number> = {
  particleCyan: 3.9,
  particleWhite: 5.6,
  particleBlue: 3.4,
  particleMagenta: 3.2,
};
export const GLOW_ALPHA = 0.38;

export const GRAIN_ALPHA = 0.04;
export const GRAIN_TILE = 512;
export const GRAIN_TILE_COUNT = 3;

// ---------------------------------------------------------------------------
// Per-variant configuration.
// ---------------------------------------------------------------------------

/**
 * How far along its radial axis a particle has travelled, as a 0..1 fraction
 * of its span, given frames elapsed since it started moving.
 *
 *  - "drag": decelerating — fast off the mark, easing out (a detonation).
 *            1 - e^(-t/tau), i.e. motion against drag.
 *  - "expo": accelerating — slow off the mark, easing in (a collapse).
 *            (e^(k*u) - 1) / (e^k - 1) over u = t/rampFrames.
 *
 * They are deliberate mirrors of one another. Swapping which one a variant
 * uses is what stops the implosion reading as the burst played backwards.
 */
export type TravelCurve =
  | { kind: "drag"; tauFrames: number }
  | { kind: "expo"; rampFrames: number; k: number };

export interface Keyframe {
  frame: number;
  value: number;
}

export interface VariantConfig {
  /**
   * THE signed radial direction. +1 travels away from centre, -1 travels
   * toward it. Every position calculation, the motion-blur vector and the
   * ring's growth all run through this one value — nothing anywhere else
   * hardcodes "outward".
   */
  radialDirection: 1 | -1;

  /** Frame at which radial travel begins. */
  travelStartFrame: number;
  /** Per-particle random stagger added to travelStartFrame, in frames. */
  travelStartJitter: number;

  travelCurve: TravelCurve;
  /** Fixed travel span in px (used when particles start at a point). */
  travelSpanPx: number;
  /** Travel span as a multiple of the particle's own start radius. */
  travelSpanFromStartRadius: number;

  /** Nominal radius each particle sits at before it starts travelling. */
  startRadiusPx: number;
  /** ± fractional spread on startRadiusPx, per particle. */
  startRadiusSpread: number;

  /** Per-particle speed multiplier range — this is what makes the ring lumpy. */
  speedRange: [number, number];
  /** Coherent low-frequency lobes layered on top, so the lumps have shape. */
  speedLobes: { harmonic: number; amplitude: number }[];

  /** Radians of tangential drift over a full travel span (signed by direction). */
  curlRange: [number, number];

  /** Angular scatter, in radians, and the envelope that opens or closes it. */
  angleJitter: number;
  angleJitterFrom: Keyframe;
  angleJitterTo: Keyframe;

  /** Radius below which a particle fades out at the centre. 0 disables it. */
  centreFadePx: number;

  /** Per-particle appearance. */
  appearStartFrame: number;
  fadeInFrames: number;
  fadeInJitter: number;

  /** How much a particle dims from emission to death (0 = no decay). */
  lifeDecay: number;

  /** Staggered per-particle death. */
  deathRange: [number, number];
  deathSkew: number; // >1 biases deaths early
  fadeOutRange: [number, number];
  stragglerFraction: number;
  stragglerDeathRange: [number, number];

  /** Whole-swarm brightness over time. */
  brightnessCurve: Keyframe[];

  /** Multi-draw motion blur: strength ramps to 1 at peakFrame, 0 at zeroFrame. */
  motionBlur: {
    maxPasses: number;
    peakFrame: number;
    zeroFrame: number;
    /** Trail length, in frames of travel. */
    spanFrames: number;
  };

  /** Central radial glow: the v1 pre-flicker, the v2 climax flash. */
  coreGlow: {
    curve: Keyframe[];
    radiusPx: number;
    hotCoreRadiusPx: number;
    innerKey: PaletteKey;
    outerKey: PaletteKey;
  };

  twinkleAmplitude: number;
  twinkleFrequencyRange: [number, number];
}

// The burst's two radius targets, expressed against the frame:
//   frame 45  -> ~30% of frame height          = 0.30 * 2160 = 648px
//   frame 130 -> a ring ~90% of frame width across, i.e. radius 45% of width
//                                              = 0.45 * 3840 = 1728px
// Span and tau below are solved so one drag curve, 2215*(1-e^(-t/71.7)),
// passes through both — no keyframe seam between detonation and expansion.
const BURST_TRAVEL_SPAN = 2215;
const BURST_TRAVEL_TAU = 71.7;

// The implosion starts wide — past the top and bottom edges, inside the sides.
const IMPLOSION_START_RADIUS = 1700;
// Span is 1.18x each particle's own start radius so that even the slowest
// (0.85x) still reaches the centre by the end of the collapse.
const IMPLOSION_TRAVEL_SPAN_FACTOR = 1.18;
// Curve steepness solved so the ring is at ~25% of frame height (540px) at
// frame 120 and at zero by frame 140, accelerating the whole way.
const IMPLOSION_TRAVEL_K = 3.25;

export const VARIANTS: Record<Variant, VariantConfig> = {
  // -------------------------------------------------------------------------
  // v1 THE BURST — 0-20 empty, 20-45 detonation, 45-130 expansion,
  // 130-189 dissipation.
  // -------------------------------------------------------------------------
  burst: {
    radialDirection: 1,

    travelStartFrame: 20,
    travelStartJitter: 4,

    travelCurve: { kind: "drag", tauFrames: BURST_TRAVEL_TAU },
    travelSpanPx: BURST_TRAVEL_SPAN,
    travelSpanFromStartRadius: 0,

    startRadiusPx: 8, // a tight central point
    startRadiusSpread: 0.4,

    speedRange: [0.6, 1.4],
    speedLobes: [
      { harmonic: 3, amplitude: 0.05 },
      { harmonic: 5, amplitude: 0.04 },
      { harmonic: 7, amplitude: 0.03 },
    ],

    curlRange: [-0.16, 0.16],

    // The clean ring loosens into a ragged annulus across the expansion.
    angleJitter: 0.26,
    angleJitterFrom: { frame: 45, value: 0.12 },
    angleJitterTo: { frame: 130, value: 1 },

    centreFadePx: 0, // burst particles start at the centre; never fade there

    appearStartFrame: 20,
    fadeInFrames: 3,
    fadeInJitter: 4,

    lifeDecay: 0.32, // brightness peaks at emission, decays across its life

    deathRange: [100, 168],
    deathSkew: 1.15,
    fadeOutRange: [18, 40],
    stragglerFraction: 0.05,
    stragglerDeathRange: [168, 186],

    // Peak brightness is the detonation.
    brightnessCurve: [
      { frame: 20, value: 1.18 },
      { frame: 32, value: 1.05 },
      { frame: 45, value: 1 },
      { frame: 130, value: 1 },
      { frame: 189, value: 0.88 },
    ],

    motionBlur: {
      maxPasses: 4,
      peakFrame: 20,
      zeroFrame: 90, // by frame 90 the swarm has slowed; blur is just cost
      spanFrames: 1,
    },

    // Only a faint brightening at the exact centre before detonation. The
    // implosion's flash has no equivalent here on purpose.
    coreGlow: {
      curve: [
        { frame: 15, value: 0 },
        { frame: 20, value: 0.24 },
        { frame: 27, value: 0.1 },
        { frame: 36, value: 0 },
      ],
      radiusPx: 560,
      hotCoreRadiusPx: 120,
      innerKey: "particleWhite",
      outerKey: "particleCyan",
    },

    twinkleAmplitude: 0.15,
    twinkleFrequencyRange: [0.18, 0.55],
  },

  // -------------------------------------------------------------------------
  // v2 THE IMPLOSION — 0-15 arrival, 15-120 convergence, 120-140 collapse,
  // 140-155 flash, 155-189 afterglow. Not the burst reversed: the travel
  // curve eases IN where v1 eases out, and it ends on a flash v1 never has.
  // -------------------------------------------------------------------------
  implosion: {
    radialDirection: -1,

    travelStartFrame: 15,
    travelStartJitter: 1.5, // tight, so the collapse lands together

    travelCurve: {
      kind: "expo",
      rampFrames: 125, // frame 15 -> 140
      k: IMPLOSION_TRAVEL_K,
    },
    travelSpanPx: 0,
    travelSpanFromStartRadius: IMPLOSION_TRAVEL_SPAN_FACTOR,

    startRadiusPx: IMPLOSION_START_RADIUS,
    startRadiusSpread: 0.22, // already spread wide and scattered

    speedRange: [0.85, 1.15],
    speedLobes: [
      { harmonic: 3, amplitude: 0.04 },
      { harmonic: 5, amplitude: 0.032 },
      { harmonic: 7, amplitude: 0.025 },
    ],

    curlRange: [-0.16, 0.16],

    // The ragged spread pulls into a cleaner ring as it closes.
    angleJitter: 0.34,
    angleJitterFrom: { frame: 15, value: 1 },
    angleJitterTo: { frame: 132, value: 0.06 },

    centreFadePx: 70, // particles vanish at the centre, then the flash

    appearStartFrame: 0,
    fadeInFrames: 6,
    fadeInJitter: 9, // 0-15: they are simply there, arriving scattered

    lifeDecay: 0.2, // barely decays — the crowding is what drives brightness

    // Nothing dies of old age here — the centre takes them all.
    deathRange: [150, 152],
    deathSkew: 1,
    fadeOutRange: [6, 10],
    stragglerFraction: 0,
    stragglerDeathRange: [150, 152],

    // Faint on arrival, brightening as the crowding concentrates light.
    brightnessCurve: [
      { frame: 0, value: 0.45 },
      { frame: 15, value: 0.58 },
      { frame: 90, value: 0.85 },
      { frame: 120, value: 1.05 },
      { frame: 138, value: 1.6 },
      { frame: 145, value: 1.6 },
    ],

    // Peak speed is now the collapse, with everything moving fast inside a
    // small area — that strobes worse than dispersal does.
    motionBlur: {
      maxPasses: 6,
      peakFrame: 120,
      zeroFrame: 30,
      spanFrames: 1,
    },

    // The climax: a single bright white-cyan radial flash.
    coreGlow: {
      curve: [
        // A little light gathers in the last frames of the collapse, so the
        // crowding has somewhere to go instead of leaving a dark pupil.
        { frame: 126, value: 0 },
        { frame: 138, value: 0.26 },
        { frame: 140, value: 0.3 },
        { frame: 146, value: 1 },
        { frame: 150, value: 0.5 },
        { frame: 155, value: 0 },
      ],
      radiusPx: 1500,
      hotCoreRadiusPx: 320,
      innerKey: "particleWhite",
      outerKey: "particleCyan",
    },

    twinkleAmplitude: 0.15,
    twinkleFrequencyRange: [0.18, 0.55],
  },
};
