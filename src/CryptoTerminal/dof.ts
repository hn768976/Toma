import {BLUR_FAR, BLUR_MID, BLUR_SHARP, HEIGHT, WIDTH} from './constants';
import {Theme} from './theme';

/**
 * Faked depth of field.
 *
 * The scene is drawn ONCE into a master buffer. That master is then copied into
 * three layer buffers, each masked by a smooth weight field, and composited
 * far -> mid -> sharp with a single `ctx.filter = 'blur(Npx)'` per layer.
 * Per-element blurring would be unusably slow at 4K.
 *
 * Defocused content must LOSE contrast, whichever way the theme runs: each
 * blurred layer is washed toward the theme's background colour with a
 * `source-atop` fill before it is composited. On white that means lifting the
 * content toward white; on black, sinking it toward black. Either way the
 * blurred layers recede instead of glowing.
 */

/** Extra margin on every buffer so a 30px blur never samples past the edge. */
export const BLEED = 96;
export const BUF_W = WIDTH + BLEED * 2;
export const BUF_H = HEIGHT + BLEED * 2;

const LEVELS = [BLUR_SHARP, BLUR_MID, BLUR_FAR] as const;

/** Resolution of the precomputed weight fields, upscaled bilinearly at use. */
const MASK_W = 320;
const MASK_H = 180;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Blur radius in device pixels at a normalised frame position.
 *
 * The plane of focus is a diagonal band through the chart's lower-middle.
 * Falloff is strongly asymmetric: the upper-left recedes into white haze, the
 * near lower-right softens more gently, and the far-right column — a different
 * panel of the UI, further from the lens — softens on its own.
 */
export const blurAt = (u: number, v: number): number => {
  const g = (0.56 - u) * 0.74 + (0.50 - v) * 0.60;
  const far = clamp01(g / 0.40) ** 1.05;
  const near = clamp01(-g / 0.60) ** 1.3;
  const right = clamp01((u - 0.80) / 0.22) ** 1.2;
  return BLUR_FAR * clamp01(far * 1.0 + near * 0.62 + right * 0.42);
};

/** Splits a blur radius into weights across the three fixed buffer levels. */
const weights = (blur: number): [number, number, number] => {
  if (blur <= LEVELS[1]) {
    const t = clamp01((blur - LEVELS[0]) / (LEVELS[1] - LEVELS[0]));
    return [1 - t, t, 0];
  }
  const t = clamp01((blur - LEVELS[1]) / (LEVELS[2] - LEVELS[1]));
  return [0, 1 - t, t];
};

const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

export type DofBuffers = {
  master: HTMLCanvasElement;
  layers: HTMLCanvasElement[];
  masks: HTMLCanvasElement[];
};

/** Allocates the master, the three layer buffers and the three weight fields. */
export const createBuffers = (): DofBuffers => {
  const masks = [0, 1, 2].map((layer) => {
    const c = makeCanvas(MASK_W, MASK_H);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const img = ctx.createImageData(MASK_W, MASK_H);
    for (let y = 0; y < MASK_H; y++) {
      for (let x = 0; x < MASK_W; x++) {
        // Mask space spans the bleed-extended buffer, not just the frame.
        const u = ((x + 0.5) / MASK_W) * (BUF_W / WIDTH) - BLEED / WIDTH;
        const v = ((y + 0.5) / MASK_H) * (BUF_H / HEIGHT) - BLEED / HEIGHT;
        const w = weights(blurAt(u, v))[layer];
        const i = (y * MASK_W + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(w * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });

  return {
    master: makeCanvas(BUF_W, BUF_H),
    layers: [0, 1, 2].map(() => makeCanvas(BUF_W, BUF_H)),
    masks,
  };
};

/**
 * Composites the master buffer onto `out` through the three-layer DOF stack.
 * Draw order is far -> mid -> sharp so nearer, crisper content sits on top.
 */
export const compositeDof = (
  out: CanvasRenderingContext2D,
  bufs: DofBuffers,
  t: Theme
) => {
  const [r, g, b] = t.bgRgb;
  for (let layer = 2; layer >= 0; layer--) {
    const canvas = bufs.layers[layer];
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'copy';
    ctx.filter = 'none';
    ctx.drawImage(bufs.master, 0, 0);

    // Keep only this layer's share of the scene.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bufs.masks[layer], 0, 0, BUF_W, BUF_H);

    // Defocused content washes toward the background instead of glowing.
    const wash = t.dofWash[layer];
    if (wash > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(${r},${g},${b},${wash})`;
      ctx.fillRect(0, 0, BUF_W, BUF_H);
    }
    ctx.globalCompositeOperation = 'source-over';

    out.save();
    out.globalAlpha = t.dofAlpha[layer];
    out.filter = LEVELS[layer] > 0 ? `blur(${LEVELS[layer]}px)` : 'none';
    out.drawImage(canvas, -BLEED, -BLEED);
    out.restore();
  }
  out.filter = 'none';
};
