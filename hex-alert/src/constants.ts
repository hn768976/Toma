// ---------------------------------------------------------------------------
// Composition geometry
//
// Everything here is chosen so the loop closes exactly and so every derived
// length lands on a whole pixel at 4K *and* at the 1080p half-scale preview.
// ---------------------------------------------------------------------------

export const FPS = 30;
export const DURATION_IN_FRAMES = 720; // 24s
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** 2160 / 54 = 40px rows at 4K, 20px at 1080p. */
export const ROWS_ON_SCREEN = 54;
/** Two spare rows so the top and bottom edges are never empty mid-scroll. */
export const ROWS_RENDERED = ROWS_ON_SCREEN + 2;

/** Rows travelled over one full loop: 18 * 40px = 720px = a third of the frame. */
export const SCROLL_ROWS = 18;
/** 720 / 18 = one row every 40 frames, i.e. exactly 1px per frame at 4K. */
export const FRAMES_PER_ROW = DURATION_IN_FRAMES / SCROLL_ROWS;

/** The row skeleton repeats with the scroll period, which is what makes it loop. */
export const CONTENT_PERIOD = SCROLL_ROWS;

/** JetBrains Mono advance width, in em. Substituting the font breaks this. */
export const CHAR_ADVANCE = 0.6;
/** fontSize = 0.75 * rowHeight → 30px at 4K, 15px at 1080p. */
export const FONT_TO_ROW = 0.75;

export const ROW_H_4K = HEIGHT / ROWS_ON_SCREEN; // 40
export const FONT_SIZE_4K = ROW_H_4K * FONT_TO_ROW; // 30
export const CHAR_W_4K = FONT_SIZE_4K * CHAR_ADVANCE; // 18

/** Resolution independent: width / charWidth is the same at any scale. */
export const CHARS_PER_ROW = Math.ceil(WIDTH / CHAR_W_4K) + 8;

// --- churn cadences, in frames -------------------------------------------
/** How often a given row re-lays-out its token skeleton. */
export const LAYOUT_PERIOD = 240;
/** How often a given token re-randomises its hex characters. */
export const CHAR_PERIOD = 90;
/** How often a highlighted token re-rolls its on/off state. */
export const FLICKER_PERIOD = 37;

/** Keeps the loop invariant positive before it is fed to the hash. */
export const U_OFFSET = 1_000_000;

/**
 * The loop invariant.
 *
 * `u = FRAMES_PER_ROW * dataRow - frame` is unchanged by the substitution
 * (dataRow + SCROLL_ROWS, frame + DURATION_IN_FRAMES), so anything keyed on it
 * repeats exactly at the loop point. Two rows one scroll-period apart differ by
 * a full DURATION_IN_FRAMES, so they never share content on screen.
 */
export const loopInvariant = (dataRow: number, frame: number) =>
  FRAMES_PER_ROW * dataRow - frame + U_OFFSET;
