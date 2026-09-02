import React, { useMemo } from "react";
import { bloomPass } from "../lib/bloomPass";
import { withAlpha } from "../lib/color";
import { fillTaperedPath } from "../lib/taperedStroke";
import { useCanvas } from "../lib/useCanvas";
import {
  buildFilaments,
  evaluateFilament,
  Filament,
  filamentHalfWidths,
  pulseIndex,
} from "./filaments";
import { layerStyle } from "./layers";
import { cameraDrift, Layout } from "./layout";
import { VariantConfig } from "./variants";

/**
 * The dense field of fine filaments radiating from (or converging on) a
 * point directly behind the figure's head.
 *
 * Three passes, composited with 'lighter':
 *   1. a wide, very low-alpha soft glow, ~40px of blur
 *   2. a mid channel at the palette's main hue, ~12px of blur
 *   3. a thin bright core, no blur
 *
 * The two blurred passes are drawn into reduced-resolution buffers and
 * blurred there before being scaled up. A 40px blur applied to eight
 * megapixels, several hundred times a frame, is the single most
 * expensive thing this piece could do; a 13px blur on a third-size
 * buffer is visually the same and costs about a ninth as much.
 */

const GLOW_DIV = 3;
const MID_DIV = 2;
/** Blur radii, expressed in output pixels. */
const GLOW_BLUR = 40;
const MID_BLUR = 12;

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

const makeBuffers = (layout: Layout, vertexCount: number): Buffers => ({
  glow: makeCanvas(
    Math.round(layout.width / GLOW_DIV),
    Math.round(layout.height / GLOW_DIV),
  ),
  glowBlur: makeCanvas(
    Math.round(layout.width / GLOW_DIV),
    Math.round(layout.height / GLOW_DIV),
  ),
  mid: makeCanvas(
    Math.round(layout.width / MID_DIV),
    Math.round(layout.height / MID_DIV),
  ),
  midBlur: makeCanvas(
    Math.round(layout.width / MID_DIV),
    Math.round(layout.height / MID_DIV),
  ),
  bloom: makeCanvas(1, 1),
  xs: new Float64Array(vertexCount),
  ys: new Float64Array(vertexCount),
  hw: new Float64Array(vertexCount),
});

/**
 * A radial ramp centred on the burst origin. Because the falloff is
 * purely a function of distance from the origin, one gradient serves
 * every filament in a pass: near the origin they are bright, at the
 * frame edge they are faint.
 */
const radialRamp = (
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  stops: readonly (readonly [number, string, number])[],
): CanvasGradient => {
  const g = ctx.createRadialGradient(
    layout.originX,
    layout.originY,
    0,
    layout.originX,
    layout.originY,
    layout.maxRadius,
  );
  for (const [at, color, alpha] of stops) {
    g.addColorStop(at, withAlpha(color, alpha));
  }
  return g;
};

const prepare = (
  target: HTMLCanvasElement,
  div: number,
  drift: { x: number; y: number },
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
  ctx.setTransform(1 / div, 0, 0, 1 / div, drift.x / div, drift.y / div);
  return ctx;
};

const blitBlurred = (
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  scratch: HTMLCanvasElement,
  layout: Layout,
  div: number,
  blur: number,
  alpha: number,
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
  ctx.globalAlpha = alpha;
  ctx.drawImage(scratch, 0, 0, layout.width, layout.height);
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
  // pulse so it reads as a bright swelling travelling along the strand.
  for (let i = from; i <= to; i++) {
    const d = (i - centre) / 3;
    const bell = Math.max(0, 1 - d * d);
    hw[i] = hw[i] * widthScale * (0.35 + 1.9 * bell * bell);
  }
  fillTaperedPath(ctx, xs, ys, hw, to + 1, from);
};

