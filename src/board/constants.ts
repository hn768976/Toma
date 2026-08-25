/**
 * Every tunable number for the ticker board lives here.
 *
 * Nothing in this file may depend on the current frame: the composition is a
 * pure function of `useCurrentFrame()`, so these are all compile-time
 * constants and the render is identical on every machine and every pass.
 */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 60;

/** Loop length. Every periodic quantity in the piece divides evenly into this. */
export const LOOP = 1160;

/** Row pitch in board space. 2160 / 192 = 11.25 rows visible. */
export const ROW_H = 192;

/**
 * Number of distinct rows in each column's cyclic list.
 *
 * A column scrolls exactly one full list per loop, so its period is
 * LOOP / ROWS_PER_LOOP[c] frames per row:
 *   16 -> 72.5f   18 -> 64.4f   15 -> 77.3f   17 -> 68.2f
 * Mean 70.6 frames per row ("roughly one row every 70 frames"), spread ±9.5%
 * — inside the ±12% budget, and every period closes exactly on frame 1160.
 */
export const ROWS_PER_LOOP = [16, 18, 15, 17, 16];

/** Uneven column widths as a fraction of the un-receded board. */
export const COL_FRAC = [0.22, 0.22, 0.18, 0.19, 0.19];

/**
 * The board is wider than the frame so no outer table boundary is ever visible.
 *
 * The rotation and shear together move a board-space vertical by up to
 * ±127px across the frame height, so the outer rules need at least 130px of
 * overhang on each side to stay outside the 3840px window. 4420 * 0.9694
 * (the recede sum) = 4285 of real width, giving 222px each side.
 */
export const BOARD_W_BASE = 4420;

/** Each column further right is drawn slightly smaller (~6.4% by column 5). */
export const COL_RECEDE = [1, 0.984, 0.968, 0.952, 0.936];

/** ...and slightly higher. */
export const COL_LIFT = [0, -13, -26, -39, -52];

/**
 * Glyph sizes.
 *
 * The brief specifies ~52px falling to ~34px, but the reference plate is a
 * macro shot whose cap height is ~100px at 4K. These keep the brief's exact
 * size *ratios* (1 : 1 : 0.90 : 0.79 : 0.65) and scale them to the plate, so
 * the taper into the defocus is as specified and the scale matches the shot.
 */
export const COL_FONT = [136, 136, 122, 107, 88];

/** Column 5 sits further into the defocus, so it is dimmer at source. */
export const COL_ALPHA = [1, 1, 0.97, 0.95, 0.78];

/**
 * Where a column's numerals sit.
 *
 * Digits are right-aligned so the decimal points line up, but the *block* of
 * them is centred in the column rather than pushed to its right edge — column
 * 5 hangs past the frame edge otherwise, and there is nothing to its right to
 * align to. `COL_CHARS` is the typical string length per column and
 * `MONO_ADVANCE` is Roboto Mono's fixed advance in ems, which together give
 * the block width without having to measure text before laying out.
 */
export const COL_CHARS = [5, 6, 5, 5, 5];
export const MONO_ADVANCE = 0.6;

/** Nudge the block back from dead centre, toward the column's right edge. */
export const COL_TRIM = 0.045;

/**
 * Keep every numeral inside the frame.
 *
 * The board overhangs the frame on both sides so its outer rules stay hidden,
 * which puts the outer columns' blocks partly outside it. The crop is framed
 * so they clear the edge instead: `FRAME_SAFE` is the margin to hold, and
 * `FRAME_SHIFT` is the worst-case horizontal displacement the tilt and shear
 * apply to a board-space point across the full frame height.
 */
export const FRAME_SAFE = 24;
export const FRAME_SHIFT = 130;

/**
 * Row rules read fainter than the vertical ones on the reference plate, which
 * is what keeps the board from looking like a spreadsheet grid.
 */
export const RULE_ROW_ALPHA = 0.62;

// ── Palette ────────────────────────────────────────────────────────────────

export const GREEN: RGB = [0x2e, 0xcc, 0x8f];
export const RED: RGB = [0xe0, 0x47, 0x3c];
export const TEAL: RGB = [0x35, 0xc4, 0xc4];
export const OFFWHITE: RGB = [0xd8, 0xdc, 0xe4];
export const RULE: RGB = [0x2a, 0x35, 0x50];
export const SUBSTRATE = '#0A0D14';

