/**
 * Screen-space finishing passes: bloom, vignette, scanlines, film grain.
 *
 * Each pass takes an already-assembled context and mutates it in place, in
 * screen space, and restores whatever it changed. Colours and strengths are
 * parameters. Apply them in the order they are declared here — grain over
 * scanlines over vignette over bloom.
 *
 * @module postFx
 */
import { makeCanvas } from "./dofBuffers";
import { withAlpha } from "./color";

/**
 * Additive bloom from a separate accumulator canvas.
 *
 * The accumulator holds ONLY what should glow — write your bright elements
 * into it as you draw them. Thresholding the finished frame instead makes
 * everything pale bloom, which is the look of a mistake.
 *
 * Two passes: a tight one for the core, a wide one for the halo.
 */
export const bloomPass = (
  ctx: CanvasRenderingContext2D,
  glow: HTMLCanvasElement,
  opts: {
    width: number;
    height: number;
    /** [radius, alpha] per pass, in output-space pixels. */
    passes?: [number, number][];
  },
) => {
  const passes = opts.passes ?? [
    [34, 0.55],
    [96, 0.3],
  ];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  for (const [radius, alpha] of passes) {
    ctx.filter = `blur(${radius}px)`;
    ctx.globalAlpha = alpha;
    ctx.drawImage(glow, 0, 0, opts.width, opts.height);
  }
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.restore();
};

/** A soft corner darkening. `strength` is the alpha reached at the corners. */
export const vignettePass = (
  ctx: CanvasRenderingContext2D,
  opts: {
    width: number;
    height: number;
    color: string;
    strength?: number;
    /**
     * Alpha at the 62% stop. Defaults to two fifths of `strength`, but note
     * that `strength * 0.4` and the same figure written as a literal are
     * different doubles, and canvas quantises alpha to 8 bits — so pass this
     * explicitly if you need a build to be bit-reproducible against another.
     */
    mid?: number;
    /** Radii as fractions of height: where it starts and where it maxes. */
    inner?: number;
    outer?: number;
  },
) => {
  const { width, height, color } = opts;
  const strength = opts.strength ?? 0.2;
  const mid = opts.mid ?? strength * 0.4;
  const inner = opts.inner ?? 0.34;
  const outer = opts.outer ?? 0.94;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * inner,
    width / 2,
    height / 2,
    height * outer,
  );
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(0.62, withAlpha(color, mid));
  g.addColorStop(1, withAlpha(color, strength));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

/**
 * A scanline tile: one bright row every `period` pixels. Build it once and
 * hand it to `scanlinePass` — it is frame-independent.
 */
export const makeScanlineTile = (period = 5, alpha = 0.03, thickness = 1) => {
  const c = makeCanvas(4, period);
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(0, 0, 4, thickness);
  }
  return c;
};

export const scanlinePass = (
  ctx: CanvasRenderingContext2D,
  tile: HTMLCanvasElement,
  opts: { width: number; height: number },
) => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pattern = ctx.createPattern(tile, "repeat");
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, opts.width, opts.height);
  }
  ctx.restore();
};

/**
 * Pre-baked noise tiles for `grainPass`.
 *
 * Filling millions of pixels of noise in JS every frame is not affordable at
 * 4K, and a handful of tiles cycled with a per-frame offset is visually
 * indistinguishable from it. The hash is deterministic in (tile, pixel) so
 * every render worker produces the same tiles.
 */
export const makeGrainTiles = (count = 6, size = 512) => {
  const tiles: HTMLCanvasElement[] = [];
  for (let i = 0; i < count; i++) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext("2d");
    if (ctx) {
      const img = ctx.createImageData(size, size);
      let s = (i + 1) * 0x9e3779b9;
      for (let px = 0; px < size * size; px++) {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        const v = ((t ^ (t >>> 14)) >>> 0) % 256;
        const o = px * 4;
        img.data[o] = v;
        img.data[o + 1] = v;
        img.data[o + 2] = v;
        img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    tiles.push(c);
  }
  return tiles;
};

/**
 * Film grain. `offsetX`/`offsetY` should be derived from the frame so the
 * grain moves; cycle `tile` through `makeGrainTiles` output the same way.
 * Choose tile count and offsets that repeat over your loop length or the
 * seam will show.
 */
export const grainPass = (
  ctx: CanvasRenderingContext2D,
  tile: HTMLCanvasElement,
  opts: {
    width: number;
    height: number;
    alpha?: number;
    offsetX?: number;
    offsetY?: number;
    mode?: GlobalCompositeOperation;
  },
) => {
  const { width, height } = opts;
  const alpha = opts.alpha ?? 0.04;
  const ox = opts.offsetX ?? 0;
  const oy = opts.offsetY ?? 0;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pattern = ctx.createPattern(tile, "repeat");
  if (pattern) {
    ctx.globalCompositeOperation = opts.mode ?? "overlay";
    ctx.globalAlpha = alpha;
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width + tile.width, height + tile.height);
  }
  ctx.restore();
};
