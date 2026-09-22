import { mulberry32 } from "./random";

/**
 * The binary field's *content* -- drawn once, here, at module-evaluation time.
 *
 * This is deliberately separate from the canvas rasterisation in
 * digitTexture.ts: the glyph choices and brightnesses must be fixed before any
 * asynchronous font loading happens, so that whatever order things resolve in,
 * every render thread paints the identical field.
 */

const SEED = 0x5ca1ab1e;

/** Character cell grid. See README for how these numbers were chosen. */
export const COLS = 112;
export const ROWS = 32;

/** Texture is 4096 wide so digits survive a 4K close-up. */
export const TEX_W = 4096;
export const TEX_H = 2048;

export const CELL_W = TEX_W / COLS; // 36.571
export const CELL_H = TEX_H / ROWS; // 64
export const FONT_PX = 50;

export const GLYPH_ZERO = 0;
export const GLYPH_ONE = 1;
export const GLYPH_BLOCK = 2;

const CELL_COUNT = COLS * ROWS;

export const glyphs = new Uint8Array(CELL_COUNT);
export const brightness = new Float32Array(CELL_COUNT);

const rng = mulberry32(SEED);

/**
 * Brightness spread is what stops the field reading as a printed pattern: the
 * references have a handful of digits far brighter than their neighbours and a
 * scattering of near-dark ones, rather than one even grey.
 */
for (let i = 0; i < CELL_COUNT; i++) {
  const r = rng();
  if (r < 0.014) {
    // Solid bright squares -- present in every reference.
    glyphs[i] = GLYPH_BLOCK;
  } else {
    glyphs[i] = rng() < 0.5 ? GLYPH_ZERO : GLYPH_ONE;
  }

  const b = rng();
  if (b < 0.1) {
    brightness[i] = 0.08 + rng() * 0.14; // near-dark
  } else if (b < 0.82) {
    brightness[i] = 0.34 + rng() * 0.36; // the bulk of the field
  } else {
    brightness[i] = 0.86 + rng() * 0.14; // hot digits, these are what bloom
  }

  if (glyphs[i] === GLYPH_BLOCK) {
    brightness[i] = 0.82 + rng() * 0.18;
  }
}

/**
 * Break up runs of a repeated digit. Nothing in a 0/1 field can spell a word,
 * but a long run of one character reads as a rendering fault rather than as
 * data, and the prompt asks the field to stay free of accidental strings.
 */
const MAX_RUN = 9;
for (let row = 0; row < ROWS; row++) {
  let run = 1;
  for (let col = 1; col < COLS; col++) {
    const i = row * COLS + col;
    const prev = row * COLS + col - 1;
    if (glyphs[i] === glyphs[prev] && glyphs[i] !== GLYPH_BLOCK) {
      run++;
      if (run > MAX_RUN) {
        glyphs[i] = glyphs[i] === GLYPH_ZERO ? GLYPH_ONE : GLYPH_ZERO;
        run = 1;
      }
    } else {
      run = 1;
    }
  }
}
