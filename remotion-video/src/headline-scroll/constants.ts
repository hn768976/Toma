// Top-level config for the 4K "AI headline scroll". Everything that shapes the
// look or the timing is a knob here; the renderer reads, it never decides.

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

/**
 * 7.0s. Every periodic quantity below has a period that divides this, and every
 * line's scroll covers a whole number of tile cycles across it, so frame 0 and
 * frame 210 are the same picture.
 */
export const DURATION_IN_FRAMES = 210;

export const CENTER_X = WIDTH / 2;
export const CENTER_Y = HEIGHT / 2;

// ---------------------------------------------------------------- scroll ---

/** Baseline horizontal drift, px per frame, before depth and jitter. */
export const SCROLL_SPEED = 9;
/** Nearer lines parallax faster: speed scales across this range by depth. */
export const SCROLL_SPEED_DEPTH_RANGE: [number, number] = [0.8, 1.5];
/** Per-line speed spread, +/- fraction. */
export const SCROLL_SPEED_JITTER = 0.4;
/** Fraction of lines that travel left-to-right instead of right-to-left. */
export const SCROLL_REVERSE_FRACTION = 0.25;

/** How many lines are on screen at once. */
export const LINE_COUNT = 12;

// ------------------------------------------------------------------ text ---

/** Cap-height range across the depth stack, in 4K pixels. */
export const CAP_HEIGHT_MIN = 40;
export const CAP_HEIGHT_MAX = 220;
/** Bias the cap-height ramp so most lines sit small and a few loom large. */
export const CAP_HEIGHT_GAMMA = 1.35;

/**
 * Nothing in the scrolling layer is ever sharp — that is the whole point of the
 * centre word. Blur rises with depth (nearer = bigger = further out of focus).
 * The ceiling is per-theme (`lines.blurCeiling` in THEMES): dark type on a
 * light ground smears more visibly than light type on dark.
 */
export const BLUR_FLOOR = 6;
/** Per-line blur wobble, in px, so the depth ramp does not read as a gradient. */
export const BLUR_JITTER = 2.5;

/** Red/cyan edge split baked into the larger blurred lines. */
export const LINE_CHROMATIC_OFFSET = 4;
/** Lines below this cap height get no fringing — it would just read as mud. */
export const LINE_CHROMATIC_MIN_CAP_HEIGHT = 90;

/** Per-tier opacity of the scrolling layer. */
export const LINE_ALPHA = { dim: 1, mid: 0.95, bright: 0.82 };
/** Depth thresholds that pick a tier colour. */
export const LINE_TIER_BREAKS: [number, number] = [0.34, 0.68];

/** Slow vertical bob. Amplitude in px; periods must divide DURATION_IN_FRAMES. */
export const LINE_DRIFT_AMPLITUDE: [number, number] = [8, 20];
export const LINE_DRIFT_PERIODS = [210, 105, 70, 42] as const;

/** Minimum gap between tile repeats, as a multiple of cap height. */
export const TILE_GAP_RATIO = 1.6;

// ------------------------------------------------------------ centre word ---

/** Cap height of the sharp word, as a fraction of frame height. */
export const WORD_CAP_HEIGHT_RATIO = 0.16;

/** Red/cyan offset on the word, in px. Always present. */
export const CHROMATIC_OFFSET = 8;
/** What it snaps to during a glitch. */
export const GLITCH_CHROMATIC_OFFSET = 22;

/**
 * Master multiplier on halo + bloom. The halo's two passes — their colours,
 * alphas, radii and blend modes — are per-theme (`halo` in THEMES), because
 * lifting a word off a dark ground and clearing a patch of paper under it are
 * opposite operations.
 */
export const GLOW_STRENGTH = 1;
/**
 * Base halo radius as a fraction of frame height; each pass scales it. Tracks
 * WORD_CAP_HEIGHT_RATIO — the treatment behind the word has to stay
 * proportional to the word, or a larger word outgrows the patch it sits on.
 */
export const GLOW_RADIUS_RATIO = 0.46;
/** Halo breathes +/-10% on a sine whose period divides the loop. */
export const GLOW_PULSE_AMOUNT = 0.1;
export const GLOW_PULSE_PERIOD = 70;

/** Bloom passes over the word only. The blurred text never blooms. */
export const BLOOM_PASSES: { blur: number; alpha: number }[] = [
  { blur: 34, alpha: 0.4 },
  { blur: 110, alpha: 0.22 },
];

// --------------------------------------------------------------- glitches ---

/** Frame of the first glitch, and the gap range between them. */
export const GLITCH_FIRST_FRAME: [number, number] = [24, 44];
export const GLITCH_GAP: [number, number] = [30, 60];
/** A glitch lasts this many frames. */
export const GLITCH_DURATION: [number, number] = [2, 3];
/** Thin horizontal slices torn sideways during a glitch. */
export const GLITCH_SLICE_COUNT: [number, number] = [2, 4];
export const GLITCH_SLICE_HEIGHT: [number, number] = [18, 96];
export const GLITCH_SLICE_SHIFT: [number, number] = [30, 120];
/**
 * Keep this many clean frames at the tail so the wrap point stays quiet and
 * frame 0 / frame 210 match.
 */
export const GLITCH_TAIL_GUARD = 10;

// ----------------------------------------------------------------- finish ---

/**
 * Vignette: fully clear inside this fraction of the half-frame, then ramping to
 * the theme's edge colour. Which way it ramps, and how far, is per-theme
 * (`vignette` in THEMES) — down to black on the dark variant, up toward paper
 * white on the light one. Either way the centre stays the frame's focus.
 */
export const VIGNETTE_INNER_STOP = 0.25;

/**
 * Colour-dodge source value for the light variant's highlight roll-off. Kept
 * below the headroom the paper background has left, so the paper itself lifts
 * but keeps its warmth while anything brighter clips to white.
 */
export const EXPOSURE_LIFT_AMOUNT = 0.022;

/** Fine grain. Tiles are pre-baked once; the count must divide the loop. */
export const GRAIN_ALPHA = 0.04;
export const GRAIN_TILE_SIZE = 512;
export const GRAIN_TILE_COUNT = 6;
