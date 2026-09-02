import { HEIGHT, WALL_BLOCK_BLEED, WALL_BLOCK_W } from "./constants";
import { mix, rgba, shade } from "../lib/colorUtils";
import { noiseField } from "../lib/noiseField";
import { random } from "remotion";
import type { Palette } from "./variants";

/**
 * WallTexture — the dark panelled surface the clippings are pinned to.
 *
 * Three things make it read as a wall rather than as a noise field:
 *
 *   · broad, soft tonal patches, some lighter and some darker, at a scale of
 *     several hundred pixels;
 *   · a vertical brushed quality, produced by sampling the same field with a
 *     strongly anisotropic aspect so it smears into long vertical streaks, and
 *     reinforced with drawn brush strokes;
 *   · a few faint vertical seams, as though the surface is panelled.
 *
 * It is baked once into a block that tiles horizontally. Tiling works because
 * the noise lattice wraps: the block's left and right edges sample the same
 * lattice column, so no seam appears where copies meet.
 */

export const WALL_BLOCK_H = HEIGHT + WALL_BLOCK_BLEED * 2;

const SEAM_POSITIONS = [0.14, 0.41, 0.68, 0.9];

export const bakeWall = (palette: Palette, variantKey: string): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = WALL_BLOCK_W;
  canvas.height = WALL_BLOCK_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = palette.wallDeep;
  ctx.fillRect(0, 0, WALL_BLOCK_W, WALL_BLOCK_H);

  // --- broad tone + vertical brushing, painted at half resolution ---------
  const lowW = Math.round(WALL_BLOCK_W / 2);
  const lowH = Math.round(WALL_BLOCK_H / 2);
  const low = document.createElement("canvas");
  low.width = lowW;
  low.height = lowH;
  const lctx = low.getContext("2d");
  if (!lctx) return canvas;

  // Each field is sampled over exactly its own lattice width across the block,
  // so it repeats once per block — that is what makes the tiling seamless.
  const broad = noiseField({
    seed: `${variantKey}:wall:broad`,
    octaves: 3,
    latticeW: 20,
    latticeH: 24,
    persistence: 0.55,
  });
  // A second field sampled at ten times the horizontal frequency but barely
  // any vertical frequency. Walking it that way smears it into long vertical
  // striations roughly 14px wide — the brushed quality — for the price of one
  // extra noise lookup per pixel.
  const brushed = noiseField({
    seed: `${variantKey}:wall:brush`,
    octaves: 3,
    latticeW: 200,
    latticeH: 12,
    persistence: 0.6,
  });

  const img = lctx.createImageData(lowW, lowH);
  const data = img.data;
  const midHex = palette.wallMid;

  for (let py = 0; py < lowH; py++) {
    const v = py / lowH;
    for (let px = 0; px < lowW; px++) {
      const u = px / lowW;
      // Each sample walks exactly one full lattice period across the block.
      const b = broad.sample(u * 20, v * 13);
      const s = brushed.sample(u * 200, v * 5);
      const t = Math.max(0, Math.min(1, b * 0.68 + s * 0.32));
      // Push the distribution towards the dark end: the wall must stay dark
      // relative to the paper, or the clippings stop reading as bright.
      const shaped = Math.pow(t, palette.wallGamma);
      const c = mix(palette.wallDark, midHex, shaped);
      const i = (py * lowW + px) * 4;
      data[i] = c.r;
      data[i + 1] = c.g;
      data[i + 2] = c.b;
      data[i + 3] = 255;
    }
  }
  lctx.putImageData(img, 0, 0);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 0.92;
  ctx.drawImage(low, 0, 0, WALL_BLOCK_W, WALL_BLOCK_H);
  ctx.restore();

  // --- drawn brush strokes, at full resolution ---------------------------
  // These carry the crisp vertical detail the half-resolution pass loses.
  ctx.save();
  const strokeCount = 420;
  for (let i = 0; i < strokeCount; i++) {
    const x = random(`${variantKey}:brush:x:${i}`) * WALL_BLOCK_W;
    const width = 2 + random(`${variantKey}:brush:w:${i}`) * 13;
    const top = random(`${variantKey}:brush:t:${i}`) * WALL_BLOCK_H;
    const len = (0.15 + random(`${variantKey}:brush:l:${i}`) * 0.75) * WALL_BLOCK_H;
    const lighter = random(`${variantKey}:brush:s:${i}`) < 0.5;
    const alpha = 0.02 + random(`${variantKey}:brush:a:${i}`) * 0.075;
    const grad = ctx.createLinearGradient(0, top, 0, top + len);
    const col = lighter ? palette.wallMid : palette.wallDark;
    grad.addColorStop(0, rgba(col, 0));
    grad.addColorStop(0.35, rgba(col, alpha));
    grad.addColorStop(0.7, rgba(col, alpha));
    grad.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = grad;
    // Wrapped copies keep strokes that straddle the block edge continuous.
    ctx.fillRect(x, top, width, len);
    if (x < width) ctx.fillRect(x + WALL_BLOCK_W, top, width, len);
    if (x > WALL_BLOCK_W - width) ctx.fillRect(x - WALL_BLOCK_W, top, width, len);
  }
  ctx.restore();

  // --- panel seams -------------------------------------------------------
  ctx.save();
  for (let i = 0; i < SEAM_POSITIONS.length; i++) {
    const sx = Math.round(SEAM_POSITIONS[i] * WALL_BLOCK_W);
    const jitter = (random(`${variantKey}:seam:${i}`) - 0.5) * 40;
    const px = sx + jitter;
    // A soft darkening either side, then the crack, then a catch of light.
    const halo = ctx.createLinearGradient(px - 46, 0, px + 46, 0);
    halo.addColorStop(0, rgba(palette.wallDark, 0));
    halo.addColorStop(0.5, rgba(palette.wallDark, 0.28));
    halo.addColorStop(1, rgba(palette.wallDark, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(px - 46, 0, 92, WALL_BLOCK_H);
    ctx.fillStyle = rgba(palette.wallDark, 0.55);
    ctx.fillRect(px, 0, 1.5, WALL_BLOCK_H);
    ctx.fillStyle = shade(palette.wallMid, 0.1, 0.16);
    ctx.fillRect(px + 2.5, 0, 1.5, WALL_BLOCK_H);
  }
  ctx.restore();

  return canvas;
};

/**
 * The travelling light. It crosses the wall on its own closed path at a rate
 * unrelated to the lattice drift, so illumination and content visibly move
 * independently. Two cycles per loop, which closes exactly at frame 420.
 */
export const paintLightGradient = (
  ctx: CanvasRenderingContext2D,
  opts: {
    t: number;
    width: number;
    height: number;
    palette: Palette;
    strength: number;
  },
): void => {
  const { t, width, height, palette, strength } = opts;
  const angle = t * Math.PI * 2 * 2;
  const cx = width * (0.5 + Math.cos(angle) * 0.62);
  const cy = height * (0.42 + Math.sin(angle * 0.5) * 0.34);
  const radius = Math.max(width, height) * 0.78;

  const grad = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius);
  grad.addColorStop(0, rgba(palette.papers[0], strength));
  grad.addColorStop(0.45, rgba(palette.papers[0], strength * 0.4));
  grad.addColorStop(1, rgba(palette.papers[0], 0));

  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // The trailing shade opposite the light keeps the wall from flattening out.
  const sx = width - cx;
  const sy = height - cy;
  const shadeGrad = ctx.createRadialGradient(sx, sy, radius * 0.05, sx, sy, radius);
  shadeGrad.addColorStop(0, rgba(palette.wallDark, strength * 0.8));
  shadeGrad.addColorStop(1, rgba(palette.wallDark, 0));
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = shadeGrad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};
