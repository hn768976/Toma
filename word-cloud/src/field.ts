import { mulberry32, shuffled } from "./random";
import { WORDS } from "./words";

/**
 * ---------------------------------------------------------------------------
 * Geometry
 * ---------------------------------------------------------------------------
 * Everything lives in "world units", where 1 unit = the composition width at
 * depth z = 1. The camera sits at the origin looking down +z with a focal
 * length of exactly 1 unit, so a word at depth z projects at scale = 1 / z
 * and the visible half-width at that depth is 0.5 * z units.
 *
 * The projection is applied by hand rather than by handing translateZ to a
 * CSS `perspective` container. Both produce identical geometry, but a CSS 3D
 * scale rasterises the glyph once and stretches the texture - at 4K the
 * nearest words are magnified ~6x and would arrive visibly soft. Projecting
 * by hand lets us set an absolute px font-size per frame, so every word,
 * near or far, is laid out and rasterised by the text engine at its final
 * size. The elements stay real DOM text throughout; nothing is rasterised
 * into a canvas or a texture.
 */

/** Nearest depth a word reaches before it recycles to the back of the field. */
export const Z_NEAR = 0.16;
/** Furthest depth in the field. */
export const Z_FAR = 3.2;
/** One full layer-spacing cycle. The camera covers exactly this per loop. */
export const Z_CYCLE = Z_FAR - Z_NEAR;

/** Horizontal / vertical spread, in world units at z = 1. */
const X_SPREAD = 1.1;
const Y_SPREAD = 0.62;

/** Depth band that stays in focus. Outside it, defocus ramps up. */
const FOCUS_NEAR = 0.62;
const FOCUS_FAR = 1.45;

/** Font size at z = 1, as a fraction of composition width, before sizeMul. */
const BASE_SIZE = 0.04;

const COUNT = 84;
const GRID_X = 12;
const GRID_Y = 7;

export type WordInstance = {
  word: string;
  /** Horizontal offset in world units. */
  x: number;
  /** Vertical offset in world units. */
  y: number;
  /** Depth at frame 0. */
  z0: number;
  /** Per-instance size multiplier, so a depth band is not one uniform size. */
  sizeMul: number;
  /** Per-instance weight offset, so a depth band mixes weights. */
  weightBias: number;
};

const UNIQUE_WORDS = Array.from(new Set<string>(WORDS));

/**
 * Builds the field once, at module level.
 *
 * Depth is stratified (one instance per equal slice of the cycle, jittered)
 * so words arrive at a steady rate rather than in clumps, and x/y come from a
 * shuffled 12x7 jittered grid over a span wider and taller than the frame -
 * that is what makes words enter from the sides instead of all blooming out
 * of the centre, and it keeps the corners populated.
 */
const buildField = (seed: number): WordInstance[] => {
  const rnd = mulberry32(seed);
  const cells = shuffled(
    Array.from({ length: GRID_X * GRID_Y }, (_, i) => i),
    rnd,
  );

  const placed: WordInstance[] = [];
  const lastPlacement: Record<string, { x: number; y: number }> = {};
  let deck: string[] = [];

  for (let i = 0; i < COUNT; i++) {
    const z0 = Z_NEAR + (Z_CYCLE * (i + 0.5 + (rnd() - 0.5) * 0.9)) / COUNT;

    const cell = cells[i % cells.length];
    const col = cell % GRID_X;
    const row = Math.floor(cell / GRID_X);
    const x = -X_SPREAD + ((col + rnd()) * (2 * X_SPREAD)) / GRID_X;
    const y = -Y_SPREAD + ((row + rnd()) * (2 * Y_SPREAD)) / GRID_Y;

    // Words are drawn round-robin from a reshuffled deck, so every word is
    // used the same number of times and two instances of the same word are
    // always at least a deck apart in depth - a quarter of the cycle. The
    // reshuffle also keeps a word from landing at a similar spot on screen as
    // its previous instance.
    if (deck.length === 0) {
      deck = shuffled(UNIQUE_WORDS, rnd);
    }
    let pick = 0;
    for (let attempt = 0; attempt < deck.length; attempt++) {
      const previous = lastPlacement[deck[attempt]];
      if (!previous || Math.hypot(previous.x - x, previous.y - y) > 0.45) {
        pick = attempt;
        break;
      }
    }
    const word = deck.splice(pick, 1)[0];
    lastPlacement[word] = { x, y };

    placed.push({
      word,
      x,
      y,
      z0,
      sizeMul: 0.72 + rnd() * 0.75,
      weightBias: (rnd() - 0.5) * 140,
    });
  }

  return placed;
};