export type RGB = [number, number, number];

// ── Camera ─────────────────────────────────────────────────────────────────

/** Shot from slightly left and below, so the board recedes to the right. */
export const TILT_DEG = -3.6;

/** Horizontal shear: x' = x + SHEAR * y. */
export const SHEAR = 0.055;

/** Extra per-rule tilt so the verticals converge toward the upper right. */
export const RULE_CONVERGE_DEG = 0.34;

/** Rule stroke width in board units. */
export const RULE_W = 2.4;

// ── Depth of field ─────────────────────────────────────────────────────────

/**
 * Three offscreen planes, each blurred exactly once and then composited.
 * Per-cell blurring would be unusably slow at 4K.
 *
 * `scale` is the plane's resolution relative to the frame. The mid and far
 * planes are blurred well past the point where their own resolution is
 * visible, so rendering them small costs nothing and saves most of the time.
 * `blur` is the radius in frame pixels; it is divided by `scale` when applied
 * inside the plane.
 */
export const PLANES = [
  { scale: 1, blur: 0, glow: 0 },
  { scale: 0.5, blur: 8, glow: 10 },
  { scale: 0.34, blur: 21, glow: 16 },
] as const;

/** Where each plane sits on the 0..1 focus-distance axis. */
export const PLANE_DIST = [0, 0.5, 1];

/** Defocused text loses this much saturation. */
export const PLANE_DESAT = [0, 0.28, 0.5];

/** Extra additive glow of the defocused planes, as emissive screens do. */
export const PLANE_GLOW_ALPHA = [0, 0.2, 0.26];

/** Right-hand edge of the sharp band, as a fraction of frame width. */
export const FOCUS_X = 0.38;

/** Sharp band half-height and falloff, as fractions of frame height. */
export const FOCUS_Y_CORE = 0.16;
export const FOCUS_Y_FALLOFF = 0.34;

/**
 * Weights of the two focus terms.
 *
 * Neither reaches 1 on its own: the right-hand edge at mid-height stays a
 * plane short of maximum blur, and only the far corners — where both terms
 * are in play — reach it. Without this the price columns dissolve completely
 * halfway up the frame.
 */
export const FOCUS_X_WEIGHT = 0.76;
export const FOCUS_Y_WEIGHT = 0.85;

// ── Subpixel texture ───────────────────────────────────────────────────────

/** Strength of the RGB fringe drawn under the sharp glyphs. */
export const FRINGE_ALPHA = 0.1;

/** LCD pixel-grid period in frame pixels, and how much it carves out. */
export const STRIPE_PERIOD = 3;
export const STRIPE_ALPHA = 0.115;

// ── Live feed ──────────────────────────────────────────────────────────────

/** Rerolls per second across the whole board. */
export const REROLLS_PER_SEC = 4;

/** Frames a rerolled cell holds at peak brightness. */
export const FLASH_HOLD = 4;

/** Frames it takes to ease back down afterwards. */
export const FLASH_DECAY = 10;

/** Peak brightness multiplier of a flash. */
export const FLASH_PEAK = 1.8;

/**
 * Minimum gap between two rerolls of the same cell, measured cyclically so it
 * still holds across the loop seam. Must exceed FLASH_HOLD + FLASH_DECAY, so a
 * cell can never reroll while it is mid-flash from the previous one.
 */
export const REROLL_MIN_GAP = 20;

// ── Screen life ────────────────────────────────────────────────────────────

/** Brightness breathe: ±4%, two cycles per loop. */
export const BREATHE_AMP = 0.04;
export const BREATHE_CYCLES = 2;

/** Refresh band: 200px tall, crosses the frame twice per loop. */
export const BAND_H = 200;
export const BAND_PASSES = 2;
export const BAND_ALPHA = 0.014;

// ── Finish ─────────────────────────────────────────────────────────────────

export const BLOOM_SCALE = 0.25;
export const BLOOM_BLUR = 7;
export const BLOOM_ALPHA = 0.3;

export const VIGNETTE = 0.18;

export const GRAIN_ALPHA = 0.05;
export const GRAIN_TILE = 512;
export const GRAIN_TILES = 4;
