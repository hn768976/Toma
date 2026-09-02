import { rand } from "./random";

/**
 * Canvas post-processing passes: bloom, vignette and grain. All are
 * palette-agnostic (colours are parameters) and deterministic.
 */

/**
 * Additive bloom over the whole of a layer canvas.
 *
 * Intended for a layer that holds only the emissive content on transparency —
 * the layer's own alpha then acts as the brightness threshold, so no
 * per-pixel extraction is needed. The blur runs on a downscaled scratch
 * buffer, which is both far cheaper than blurring at 4K and smoother.
 *
 * Pass several `layers` to stack a tight core glow under a wide soft halo.
 */
export const bloomPass = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  {
    downscale = 4,
    layers,
    scratch,
  }: {
    downscale?: number;
    /** blurPx is expressed in full-resolution pixels. */
    layers: readonly { blurPx: number; alpha: number }[];
    /** Reusable scratch canvas, so frames don't each allocate one. */
    scratch: HTMLCanvasElement;
  },
) => {
  const sw = Math.max(1, Math.round(canvas.width / downscale));
  const sh = Math.max(1, Math.round(canvas.height / downscale));
  if (scratch.width !== sw || scratch.height !== sh) {
    scratch.width = sw;
    scratch.height = sh;
  }
  const sctx = scratch.getContext("2d");
  if (!sctx) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const layer of layers) {
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, sw, sh);
    sctx.filter = `blur(${Math.max(0.1, layer.blurPx / downscale)}px)`;
    sctx.drawImage(canvas, 0, 0, sw, sh);
    sctx.filter = "none";
    ctx.globalAlpha = layer.alpha;
    ctx.drawImage(scratch, 0, 0, canvas.width, canvas.height);
  }
  ctx.restore();
};

/**
 * Darkens the frame toward its corners. `strength` is the peak opacity of the
 * ink at the very edge; 0.22 is a restrained cinematic vignette.
 */
export const vignettePass = (
  ctx: CanvasRenderingContext2D,
  {
    width,
    height,
    color,
    strength,
    /** Fraction of the radius at which darkening begins. */
    innerStop = 0.45,
  }: {
    width: number;
    height: number;
    color: string;
    strength: number;
    innerStop?: number;
  },
) => {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.hypot(cx, cy);
  const gradient = ctx.createRadialGradient(cx, cy, radius * innerStop, cx, cy, radius);
  gradient.addColorStop(0, withAlpha(color, 0));
  gradient.addColorStop(0.65, withAlpha(color, strength * 0.35));
  gradient.addColorStop(1, withAlpha(color, strength));
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

/**
 * Builds a set of pre-rendered noise tiles. Generating full-frame noise every
 * frame is prohibitive at 4K; a handful of tiles cycled and offset per frame
 * is indistinguishable at the alphas grain is actually used at.
 */
export const buildGrainTiles = ({
  size,
  count,
  light,
  dark,
  seed,
}: {
  size: number;
  count: number;
  light: string;
  dark: string;
  seed: string;
}): HTMLCanvasElement[] => {
  const lightRgb = hexToRgb(light);
  const darkRgb = hexToRgb(dark);
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < count; t++) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    const image = ctx.createImageData(size, size);
    const data = image.data;
    for (let i = 0; i < size * size; i++) {
      const v = rand(`${seed}:${t}:${i}`);
      const light1 = v > 0.5;
      const rgb = light1 ? lightRgb : darkRgb;
      data[i * 4] = rgb.r;
      data[i * 4 + 1] = rgb.g;
      data[i * 4 + 2] = rgb.b;
      // Triangular-ish alpha: most speckles are faint, a few carry.
      data[i * 4 + 3] = Math.round(Math.abs(v * 2 - 1) * 255);
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};

/** Tiles one grain frame across the canvas, offset so the tiling never reads. */
export const grainPass = (
  ctx: CanvasRenderingContext2D,
  {
    width,
    height,
    tiles,
    frame,
    alpha,
    seed,
  }: {
    width: number;
    height: number;
    tiles: readonly HTMLCanvasElement[];
    frame: number;
    alpha: number;
    seed: string;
  },
) => {
  if (tiles.length === 0) return;
  const tile = tiles[frame % tiles.length];
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  const ox = Math.floor(rand(`${seed}:ox:${frame}`) * tile.width);
  const oy = Math.floor(rand(`${seed}:oy:${frame}`) * tile.height);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width + tile.width, height + tile.height);
  ctx.restore();
};

/** #rrggbb -> {r,g,b}. */
export const hexToRgb = (hex: string) => {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
};

/** #rrggbb + alpha -> a canvas-ready rgba() string. */
export const withAlpha = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
};

/** Linearly blends two hex colours and returns an rgba() string. */
export const mixColors = (a: string, b: string, t: number, alpha = 1): string => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const f = Math.max(0, Math.min(1, t));
  return `rgba(${Math.round(ca.r + (cb.r - ca.r) * f)}, ${Math.round(
    ca.g + (cb.g - ca.g) * f,
  )}, ${Math.round(ca.b + (cb.b - ca.b) * f)}, ${Math.max(0, Math.min(1, alpha))})`;
};
