import { random } from 'remotion';
import { GRAIN_TILE, GRAIN_TILES } from './constants';

/**
 * A tiny deterministic PRNG, seeded once from Remotion's `random()`.
 *
 * Filling four 512×512 tiles is a million and a half samples; going through
 * `random()` with a string seed for each one would cost far more than the
 * grain is worth. Seeding this from `random()` keeps the whole thing a pure
 * function of the seed string, which is all determinism actually requires.
 */
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Pre-render the grain tiles.
 *
 * Sensor noise on a near-black macro plate reads as sparse bright speckle, so
 * the tiles are mostly dark with an occasional hot pixel and get composited
 * additively. The steep exponent is what produces that distribution.
 */
export const buildGrainTiles = (): HTMLCanvasElement[] =>
  Array.from({ length: GRAIN_TILES }, (_, t) => {
    const canvas = document.createElement('canvas');
    canvas.width = GRAIN_TILE;
    canvas.height = GRAIN_TILE;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    const rand = mulberry32(Math.floor(random(`grain-${t}`) * 0xffffffff));

    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.pow(rand(), 2.6) * 255;
      // A touch of per-channel variation so the speckle is not pure grey.
      img.data[i] = v * (0.85 + rand() * 0.3);
      img.data[i + 1] = v * (0.85 + rand() * 0.3);
      img.data[i + 2] = v * (0.85 + rand() * 0.3);
      img.data[i + 3] = 255;
    }

    ctx.putImageData(img, 0, 0);
    return canvas;
  });

/**
 * The tile that carves LCD structure out of the sharp glyphs.
 *
 * Chiefly vertical — one dark column per subpixel triad — with a much weaker
 * horizontal component for the gap between pixel rows. Pure vertical striping
 * reads as a comb laid over the text; the faint second axis is what makes it
 * read as a pixel grid seen close up, which is what the reference plate shows.
 */
export const buildStripeTile = (period: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = period;
  canvas.height = period;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(0, 0, period, 1);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 1, period);
  return canvas;
};