export const RadiantBurst: React.FC<{
  config: VariantConfig;
  layout: Layout;
  frame: number;
  seed: string;
}> = ({ config, layout, frame, seed }) => {
  const filaments = useMemo(
    () => buildFilaments(config, layout, seed),
    [config, layout, seed],
  );
  const buffers = useMemo(
    () => makeBuffers(layout, filaments[0]?.r.length ?? 33),
    [layout, filaments],
  );

  const ref = useCanvas(layout.width, layout.height, (ctx) => {
    const p = config.palette;
    const drift = cameraDrift(frame);
    const opacity = config.filamentOpacity;
    const n = filaments[0]?.r.length ?? 33;
    const { xs, ys, hw } = buffers;

    const glowCtx = prepare(buffers.glow, GLOW_DIV, drift);
    const midCtx = prepare(buffers.mid, MID_DIV, drift);
    if (!glowCtx || !midCtx) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(drift.x, drift.y);

    // Each ramp dips at r = 0. Several hundred filaments all pass
    // through the origin, so holding them at full strength there piles
    // up into a flat white disc that hides both the palette and the
    // core glow's own gradient. Relieving the innermost few per cent
    // costs nothing visually — the core glow already owns that area.
    glowCtx.fillStyle = radialRamp(glowCtx, layout, [
      [0, p.coreMid, 0.5],
      [0.07, p.coreMid, 0.95],
      [0.22, p.filamentMid, 0.8],
      [0.58, p.filamentDeep, 0.45],
      [1, p.filamentDeep, 0.09],
    ]);
    midCtx.fillStyle = radialRamp(midCtx, layout, [
      [0, p.coreWhite, 0.42],
      [0.06, p.coreWhite, 0.9],
      [0.14, p.coreMid, 0.92],
      [0.42, p.filamentMid, 0.6],
      [0.74, p.filamentDeep, 0.28],
      [1, p.filamentDeep, 0.05],
    ]);
    const coreRamp = radialRamp(ctx, layout, [
      [0, p.coreWhite, 0.38],
      [0.05, p.coreWhite, 0.85],
      [0.18, p.coreWhite, 0.7],
      [0.46, p.coreMid, 0.38],
      [0.76, p.filamentMid, 0.15],
      [1, p.filamentMid, 0.03],
    ]);

    for (const fil of filaments) {
      evaluateFilament(fil, frame, layout.originX, layout.originY, xs, ys);
      const a = fil.alphaScale * opacity;

      // 1 — wide soft glow
      filamentHalfWidths(fil, config.filamentWidth, 3.6, hw);
      for (let i = 0; i < n; i++) hw[i] += 3;
      glowCtx.globalAlpha = Math.min(1, 0.13 * a);
      fillTaperedPath(glowCtx, xs, ys, hw, n);

      // 2 — mid channel at the palette's main hue
      filamentHalfWidths(fil, config.filamentWidth, 1.3, hw);
      midCtx.globalAlpha = Math.min(1, 0.25 * a);
      fillTaperedPath(midCtx, xs, ys, hw, n);

      // 3 — thin bright core, unblurred
      filamentHalfWidths(fil, config.filamentWidth, 0.42, hw);
      ctx.fillStyle = coreRamp;
      ctx.globalAlpha = Math.min(1, 0.36 * a);
      fillTaperedPath(ctx, xs, ys, hw, n);

      // The travelling brightness pulse rides on the core pass, plus a
      // softer copy in the mid buffer so it carries a halo with it.
      const pulseAlpha = Math.min(1, 0.5 * a * fil.pulseStrength);
      ctx.globalAlpha = pulseAlpha;
      ctx.fillStyle = withAlpha(p.coreWhite, 1);
      drawPulse(ctx, fil, buffers, frame, n, 1);
      filamentHalfWidths(fil, config.filamentWidth, 1.3, hw);
      midCtx.globalAlpha = pulseAlpha * 0.7;
      drawPulse(midCtx, fil, buffers, frame, n, 1.15);
    }

    ctx.restore();

    blitBlurred(
      ctx,
      buffers.glow,
      buffers.glowBlur,
      layout,
      GLOW_DIV,
      GLOW_BLUR,
      1,
    );
    blitBlurred(
      ctx,
      buffers.mid,
      buffers.midBlur,
      layout,
      MID_DIV,
      MID_BLUR,
      1,
    );

    // Generous bloom over the brightest filaments and the core.
    bloomPass(ctx, ctx.canvas, {
      width: layout.width,
      height: layout.height,
      radius: 120,
      strength: 0.32,
      downscale: 5,
      scratch: buffers.bloom,
    });
  });

  return <canvas ref={ref} style={layerStyle("screen")} />;
};
