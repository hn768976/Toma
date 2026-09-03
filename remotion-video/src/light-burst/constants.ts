// Timing and geometry for the anamorphic light burst.
//
// Two rules govern everything in here:
//
//  1. Every value is either a frame number or a FRACTION of the frame's
//     width/height. Nothing is in absolute pixels, so the 1080p preview and
//     the 4K master are the same picture at different sizes.
//  2. The clip is a seamless loop: frame 270 must be identical to frame 0.
//     That means the flare is fully extinguished outside [FLARE_IN, FLARE_OUT],
//     the resting iris ring is back at its home position and alpha by the end,
//     and every periodic motion (haze drift, grain) has a period that divides
//     DURATION_IN_FRAMES exactly.

export const FPS = 30;
export const DURATION_IN_FRAMES = 270; // 9s

export const BASE_WIDTH = 3840;
export const BASE_HEIGHT = 2160;

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------
// 0-25    calm blue haze, faint resting iris ring left of centre
// 25-60   warm core ignites and blooms (the fast beat, ease-out)
// 60-95   peak: warm light floods frame, core near-white
// 95-175  core shrinks, travels right, cools; ghosts emerge as it dims
// 175-270 warm light gone, haze re-settles, ring returns to its frame-0 state
export const T_IGNITE = 25;
export const T_PEAK_IN = 60;
export const T_PEAK_OUT = 95;
export const T_DARK = 175; // core brightness reaches 0 here

// The iris ring outlives the core — in the reference the thin arc is still
// clearly visible for ~half a second after the warm light has gone. These
// are the ring's own envelope keyframes, deliberately lagging the core's.
export const T_RING_IN = 16;
export const T_RING_FULL = 40;
export const T_RING_FADE = 160;
export const T_RING_OUT = 210;

// The resting ring (frames 0-25 and the tail) cross-fades back in here so
// that frame 270 lands exactly on the frame-0 state.
export const T_REST_OUT_START = 22; // resting ring starts handing over
export const T_REST_OUT_END = 34;
export const T_REST_IN_START = 205;
export const T_REST_IN_END = 255;

// ---------------------------------------------------------------------------
// Flare geometry (fractions of frame width, unless noted)
// ---------------------------------------------------------------------------

// Core path. Starts left of centre, drifts right and slightly up, exits the
// right edge. Keyframes are dense enough that the piecewise-linear velocity
// changes are imperceptible, and the slope grows monotonically so the core
// visibly accelerates away as it cools.
export const CORE_PATH_X_FRAMES = [0, 25, 60, 95, 130, 165, 200, 235, 270];
export const CORE_PATH_X = [
  0.335, 0.34, 0.375, 0.44, 0.545, 0.68, 0.83, 0.99, 1.16,
];
export const CORE_PATH_Y_FRAMES = [0, 60, 120, 180, 240, 270];
export const CORE_PATH_Y = [0.545, 0.525, 0.485, 0.435, 0.375, 0.35];

// Where the resting ring sits while the flare is out. Matches the core's
// position at ignition so the handover between the two is invisible.
export const REST_CORE_X = 0.337;
export const REST_CORE_Y = 0.542;
// How bright the resting ring is relative to the travelling one: "barely
// visible", per the reference's opening beats.
export const REST_RING_ALPHA = 0.16;

// Warm falloff reaches ~70% of frame width at peak. The gradient is built
// from a computed inverse-square ramp (see flare.ts), not a linear one —
// a linear ramp reads as a spotlight rather than a light source.
export const CORE_PEAK_RADIUS = 1.05;
export const CORE_MIN_RADIUS_FACTOR = 0.22; // radius floor as the core dies
export const CORE_HOTSPOT_RADIUS = 0.026; // the white-hot centre, at peak

// Iris ring: thin bright arc at 0.18 x frame width from the core, brightest
// through its lower-left quadrant and fading out around the top. Slightly
// elliptical. This is the single most recognisable detail in the reference.
export const IRIS_RADIUS = 0.18;
export const IRIS_ELLIPSE_Y = 0.955; // squashed a touch vertically
export const IRIS_LINE_WIDTH = 3.4 / BASE_WIDTH; // ~3.4px at 4K
export const IRIS_BRIGHT_ANGLE = (Math.PI * 2) / 3; // 120deg: down-and-left
export const IRIS_ARC_FALLOFF = 2.2; // how hard the arc fades toward the top
export const IRIS_MIN_ARC_ALPHA = 0.03;

// Two further rings, concentric with the first and much fainter. These are
// drawn blurred on the soft layer, not crisp on the sharp one: at a 1px stroke
// they read as drawn-on hairline circles rather than as optics. The gains
// below compensate for the blur spreading them out.
export const SECONDARY_RINGS = [
  { radiusScale: 1.44, alpha: 0.3, widthScale: 0.8 },
  { radiusScale: 2.05, alpha: 0.14, widthScale: 0.65 },
];
export const SECONDARY_BLUR = 0.006; // fraction of frame width
export const SECONDARY_WIDTH_GAIN = 2.6;
export const SECONDARY_ALPHA_GAIN = 0.7;

