/**
 * Composition + plane geometry.
 *
 * Every length in this project is expressed in "reference pixels" — the
 * pixels of the 3840x2160 master composition. Components multiply them by
 * `u = width / REF_WIDTH` (see `useUnit`) so the exact same layout, blur
 * radius and perspective come out at any composition size. Perspective
 * *scale* (`s`) is a ratio and is therefore resolution independent.
 */

export const REF_WIDTH = 3840;
export const REF_HEIGHT = 2160;
export const FPS = 30;
/** 16 s. Every animated quantity is periodic with exactly this period. */
export const DURATION_IN_FRAMES = 480;

/* ---------------------------------------------------------------- plane */

/**
 * Negative rotateY puts the near edge of the board on the right and throws
 * the vanishing point off the left edge of the frame — the framing of the
 * reference. Flip the sign of ROT_Y_DEG (and mirror ORIGIN_X to 1 - 0.62)
 * to mirror the whole board.
 */
export const ROT_Y_DEG = -38;
export const ROT_X_DEG = 6;
export const PERSPECTIVE = 2250;

/** Perspective origin, as a fraction of the frame. Also the plane's origin. */
export const ORIGIN_X = 0.62;
export const ORIGIN_Y = 0.35;

/* -------------------------------------------------------------- lattice */

/** Horizontal distance between two quote blocks, in plane units. */
export const BLOCK_PITCH = 1470;
/** Vertical distance between two quote rows, in plane units. */
export const ROW_PITCH = 470;

/**
 * Scroll over one loop, in whole lattice steps. Because the shift is an
 * exact integer number of block pitches *and* row pitches, frame 480 puts
 * block (row, col) exactly where block (row - MY, col - MX) sat at frame 0.
 * `pairIndexFor` below satisfies that identity, which is what makes the
 * loop seamless.
 *
 * The one-row vertical component is what buys the slow, reference-matched
 * horizontal pace: with a purely horizontal scroll the quote sequence would
 * have to repeat every MX blocks, i.e. three times across every row.
 */
export const SCROLL_BLOCKS_PER_LOOP = 3; // MX
export const SCROLL_ROWS_PER_LOOP = 1; // MY

/* ---------------------------------------------------------- block layout */

export const COL_A = 660; // pair label / rate
export const COL_GAP = 48;
export const COL_B = 566; // triangle + absolute change / percentage
export const BLOCK_W = COL_A + COL_GAP + COL_B;

export const LINE_1_H = 123;
export const LINE_2_H = 177;
export const BLOCK_H = LINE_1_H + LINE_2_H;

export const PAIR_FS = 104;
export const RATE_FS = 146;
export const CHANGE_FS = 113;
export const PCT_FS = 113;
export const TRIANGLE_W = 71;
export const TRIANGLE_H = 61;

/** Separator rule sits this far above the top of its row's content. */
export const RULE_OFFSET = 92;
export const RULE_H = 3;
export const RULE_X0 = -19000;
export const RULE_X1 = 2600;

/* ------------------------------------------------------------------ grid */

/** Row indices generated before culling. */
export const ROW_MIN = -14;
export const ROW_MAX = 16;
/** Column indices generated before culling. */
export const COL_MIN = -13;
export const COL_MAX = 5;

/** Blocks nearer than this are past the camera; blocks fainter than the
 * lower bound sit at the horizon and are dropped. */
export const MIN_SCALE = 0.14;

/* ---------------------------------------------------------- depth of field */

/**
 * Depth of field, as a handful of discrete slices rather than a gradient
 * blur. A slice is a full-frame layer with its own `filter: blur()`, and
 * the blocks that fall in that depth band are the only thing drawn into it.
 *
 * Blurring the layer rather than the block matters twice over. A filter on
 * a 3D-transformed element makes the browser rasterise that element and
 * then magnify the raster, which visibly softens the type — the exact
 * "do not rasterise" failure this board cannot afford. And a lens blurs the
 * image, not the object, so a screen-space radius is also the physically
 * right model: `blur` below is what the viewer actually sees, in reference
 * px, with no perspective correction needed.
 *
 * `maxScale` is the perspective scale at which a slice ends. The sharp band
 * sits in the mid-distance; near and far soften.
 */
export const DOF_SLICES: { maxScale: number; blur: number }[] = [
  { maxScale: 0.24, blur: 5.0 },
  { maxScale: 0.38, blur: 2.6 },
  { maxScale: 0.62, blur: 1.1 },
  { maxScale: 1.2, blur: 0.0 },
  { maxScale: 1.5, blur: 0.9 },
  { maxScale: Infinity, blur: 2.4 },
];

export const sliceForScale = (s: number): number => {
  for (let i = 0; i < DOF_SLICES.length; i++) {
    if (s < DOF_SLICES[i].maxScale) return i;
  }
  return DOF_SLICES.length - 1;
};
