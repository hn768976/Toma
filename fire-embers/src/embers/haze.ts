/**
 * The warm haze sitting under the embers.
 *
 * This plate is meant to be screen-blended over someone else's footage, so
 * every pixel that is not haze or ember has to encode as a true 0,0,0 — any
 * lift shows up as a grey veil across the buyer's shot. The haze is therefore
 * drawn into its own offscreen buffer, and the grain that dithers it is
 * composited *through that buffer's alpha channel*: outside the haze there is
 * no alpha to write into, so the black floor is untouched by construction.
 */

import { cssRgb, type Palette } from "./palette";
import { hash1 } from "./random";

type Mass = {
  /** Rest position, in fractions of width / height. */
  readonly x: number;
  readonly y: number;
  /** Radius, in fractions of width. */
  readonly r: number;
  readonly alpha: number;
  /** Drift amplitudes (fractions of width) and integer loop frequencies. */
  readonly ax: number;
  readonly ay: number;
  readonly kx: number;
  readonly ky: number;
  readonly px: number;
  readonly py: number;
};

/**
 * Brightest toward the lower edge and lower left — an unseen fire below frame.
 * Every mass is placed so its reach dies well short of the upper-right corner,
 * which leaves a region that is verifiably pure black in the encode.
 */
const MASSES: readonly Mass[] = [
  { x: 0.12, y: 0.88, r: 0.74, alpha: 0.145, ax: 0.028, ay: 0.020, kx: 1, ky: 2, px: 0.11, py: 0.62 },
  { x: 0.42, y: 1.04, r: 0.60, alpha: 0.118, ax: 0.034, ay: 0.016, kx: 2, ky: 1, px: 0.55, py: 0.18 },
  { x: 0.02, y: 0.50, r: 0.44, alpha: 0.068, ax: 0.020, ay: 0.030, kx: 1, ky: 3, px: 0.80, py: 0.44 },
  { x: 0.72, y: 1.06, r: 0.48, alpha: 0.065, ax: 0.030, ay: 0.014, kx: 3, ky: 2, px: 0.27, py: 0.91 },
  { x: 0.30, y: 0.64, r: 0.36, alpha: 0.055, ax: 0.024, ay: 0.026, kx: 2, ky: 3, px: 0.69, py: 0.07 },
  { x: 0.20, y: 1.02, r: 0.26, alpha: 0.06, ax: 0.026, ay: 0.018, kx: 3, ky: 1, px: 0.34, py: 0.73 },
  { x: 0.55, y: 0.88, r: 0.22, alpha: 0.035, ax: 0.022, ay: 0.024, kx: 1, ky: 3, px: 0.92, py: 0.28 },
  { x: 0.06, y: 0.72, r: 0.18, alpha: 0.03, ax: 0.018, ay: 0.022, kx: 3, ky: 2, px: 0.48, py: 0.85 },
];

const TAU = Math.PI * 2;

/** Shaped falloff — a plain linear ramp leaves a visible edge in the gradient. */
const STOPS: readonly [number, number][] = [
  [0, 1],
  [0.3, 0.62],
  [0.55, 0.28],
  [0.78, 0.075],
  [1, 0],
];

const GRAIN_TILE = 256;

type Tiles = { colour: CanvasPattern; additive: CanvasPattern };
const tileCache = new Map<string, Tiles>();