// How far the core's own flood swamps the rings, and how sharply that kicks
// in. The reference is unambiguous here: the arc is clearly visible while the
// core is igniting, vanishes completely at the peak flood, and is at its
// strongest afterwards, over blue haze with no warm light left. Cubing the
// brightness is what keeps the ring through ignition and only takes it away
// at the very top — a linear wash would fade it out far too early.
export const RING_WASHOUT = 0.88;
export const RING_WASHOUT_EXPONENT = 3;

// Ghosts sit on the line running from the core through frame centre and out
// the other side: position = centre + (core - centre) * k. Negative k puts
// them on the opposite side of centre from the core, which is what a real
// lens does.
export const GHOSTS = [
  { k: -0.22, size: 0.028, alpha: 0.16, warm: true, sides: 6 },
  { k: -0.46, size: 0.052, alpha: 0.15, warm: true, sides: 6 },
  { k: -0.72, size: 0.036, alpha: 0.07, warm: false, sides: 0 },
  { k: -1.0, size: 0.068, alpha: 0.17, warm: true, sides: 6 },
  { k: -1.34, size: 0.044, alpha: 0.06, warm: false, sides: 6 },
  { k: -1.7, size: 0.086, alpha: 0.13, warm: true, sides: 0 },
  { k: -2.1, size: 0.055, alpha: 0.05, warm: false, sides: 6 },
];

// Anamorphic streak: a wide, very soft horizontal smear through the core,
// ~4% of frame height, strongest at peak.
export const STREAK_HALF_WIDTH = 0.85; // fraction of frame width, each side
export const STREAK_HEIGHT = 0.04; // fraction of frame height

// ---------------------------------------------------------------------------
// Haze
// ---------------------------------------------------------------------------
// Large, heavily blurred colour clouds — soft-light masses, not particles.
// Radii are 15-25% of frame width, as in the reference's out-of-focus
// background. Each drifts on a looping sine whose period divides 270.
export type HazeBlob = {
  x: number;
  y: number;
  radius: number;
  /** index into the palette's haze colour list */
  color: number;
  alpha: number;
  driftX: number;
  driftY: number;
  periodX: number;
  periodY: number;
  phase: number;
};

export const HAZE_BLOBS: HazeBlob[] = [
  // The bright cyan mass across the upper-left. It is the dominant feature of
  // the reference background and it runs right out through the top-left
  // corner, so it is centred off-frame — a blob centred inside the frame
  // reads as a blob, not as a mass the frame is cropping into.
  { x: -0.02, y: -0.04, radius: 0.62, color: 0, alpha: 1.0, driftX: 0.02, driftY: 0.014, periodX: 270, periodY: 135, phase: 0.0 },
  { x: 0.3, y: 0.24, radius: 0.42, color: 0, alpha: 0.72, driftX: 0.024, driftY: 0.018, periodX: 135, periodY: 270, phase: 1.7 },
  // Deeper navy through the middle, carrying the band down and to the right.
  { x: 0.56, y: 0.46, radius: 0.44, color: 1, alpha: 0.85, driftX: 0.022, driftY: 0.016, periodX: 270, periodY: 90, phase: 3.1 },
  { x: 0.26, y: 0.58, radius: 0.4, color: 1, alpha: 0.7, driftX: 0.018, driftY: 0.02, periodX: 90, periodY: 270, phase: 4.4 },
  // A cooler, dimmer mass drifting through the upper right.
  { x: 0.86, y: 0.18, radius: 0.32, color: 2, alpha: 0.45, driftX: 0.026, driftY: 0.012, periodX: 270, periodY: 135, phase: 5.6 },
];

export const HAZE_BASE_TOP_LEFT = "#0a1526";
export const HAZE_BLUR = 0.05; // blur radius as a fraction of frame width
// How far the flare's veiling glare washes the haze out at full core
// brightness. The reference's blue mass all but disappears at peak.
export const HAZE_WASHOUT = 0.8;
export const VIGNETTE_STRENGTH = 0.72;

// ---------------------------------------------------------------------------
// Grain
// ---------------------------------------------------------------------------
// Fine animated grain, cycled through a small bank of pre-generated tiles.
// GRAIN_CYCLE divides DURATION_IN_FRAMES so the grain loops with the clip.
// This exists to dither the very large smooth gradients above: without it
// they band badly once H.264 gets hold of them.
export const GRAIN_TILE = 256;
export const GRAIN_CYCLE = 15; // 270 / 15 = 18 whole cycles
export const GRAIN_OPACITY = 0.022;

// ---------------------------------------------------------------------------
// Internal render resolutions
// ---------------------------------------------------------------------------
// The soft layer (haze, warm falloff, ghosts, streak, ring glow) contains no
// hard edges, so it is drawn at a fixed 1920-wide backing store and stretched
// to the composition size. That keeps 4K render cost near 1080p cost, and the
// bilinear upscale actually helps smooth the gradients further. Only the iris
// rings and the white-hot core centre — the one place a hard edge matters —
// are drawn at full composition resolution.
export const SOFT_WIDTH = 1920;
export const HAZE_DIVISOR = 4; // haze offscreen is 1/4 of the soft layer
