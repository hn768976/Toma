import React, { useMemo } from "react";
import { bloomPass } from "./bloomPass";
import { withAlpha } from "./color";
import {
  buildFilaments,
  evaluateFilament,
  Filament,
  filamentHalfWidths,
  pulseIndex,
} from "./filaments";
import { fillTaperedPath } from "./taperedStroke";
import { useCanvas } from "./useCanvas";

/**
 * <RadiantBurst> — a dense field of fine, sinuous filaments radiating
 * from (or converging on) a point.
 *
 * The direction is a SIGNED value, not an assumption baked into the
 * geometry: `direction: 1` throws filaments outward from the origin,
 * `direction: -1` starts them at the frame's edges and runs them inward.
 * Taper, brightness falloff and the travelling pulses all follow from it,
 * so a converging field is a genuine branch rather than an outward one
 * played backwards. See `filaments.ts` for how that works.
 *
 * Three passes, composited with 'lighter':
 *   1. a wide, very low-alpha soft glow, ~40px of blur
 *   2. a mid channel at the palette's main hue, ~12px of blur
 *   3. a thin bright core, no blur
 *
 * The two blurred passes are drawn into reduced-resolution buffers and
 * blurred there before being scaled up. A 40px blur applied to eight
 * megapixels, several hundred times a frame, is the single most
 * expensive thing a 4K composition can do; a 13px blur on a third-size
 * buffer looks the same and costs about a ninth as much.
 *
 * Deterministic: geometry is generated once from `seed`, and every frame
 * is a pure function of `frame`. Undulation frequencies are integer
 * cycles per loop and pulse periods must divide `loopLength`, so frame 0
 * and frame `loopLength` are identical.
 */

const GLOW_DIV = 3;
const MID_DIV = 2;
/** Blur radii, expressed in output pixels. */
const GLOW_BLUR = 40;
const MID_BLUR = 12;

export type RadiantBurstColors = {
  /** The hottest tone, at the origin. */
  core: string;
  /** Between the core and the main hue. */
  inner: string;
  /** The field's main hue — the mid rendering channel. */
  mid: string;
  /** The outer reaches. */
  outer: string;
};

export type RadiantBurstProps = {
  width: number;
  height: number;
  originX: number;
  originY: number;
  frame: number;
  loopLength: number;
  seed: string;
  colors: RadiantBurstColors;
  /** +1 radiates away from the origin, -1 converges on it. */
  direction: 1 | -1;
  /** Filament count before branches are added. */
  count: number;
  /** Half-width of a filament at the origin, in canvas pixels. */
  filamentWidth: number;
  /** Global multiplier on filament opacity. */
  opacity?: number;
  /** Reach as a fraction of the distance from the origin to the frame edge. */
  reach?: { min: number; max: number };
  /**
   * Weight of a ray at angular distance `phi` (0..PI) from straight up.
   * Memoise this: a new function identity rebuilds the whole field.
   */
  angularWeight: (phi: number) => number;
  branchProbability?: number;
  /** Pulse periods in frames. Each MUST divide `loopLength` exactly. */
  pulsePeriods?: readonly number[];
  undulation?: { primary: [number, number]; secondary: [number, number] };
  bloom?: { radius: number; strength: number };
  /** Ambient offset applied to the whole field, e.g. a camera drift. */
  offset?: { x: number; y: number };
  style?: React.CSSProperties;
  className?: string;
};

type Buffers = {
  glow: HTMLCanvasElement;
  glowBlur: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  midBlur: HTMLCanvasElement;
  bloom: HTMLCanvasElement;
  xs: Float64Array;
  ys: Float64Array;
  hw: Float64Array;
};

const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

const makeBuffers = (
  width: number,
  height: number,
  vertexCount: number,
): Buffers => ({
  glow: makeCanvas(
    Math.round(width / GLOW_DIV),
    Math.round(height / GLOW_DIV),
  ),
  glowBlur: makeCanvas(
    Math.round(width / GLOW_DIV),
    Math.round(height / GLOW_DIV),
  ),
  mid: makeCanvas(Math.round(width / MID_DIV), Math.round(height / MID_DIV)),
  midBlur: makeCanvas(Math.round(width / MID_DIV), Math.round(height / MID_DIV)),
  bloom: makeCanvas(1, 1),
  xs: new Float64Array(vertexCount),
  ys: new Float64Array(vertexCount),
  hw: new Float64Array(vertexCount),
});