export const FIELD = buildField(0x5eed1234);

/**
 * ---------------------------------------------------------------------------
 * Per-frame depth math - all pure functions of the loop phase
 * ---------------------------------------------------------------------------
 */

/** Depth of an instance at loop phase p (0..1). Travel is linear, no easing. */
export const depthAt = (instance: WordInstance, phase: number) => {
  const travelled = instance.z0 - Z_CYCLE * phase - Z_NEAR;
  return Z_NEAR + (((travelled % Z_CYCLE) + Z_CYCLE) % Z_CYCLE);
};

/** 0 at the near plane, 1 at the far plane. Drives colour, opacity, weight. */
export const depthT = (z: number) => (z - Z_NEAR) / Z_CYCLE;

const rampAt = (t: number, stops: readonly (readonly [number, number])[]) => {
  if (t <= stops[0][0]) {
    return stops[0][1];
  }
  for (let i = 1; i < stops.length; i++) {
    const [t1, v1] = stops[i];
    if (t <= t1) {
      const [t0, v0] = stops[i - 1];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return stops[stops.length - 1][1];
};

export const ramp = rampAt;

/**
 * Opacity purely as a function of depth: the furthest layer sits at ~15% and
 * lifts to 100% across the readable mid-field. The short ramp below t = 0.04
 * is the near plane - by then a word is several frame-widths wide and mostly
 * off-screen, and taking it to zero there is what lets the field recycle to
 * the back without a pop.
 */
const OPACITY_STOPS = [
  [0, 0],
  [0.04, 1],
  [0.3, 1],
  [0.62, 0.62],
  [0.85, 0.3],
  [1, 0.15],
] as const;

export const opacityAt = (t: number) => rampAt(t, OPACITY_STOPS);

/** Heavier as words come forward. Inter is variable, so this glides. */
const WEIGHT_STOPS = [
  [0, 760],
  [0.3, 620],
  [0.6, 460],
  [1, 300],
] as const;

export const weightAt = (t: number, bias: number) =>
  Math.round(Math.min(900, Math.max(200, rampAt(t, WEIGHT_STOPS) + bias)));

/**
 * A modest depth of field. Blur is quantised into 5 buckets so the field only
 * ever uses a handful of distinct filter values, and both the bucket and the
 * radius are recomputed every frame from the current distance to the focal
 * band - words genuinely sharpen as they approach it.
 *
 * Radii are fractions of composition width, so they scale with --scale and a
 * 1080p preview is a true preview of the 4K render. The near maximum is far
 * larger than the far maximum on purpose: near glyphs are ~1000px tall and can
 * carry real softness, far glyphs are ~40px tall and legibility is the product.
 */
const BUCKETS = 5;
const MAX_BLUR_NEAR = 0.0028;
const MAX_BLUR_FAR = 0.0007;

export const blurAt = (z: number, width: number) => {
  let defocus = 0;
  let max = 0;
  if (z < FOCUS_NEAR) {
    defocus = (FOCUS_NEAR - z) / (FOCUS_NEAR - Z_NEAR);
    max = MAX_BLUR_NEAR;
  } else if (z > FOCUS_FAR) {
    defocus = (z - FOCUS_FAR) / (Z_FAR - FOCUS_FAR);
    max = MAX_BLUR_FAR;
  } else {
    return 0;
  }
  const bucket = Math.round(Math.min(1, defocus) * (BUCKETS - 1)) / (BUCKETS - 1);
  return bucket * max * width;
};

/** Glow strength (V1 only), non-zero only for the nearest words. */
export const glowAt = (t: number) => {
  const g = (0.22 - t) / 0.2;
  return Math.min(1, Math.max(0, g));
};

/** Font size in absolute px - never a transform scale. */
export const fontSizeAt = (instance: WordInstance, z: number, width: number) =>
  (BASE_SIZE * instance.sizeMul * width) / z;
