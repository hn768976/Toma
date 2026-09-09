import {
  HORIZON_GAP,
  LONGITUDINAL_COUNT,
  Z_EXIT,
  Z_FAR,
  Z_FULL,
  clamp,
  horizonOffset,
  longitudinalSlope,
  rayExtent,
  smoothstep,
  transverseDepths,
} from "./geometry";
import { drawGrain } from "./grain";
import { css, Palette, rampAt } from "./palettes";

/**
 * Every length here is a fraction of frame height, so the 1080p previews and the
 * 4K master are pixel-proportional. The canvas backing store is always the
 * composition's full 3840x2160 — `--scale` only changes how the browser samples
 * it — which means a preview render is a supersampled 4K frame, and the glow
 * cannot drift between preview and master.
 */
const TRANSVERSE_WIDTH_NEAR = 0.0055; // width at the frame edge (z = Z_EXIT)
const LONGITUDINAL_WIDTH_EDGE = 0.0105; // width at u = H/2
const CENTRE_WIDTH_BOOST = 1.35;
const CENTRE_BRIGHTNESS_BOOST = 1.6;

/**
 * Below this on-screen width a stroke can no longer be drawn honestly. Holding
 * the width and scaling alpha by the shortfall keeps the line's total energy
 * right and stops it from flickering on and off between frames — a shimmering
 * hairline is far worse on a 4K black field than a faint steady one.
 */
const MIN_LINE_PX = 1.2;

const BLOOM_PASSES = [
  { downscale: 2, blur: 0.0035, alpha: 0.38 },
  { downscale: 4, blur: 0.011, alpha: 0.3 },
  { downscale: 8, blur: 0.032, alpha: 0.26 },
] as const;

const HAZE_ALPHA = 0.03;
const GRAIN_AMOUNT = 0.022;

type Scratch = {
  plane: HTMLCanvasElement;
  grid: HTMLCanvasElement;
  bloom: HTMLCanvasElement[];
};

/**
 * Scratch canvases are reused across frames. Allocating three 4K canvases per
 * frame is the difference between a render that finishes and one that does not.
 */
const scratchCache = new Map<string, Scratch>();

const getScratch = (width: number, height: number): Scratch => {
  const key = `${width}x${height}`;
  const hit = scratchCache.get(key);
  if (hit) return hit;
  const make = (w: number, h: number) => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };
  const made: Scratch = {
    plane: make(width, height),
    grid: make(width, height),
    bloom: BLOOM_PASSES.map((p) => make(width / p.downscale, height / p.downscale)),
  };
  scratchCache.set(key, made);
  return made;
};

const clear = (c: HTMLCanvasElement) => {
  const ctx = c.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, c.width, c.height);
  return ctx;
};

/**
 * Draw the floor plane into the lower half of a full-frame canvas. The ceiling
 * is this same bitmap flipped, so this runs once per frame, not twice.
 */