/**
 * A radial ramp centred on the origin. Because the falloff is purely a
 * function of distance from the origin, one gradient serves every
 * filament in a pass: near the origin they are bright, at the frame edge
 * they are faint.
 */
const radialRamp = (
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  maxRadius: number,
  stops: readonly (readonly [number, string, number])[],
): CanvasGradient => {
  const g = ctx.createRadialGradient(
    originX,
    originY,
    0,
    originX,
    originY,
    maxRadius,
  );
  for (const [at, color, alpha] of stops) {
    g.addColorStop(at, withAlpha(color, alpha));
  }
  return g;
};

const prepare = (
  target: HTMLCanvasElement,
  div: number,
  offset: { x: number; y: number },
): CanvasRenderingContext2D | null => {
  const ctx = target.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.globalCompositeOperation = "lighter";
  // Draw in full-resolution coordinates whatever the buffer size.
  ctx.setTransform(1 / div, 0, 0, 1 / div, offset.x / div, offset.y / div);
  return ctx;
};

const blitBlurred = (
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  scratch: HTMLCanvasElement,
  width: number,
  height: number,
  div: number,
  blur: number,
): void => {
  const sctx = scratch.getContext("2d");
  if (!sctx) return;
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = "source-over";
  sctx.globalAlpha = 1;
  sctx.clearRect(0, 0, scratch.width, scratch.height);
  sctx.filter = `blur(${(blur / div).toFixed(2)}px)`;
  sctx.drawImage(src, 0, 0);
  sctx.filter = "none";

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1;
  ctx.drawImage(scratch, 0, 0, width, height);
  ctx.restore();
};

const drawPulse = (
  ctx: CanvasRenderingContext2D,
  fil: Filament,
  buffers: Buffers,
  frame: number,
  n: number,
  widthScale: number,
): void => {
  const centre = pulseIndex(fil, frame, n);
  const from = Math.max(0, Math.floor(centre - 3));
  const to = Math.min(n - 1, Math.ceil(centre + 3));
  if (to - from < 2) return;
  const { xs, ys, hw } = buffers;
  // Reshape the local half-widths into a bead: a bell centred on the
  // pulse, so it reads as a bright swelling travelling along the strand.
  for (let i = from; i <= to; i++) {
    const d = (i - centre) / 3;
    const bell = Math.max(0, 1 - d * d);
    hw[i] = hw[i] * widthScale * (0.35 + 1.9 * bell * bell);
  }
  fillTaperedPath(ctx, xs, ys, hw, to + 1, from);
};