const buildTiles = (ctx: CanvasRenderingContext2D, palette: Palette, key: string): Tiles => {
  const cached = tileCache.get(key);
  if (cached) return cached;

  const make = (salt: number, mode: "colour" | "additive"): CanvasPattern => {
    const c = document.createElement("canvas");
    c.width = GRAIN_TILE;
    c.height = GRAIN_TILE;
    const g = c.getContext("2d");
    if (!g) throw new Error("2d context unavailable");
    const img = g.createImageData(GRAIN_TILE, GRAIN_TILE);
    const d = img.data;
    for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
      const n = hash1((i ^ salt) | 0);
      const o = i * 4;
      if (mode === "colour") {
        // Luminance jitter around the haze tint, applied through source-atop.
        const k = 0.35 + n * 1.4;
        d[o] = Math.min(255, palette.haze.r * k);
        d[o + 1] = Math.min(255, palette.haze.g * k);
        d[o + 2] = Math.min(255, palette.haze.b * k);
        d[o + 3] = 255;
      } else {
        // Absolute additive dither, a couple of levels at most, tinted to the
        // haze. Composited through the haze mask so it never touches the black
        // floor — see `drawHazeGrain`.
        // Normalise against the palette's strongest channel, not red: the
        // cool haze is blue-dominant, and scaling by red would put several
        // times the intended grain into its brightest channel.
        const peak = Math.max(palette.haze.r, palette.haze.g, palette.haze.b, 1);
        const k = (n * GRAIN_LEVELS) / peak;
        d[o] = Math.round(palette.haze.r * k);
        d[o + 1] = Math.round(palette.haze.g * k);
        d[o + 2] = Math.round(palette.haze.b * k);
        d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const pattern = ctx.createPattern(c, "repeat");
    if (!pattern) throw new Error("pattern creation failed");
    return pattern;
  };

  const tiles: Tiles = {
    colour: make(0x51a7, "colour"),
    additive: make(0x9c3f, "additive"),
  };
  tileCache.set(key, tiles);
  return tiles;
};

/**
 * Peak of the additive dither, in 8-bit levels — about 1.5% of full scale.
 * This is the part that actually breaks banding: a *proportional* grain
 * vanishes exactly where the gradient is faintest and contours worst.
 */
const GRAIN_LEVELS = 4;

/** Multiplicative colour jitter, which carries the texture at the bright end. */
const GRAIN_COLOUR = 0.09;

/**
 * How hard the mask saturates. High enough that the dither reaches full
 * strength across the body of the haze, low enough that it tapers out with the
 * haze's own falloff rather than ending on an edge.
 */
const MASK_GAIN = 12;

export const drawHaze = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  loopFrames: number,
  palette: Palette,
  intensity: number,
  paletteKey: string,
): void => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, width, height);

  const phase = frame / loopFrames;

  for (const m of MASSES) {
    const cx = (m.x + m.ax * Math.sin(TAU * (m.kx * phase + m.px))) * width;
    const cy = (m.y + m.ay * Math.sin(TAU * (m.ky * phase + m.py))) * height;
    const r = m.r * width;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const [pos, a] of STOPS) {
      grad.addColorStop(pos, cssRgb(palette.haze, a * m.alpha * intensity));
    }
    ctx.fillStyle = grad;
    // Only the disc the gradient actually covers — filling the whole frame per
    // mass costs several megapixels of overdraw at 4K for nothing.
    const x0 = Math.max(0, Math.floor(cx - r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const x1 = Math.min(width, Math.ceil(cx + r));
    const y1 = Math.min(height, Math.ceil(cy + r));
    if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  const tiles = buildTiles(ctx, palette, paletteKey);

  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = GRAIN_COLOUR;
  ctx.fillStyle = tiles.colour;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
};

/**
 * The additive dither layer, drawn into its own buffer.
 *
 * The mask is laid down first and the noise is then poured through it with
 * `source-in`, so the layer carries alpha only where the haze does. Added to
 * the frame with `lighter`, it perturbs the haze by a couple of levels and
 * leaves everything outside it at a hard zero.
 */
export const drawHazeGrain = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  loopFrames: number,
  palette: Palette,
  intensity: number,
  paletteKey: string,
): void => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, width, height);

  const phase = frame / loopFrames;

  for (const m of MASSES) {
    const cx = (m.x + m.ax * Math.sin(TAU * (m.kx * phase + m.px))) * width;
    const cy = (m.y + m.ay * Math.sin(TAU * (m.ky * phase + m.py))) * height;
    const r = m.r * width;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const [pos, a] of STOPS) {
      const alpha = Math.min(1, a * m.alpha * intensity * MASK_GAIN);
      grad.addColorStop(pos, `rgba(255,255,255,${alpha})`);
    }
    ctx.fillStyle = grad;
    const x0 = Math.max(0, Math.floor(cx - r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const x1 = Math.min(width, Math.ceil(cx + r));
    const y1 = Math.min(height, Math.ceil(cy + r));
    if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  // Shift the tile each frame so the grain crawls the way film grain does.
  // Both multipliers are integers, so the offsets return to their frame-0
  // values at the end of the loop.
  const ox = Math.floor(GRAIN_TILE * (((frame * 137) / loopFrames) % 1));
  const oy = Math.floor(GRAIN_TILE * (((frame * 211) / loopFrames) % 1));

  const tiles = buildTiles(ctx, palette, paletteKey);
  ctx.globalCompositeOperation = "source-in";
  ctx.save();
  ctx.translate(-ox, -oy);
  ctx.fillStyle = tiles.additive;
  ctx.fillRect(ox, oy, width, height);
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
};
