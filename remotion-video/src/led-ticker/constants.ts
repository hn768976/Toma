// Geometry, timing and palette for the 4K "LED stock ticker board" macro shot.
//
// Two coordinate systems are used throughout:
//   * SCREEN space — the 3840x2160 canvas the frame is captured from.
//   * BOARD space  — the flat plane the physical panel lives on. Every LED,
//     every band and every glyph is laid out here, and a single affine
//     (see transform.ts) tilts the whole plane into screen space. Because the
//     dot lattice is defined in board space it tilts *with* the panel, which
//     is what makes it read as an object rather than a filter.

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 60;
export const DURATION_IN_FRAMES = 1200; // 20.0s, seamless loop

// ── The dot lattice ────────────────────────────────────────────────────────
export const PITCH = 11; // LED centre-to-centre, board px
export const LED_RADIUS = 3.5; // 7px emitter, leaving a visible dark gap

// ── Palette. An LED board has a limited emitter set; nothing else is used. ──
export const GREEN = "#22DD33";
export const RED = "#EE2222";
export const WHITE = "#F0F0F0";
export const UNLIT = "#141414";
export const SUBSTRATE = "#000000";

/** LED state stored per lattice cell in a band's sampled sprite. */
export const OFF = 0;
export const LIT_WHITE = 1;
export const LIT_GREEN = 2;
export const LIT_RED = 3;

// ── Camera: one affine, no real projection. ────────────────────────────────
export const TILT_DEG = -9; // bands descend left -> right
export const SKEW_X = 0.1; // horizontal shear
export const SQUEEZE_X = 0.9; // one side compresses ~10%
export const BOARD_SCALE = 1.3; // panel sits close to the lens
export const BOARD_MARGIN = 60; // board px of slack past the frame edge

// ── Band stack ─────────────────────────────────────────────────────────────
export const BAND_COUNT = 6;
export const TEXT_ROWS = 16; // lattice rows a band's content sprite occupies
export const GLYPH_ROWS = 12; // cap height, in LEDs
/** Archivo's cap height as a fraction of the em box. */
export const CAP_RATIO = 0.731;
export const FONT_PX = Math.round((GLYPH_ROWS * PITCH) / CAP_RATIO);
export const MIN_GAP = 200; // board px between entries, before padding

// ── Depth of field. Bands are bucketed; buffers are blurred once each. ─────
export const BUCKET_SHARP = 0;
export const BUCKET_MID = 1;
export const BUCKET_FAR = 2;
export const MID_BLUR = 3;
export const FAR_BLUR = 13;
export const DEFOCUS_BLUR = 20; // frame-wide falloff pass, layered on top

// ── Finish ─────────────────────────────────────────────────────────────────
export const BLOOM_BLUR = 24;
export const BLOOM_ALPHA = 0.34;
export const VIGNETTE_ALPHA = 0.22;
export const GRAIN_ALPHA = 0.04;
export const GRAIN_TILE = 256;

// ── Panel life ─────────────────────────────────────────────────────────────
export const BREATHE_AMOUNT = 0.03; // +/-3%
export const BREATHE_PERIOD = 400; // frames; divides 1200 exactly
export const DEAD_LED_COUNT = 24;

/**
 * Per-band scroll. `cols` is the band's content sequence length in LEDs, so
 * the sequence is exactly `cols * PITCH` board px wide and the band travels
 * exactly one sequence over the 1200-frame loop — that is what closes it.
 * Speed therefore falls out as `cols * PITCH / 20` px/s.
 *
 * The two slowest bands (whose short sequences tile most often across the
 * frame) are the far-focus ones, where the repeat dissolves into the blur.
 */
export const BANDS: {
  cols: number;
  dir: 1 | -1;
  bucket: number;
}[] = [
  { cols: 313, dir: 1, bucket: BUCKET_SHARP }, // 172.2 px/s
  { cols: 300, dir: -1, bucket: BUCKET_SHARP }, // 165.0 px/s
  { cols: 273, dir: 1, bucket: BUCKET_MID }, // 150.2 px/s
  { cols: 287, dir: -1, bucket: BUCKET_MID }, // 157.9 px/s
  { cols: 215, dir: 1, bucket: BUCKET_FAR }, // 118.3 px/s
  { cols: 200, dir: -1, bucket: BUCKET_FAR }, // 110.0 px/s
];

export const FONT_FAMILY = "ArchivoLed";

/** Positive modulo — scroll offsets go negative for right-moving bands. */
export const mod = (a: number, n: number) => ((a % n) + n) % n;