const drawFloor = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  palette: Palette,
  pulse: number,
) => {
  const cx = width / 2;
  const cy = height / 2;
  const halfH = height / 2;
  const gapPx = HORIZON_GAP * height;

  // Crossings should add, the way two neon tubes would.
  ctx.globalCompositeOperation = "lighter";

  // --- Transverse lines -----------------------------------------------------
  // Constant depth, so constant colour and constant width along the whole span.
  for (const z of transverseDepths(phase)) {
    const u = horizonOffset(z, height);
    const t = clamp(u / halfH, 0, 1);
    const colour = rampAt(palette, t);

    // Width falls as 1/z, exactly like the projected spacing.
    let w = TRANSVERSE_WIDTH_NEAR * height * (Z_EXIT / z);
    // Fade in over the far end of the range instead of popping into existence.
    let alpha = smoothstep(Z_FAR, Z_FULL, z) * pulse;
    if (w < MIN_LINE_PX) {
      alpha *= w / MIN_LINE_PX;
      w = MIN_LINE_PX;
    }
    if (alpha <= 0.002) continue;

    ctx.strokeStyle = css(colour, clamp(alpha, 0, 1));
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(0, cy + u);
    ctx.lineTo(width, cy + u);
    ctx.stroke();
  }

  // --- Longitudinal lines ---------------------------------------------------
  // Fixed geometry: these never move. Each is a triangle with its apex on the
  // vanishing point, because a world-constant width projects to a width that
  // grows linearly with the offset from the horizon.
  for (let k = -LONGITUDINAL_COUNT; k <= LONGITUDINAL_COUNT; k++) {
    const m = longitudinalSlope(k);
    const uMax = rayExtent(m, width, height);
    const isCentre = k === 0;

    const halfWidthAt = (u: number) =>
      (0.5 * LONGITUDINAL_WIDTH_EDGE * height * (u / halfH)) *
      (isCentre ? CENTRE_WIDTH_BOOST : 1);

    // Unit normal to the ray direction (m, 1).
    const len = Math.hypot(m, 1);
    const nx = 1 / len;
    const ny = -m / len;

    const ex = cx + m * uMax;
    const ey = cy + uMax;
    const hw = halfWidthAt(uMax);

    // Below MIN_LINE_PX the wedge is thinner than a pixel near its apex, which
    // canvas cannot draw honestly; the gradient's alpha ramp already takes the
    // line to zero there, so no extra correction is needed at the tip.
    const grad = ctx.createLinearGradient(cx, cy, ex, ey);
    const boost = isCentre ? CENTRE_BRIGHTNESS_BOOST : 1;
    for (let s = 0; s <= 8; s++) {
      const f = s / 8;
      const u = f * uMax;
      const t = clamp(u / halfH, 0, 1);
      // Same horizon fade as the transverse lines, so the dark band reads as one
      // continuous gap rather than two grids stopping at different heights.
      // Start the ramp at the same offset where the transverse lines stop, so the
      // two families clear the horizon together and the dark band reads as one
      // continuous gap instead of a fan converging through it.
      const a = clamp(smoothstep(gapPx * 0.95, gapPx * 1.45, u) * boost * pulse, 0, 1);
      grad.addColorStop(f, css(rampAt(palette, t), a));
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex + hw * nx, ey + hw * ny);
    ctx.lineTo(ex - hw * nx, ey - hw * ny);
    ctx.closePath();
    ctx.fill();
  }
};

export type FrameOptions = {
  frame: number;
  width: number;
  height: number;
  phase: number;
  pulse: number;
  palette: Palette;
};

export const renderFrame = (
  ctx: CanvasRenderingContext2D,
  { frame, width, height, phase, pulse, palette }: FrameOptions,
) => {
  const scratch = getScratch(width, height);
  const cx = width / 2;
  const cy = height / 2;

  const planeCtx = clear(scratch.plane);
  drawFloor(planeCtx, width, height, phase, palette, pulse);

  // Ceiling = floor, mirrored about the horizon. Rendered once, flipped once.
  const gridCtx = clear(scratch.grid);
  gridCtx.drawImage(scratch.plane, 0, 0);
  gridCtx.save();
  gridCtx.globalCompositeOperation = "lighter";
  gridCtx.setTransform(1, 0, 0, -1, 0, height);
  gridCtx.drawImage(scratch.plane, 0, 0);
  gridCtx.restore();

  // --- Composite ------------------------------------------------------------
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = css(palette.background);
  ctx.fillRect(0, 0, width, height);

  // Soft haze, strongest at the vanishing point. Kept faint on purpose: the dark
  // horizon band is title space and lifting it would cost the composition.
  const haze = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 0.7);
  haze.addColorStop(0, css(palette.haze, 1));
  haze.addColorStop(0.3, css(palette.haze, 0.55));
  haze.addColorStop(1, css(palette.haze, 0.12));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = HAZE_ALPHA * pulse;
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Bloom, widest pass first. Blurring a downscaled copy costs a fraction of a
  // full-resolution blur and gives a smoother falloff; radii are divided by the
  // downscale so the glow stays a fixed fraction of frame height.
  for (let i = BLOOM_PASSES.length - 1; i >= 0; i--) {
    const pass = BLOOM_PASSES[i];
    const buf = scratch.bloom[i];
    const bctx = clear(buf);
    bctx.filter = `blur(${(pass.blur * height) / pass.downscale}px)`;
    bctx.drawImage(scratch.grid, 0, 0, buf.width, buf.height);
    bctx.filter = "none";

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = pass.alpha;
    ctx.drawImage(buf, 0, 0, width, height);
    ctx.restore();
  }

  // Crisp cores last, at full strength: the bloom must sit under the lines, not
  // replace them.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1;
  ctx.drawImage(scratch.grid, 0, 0);
  ctx.restore();

  drawGrain(ctx, frame, width, height, GRAIN_AMOUNT);
};
