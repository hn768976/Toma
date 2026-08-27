/**
 * Static geometry for the 4K HUD. Pure numbers only - every colour, label and
 * path string lives in src/variants.ts.
 */

export const W = 3840;
export const H = 2160;
export const DURATION = 600;
export const FPS = 30;

export type Rect = {x: number; y: number; w: number; h: number};

const M = 26; // outer margin
const G = 20; // gutter between the four regions

const COL_W = 740;
const TOP_H = 150;
const BOT_H = 212;

const bodyY = M + TOP_H + 18;
const bodyH = H - M - BOT_H - 18 - bodyY;

export const TOP: Rect = {x: M, y: M, w: W - M * 2, h: TOP_H};
export const LEFT: Rect = {x: M, y: bodyY, w: COL_W, h: bodyH};
export const RIGHT: Rect = {x: W - M - COL_W, y: bodyY, w: COL_W, h: bodyH};
export const VIEWPORT: Rect = {
  x: LEFT.x + LEFT.w + G,
  y: bodyY,
  w: RIGHT.x - (LEFT.x + LEFT.w) - G * 2,
  h: bodyH,
};
export const BOTTOM: Rect = {x: M, y: H - M - BOT_H, w: W - M * 2, h: BOT_H};

/** Split a rect into stacked/side-by-side sub-rects using flex weights. */
export const split = (
  r: Rect,
  weights: number[],
  gap: number,
  dir: 'v' | 'h',
): Rect[] => {
  const total = weights.reduce((a, b) => a + b, 0);
  const span = (dir === 'v' ? r.h : r.w) - gap * (weights.length - 1);
  const out: Rect[] = [];
  let cursor = dir === 'v' ? r.y : r.x;
  for (const wgt of weights) {
    const size = (span * wgt) / total;
    out.push(
      dir === 'v'
        ? {x: r.x, y: cursor, w: r.w, h: size}
        : {x: cursor, y: r.y, w: size, h: r.h},
    );
    cursor += size + gap;
  }
  return out;
};

export const PANEL_GAP = 14;

/** Left column: waveform, data table, two numeric readouts, bar-meter grid. */
export const LEFT_SLOTS = split(LEFT, [3.0, 6.4, 1.5, 1.5, 4.6], PANEL_GAP, 'v');
/** Right column: vertical meters, radar dials, scrolling text, value strips. */
export const RIGHT_SLOTS = split(RIGHT, [4.2, 3.0, 4.4, 3.0], PANEL_GAP, 'v');
/** Bottom strip: histogram, dense numerals, status row. */
export const BOTTOM_SLOTS = split(BOTTOM, [4.4, 3.0, 3.2], PANEL_GAP, 'h');

/** The subject sits inside the viewport window, inset from its border. */
export const STAGE: Rect = {
  x: VIEWPORT.x + 96,
  y: VIEWPORT.y + 130,
  w: VIEWPORT.w - 192,
  h: VIEWPORT.h - 260,
};

export const BORDER = 2; // panel hairline weight at 4K

/** Timeline keyframes. */
export const T_FRAME_IN = 25;
export const T_ASSEMBLE_START = 25;
export const T_ASSEMBLE_END = 90;
