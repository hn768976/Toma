import { rnd, rndInt } from "../random/seeded";

// The finishing passes that sit over a completed frame: scanlines, vignette
// and grain. All three are palette-agnostic — colours arrive as arguments.

/** Faint horizontal scanlines, one `thickness`-px line every `step` px. */
export const scanlinePass = (
  ctx: CanvasRenderingContext2D,
  o: {
    width: number;
    height: number;
    step?: number;
    thickness?: number;
    color?: string;
    alpha?: number;
  },
) => {
  const { width, height, step = 5, thickness = 1, color = "0, 0, 0", alpha = 0.03 } = o;
  ctx.fillStyle = `rgba(${color}, ${alpha})`;
  for (let y = 0; y < height; y += step) ctx.fillRect(0, y, width, thickness);
};

/**
 * Radial vignette, built from explicit [offset, alpha] stops so a particular
 * falloff can be reproduced exactly rather than approximated from a single
 * "strength" number. `radiusFactor` is the gradient radius as a fraction of
 * the width.
 */
export const vignettePass = (
  ctx: CanvasRenderingContext2D,
  o: {
    width: number;
    height: number;
    color?: string;
    stops?: [number, number][];
    radiusFactor?: number;
  },
) => {
  const {
    width,
    height,
    color = "2, 6, 10",
    stops = [
      [0, 0],
      [0.55, 0.04],
      [0.82, 0.2],
      [1, 0.46],
    ],
    radiusFactor = 0.62,
  } = o;
  const cx = width / 2;
  const cy = height / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * radiusFactor);
  for (const [offset, alpha] of stops) g.addColorStop(offset, `rgba(${color}, ${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
};

/**
 * Pre-rolls `count` square noise tiles.
 *
 * Full-frame per-frame noise is not affordable at 4K — 8.3 million seeded
 * random numbers a frame would dominate the render — so grain is a small tile
 * filled as a repeating pattern instead. Build these once in useMemo.
 */
export const makeGrainTiles = (
  count: number,
  size: number,
  seed = "grain",
): (HTMLCanvasElement | null)[] => {
  if (typeof document === "undefined") return Array.from({ length: count }, () => null);
  return Array.from({ length: count }, (_, t) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < size * size; i++) {
      const v = Math.round(rnd(`${seed}-${t}-${i}`) * 255);
      d[i * 4] = v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  });
};

/**
 * Lays one grain tile over the frame as a repeating pattern, choosing the tile
 * and its offset from the frame number — so the grain moves every frame but
 * stays a pure function of the frame, and repeats exactly on the loop.
 */
export const grainPass = (
  ctx: CanvasRenderingContext2D,
  o: {
    width: number;
    height: number;
    tiles: (HTMLCanvasElement | null)[];
    /** Frame, already wrapped into the loop. */
    frame: number;
    alpha?: number;
    seed?: string;
    composite?: GlobalCompositeOperation;
  },
) => {
  const { width, height, tiles, frame, alpha = 0.04, seed = "grain", composite = "overlay" } = o;
  const tile = tiles[frame % tiles.length];
  if (!tile) return;
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  const ox = rndInt(`${seed}-ox-${frame}`, 0, tile.width - 1);
  const oy = rndInt(`${seed}-oy-${frame}`, 0, tile.height - 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = composite;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width + tile.width, height + tile.height);
  ctx.restore();
};