export const RadiantBurst: React.FC<RadiantBurstProps> = ({
  width,
  height,
  originX,
  originY,
  frame,
  loopLength,
  seed,
  colors,
  direction,
  count,
  filamentWidth,
  opacity = 1,
  reach = { min: 0.34, max: 1.06 },
  angularWeight,
  branchProbability,
  pulsePeriods,
  undulation,
  bloom = { radius: 120, strength: 0.32 },
  offset = { x: 0, y: 0 },
  style,
  className,
}) => {
  const filaments = useMemo(
    () =>
      buildFilaments({
        width,
        height,
        originX,
        originY,
        direction,
        count,
        reach,
        angularWeight,
        branchProbability,
        pulsePeriods,
        undulation,
        seed,
      }),
    [
      width,
      height,
      originX,
      originY,
      direction,
      count,
      reach,
      angularWeight,
      branchProbability,
      pulsePeriods,
      undulation,
      seed,
    ],
  );
  const buffers = useMemo(
    () => makeBuffers(width, height, filaments[0]?.r.length ?? 33),
    [width, height, filaments],
  );
  const maxRadius = useMemo(
    () =>
      Math.max(
        Math.hypot(originX, originY),
        Math.hypot(width - originX, originY),
        Math.hypot(originX, height - originY),
        Math.hypot(width - originX, height - originY),
      ),
    [width, height, originX, originY],
  );

  const ref = useCanvas(width, height, (ctx) => {
    const n = filaments[0]?.r.length ?? 33;
    const { xs, ys, hw } = buffers;

    const glowCtx = prepare(buffers.glow, GLOW_DIV, offset);
    const midCtx = prepare(buffers.mid, MID_DIV, offset);
    if (!glowCtx || !midCtx) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(offset.x, offset.y);

    // Each ramp dips at r = 0. Several hundred filaments all pass through
    // the origin, so holding them at full strength there piles up into a
    // flat white disc that hides both the palette and whatever glow sits
    // behind the field.
    glowCtx.fillStyle = radialRamp(glowCtx, originX, originY, maxRadius, [
      [0, colors.inner, 0.5],
      [0.07, colors.inner, 0.95],
      [0.22, colors.mid, 0.8],
      [0.58, colors.outer, 0.45],
      [1, colors.outer, 0.09],
    ]);
    midCtx.fillStyle = radialRamp(midCtx, originX, originY, maxRadius, [
      [0, colors.core, 0.42],
      [0.06, colors.core, 0.9],
      [0.14, colors.inner, 0.92],
      [0.42, colors.mid, 0.6],
      [0.74, colors.outer, 0.28],
      [1, colors.outer, 0.05],
    ]);
    const coreRamp = radialRamp(ctx, originX, originY, maxRadius, [
      [0, colors.core, 0.38],
      [0.05, colors.core, 0.85],
      [0.18, colors.core, 0.7],
      [0.46, colors.inner, 0.38],
      [0.76, colors.mid, 0.15],
      [1, colors.mid, 0.03],
    ]);
    const pulseColor = withAlpha(colors.core, 1);

    for (const fil of filaments) {
      evaluateFilament(fil, frame, loopLength, originX, originY, xs, ys);
      const a = fil.alphaScale * opacity;

      // 1 — wide soft glow
      filamentHalfWidths(fil, filamentWidth, 3.6, hw);
      for (let i = 0; i < n; i++) hw[i] += 3;
      glowCtx.globalAlpha = Math.min(1, 0.13 * a);
      fillTaperedPath(glowCtx, xs, ys, hw, n);

      // 2 — mid channel at the palette's main hue
      filamentHalfWidths(fil, filamentWidth, 1.3, hw);
      midCtx.globalAlpha = Math.min(1, 0.25 * a);
      fillTaperedPath(midCtx, xs, ys, hw, n);

      // 3 — thin bright core, unblurred
      filamentHalfWidths(fil, filamentWidth, 0.42, hw);
      ctx.fillStyle = coreRamp;
      ctx.globalAlpha = Math.min(1, 0.36 * a);
      fillTaperedPath(ctx, xs, ys, hw, n);

      // The travelling brightness pulse rides on the core pass, plus a
      // softer copy in the mid buffer so it carries a halo with it.
      const pulseAlpha = Math.min(1, 0.5 * a * fil.pulseStrength);
      ctx.globalAlpha = pulseAlpha;
      ctx.fillStyle = pulseColor;
      drawPulse(ctx, fil, buffers, frame, n, 1);
      filamentHalfWidths(fil, filamentWidth, 1.3, hw);
      midCtx.globalAlpha = pulseAlpha * 0.7;
      drawPulse(midCtx, fil, buffers, frame, n, 1.15);
    }

    ctx.restore();

    blitBlurred(
      ctx,
      buffers.glow,
      buffers.glowBlur,
      width,
      height,
      GLOW_DIV,
      GLOW_BLUR,
    );
    blitBlurred(
      ctx,
      buffers.mid,
      buffers.midBlur,
      width,
      height,
      MID_DIV,
      MID_BLUR,
    );

    bloomPass(ctx, ctx.canvas, {
      width,
      height,
      radius: bloom.radius,
      strength: bloom.strength,
      downscale: 5,
      scratch: buffers.bloom,
    });
  });

  return <canvas ref={ref} style={style} className={className} />;
};
