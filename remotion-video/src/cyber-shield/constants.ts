// Timing and canvas config for the cyber-shield motion graphic.
//
// Everything inside the piece is authored in a fixed 1920x1080 SVG user
// space (see DESIGN_WIDTH/DESIGN_HEIGHT). The <svg> itself is stretched
// to fill whatever the composition size is, so the exact same source
// renders as true vector output at 1080p, 4K, or anything else — there
// is no per-resolution geometry to keep in sync.

export const FPS = 30;

// 25s, matching the reference clip (750 frames at 30fps).
export const DURATION_IN_FRAMES = 750;

export const WIDTH_1080 = 1920;
export const HEIGHT_1080 = 1080;

export const WIDTH_4K = 3840;
export const HEIGHT_4K = 2160;

// The authoring coordinate system. Never changes with output size.
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

// --- Emblem intro timing -------------------------------------------------
// The emblem starts steeply rotated away from camera and swings to a
// near-frontal rest pose, matching the reference's opening move.
export const INTRO_START_FRAME = 0;
export const INTRO_END_FRAME = 300; // 10s

export const INTRO_YAW_DEG = -46;
export const REST_YAW_DEG = -3.5;
export const INTRO_PITCH_DEG = 7;
export const REST_PITCH_DEG = 1.5;
export const INTRO_ROLL_DEG = -6;
export const REST_ROLL_DEG = -1;
export const INTRO_SCALE = 1.05;

// --- Idle sway (frames per cycle) ---------------------------------------
// Slow, non-commensurate periods so the rest pose never visibly repeats
// within the 25s runtime.
export const SWAY_YAW_PERIOD = 430;
export const SWAY_PITCH_PERIOD = 310;
export const SWAY_ROLL_PERIOD = 530;
export const SWAY_YAW_DEG = 3.2;
export const SWAY_PITCH_DEG = 1.1;
export const SWAY_ROLL_DEG = 0.8;

// --- Ring rotation speeds (degrees per frame) ---------------------------
export const BINARY_RING_SPEED = 0.16;
export const TICK_RING_SPEED = -0.1;
export const SEGMENT_RING_SPEED = -0.28;
export const OUTER_ARC_SPEED = 0.34;
export const BRACKET_RING_SPEED = 0.07;

// --- HUD ----------------------------------------------------------------
// The reference populates its dashboard gradually rather than all at
// once; each HUD item gets a seeded delay inside this window.
export const HUD_FIRST_IN_FRAME = 40;
export const HUD_LAST_IN_FRAME = 400;
export const HUD_FADE_FRAMES = 26;

// How often the ticking number readouts resample, in frames.
export const NUMBER_TICK_PERIOD = 14;

export const MONO_FONT =
  '"DejaVu Sans Mono", "SFMono-Regular", Menlo, Consolas, monospace';
