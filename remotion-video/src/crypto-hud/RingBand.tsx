import { useLayoutEffect, useMemo } from "react";
import { beginWorld, context2d, layerFor, makeCanvas, type Buffers } from "./buffers";
import { shade, withAlpha } from "./color";
import { DURATION, RING_OUTER, SYMBOL_CX, SYMBOL_CY } from "./layout";
import { rndRange } from "./rng";
import type { BandSpec, VariantConfig } from "./variants";

const DEG = Math.PI / 180;

type Props = {
  buffers: Buffers;
  cfg: VariantConfig;
  band: BandSpec;
  frame: number;
  drift: { x: number; y: number };
};

/**
 * Ticks, dashes and blocks scattered along an angular run. Used for both ring
 * modes; `continuous` passes the whole sector, `brokenArcs` passes one arc.
 */
const decorateRun = (
  ctx: CanvasRenderingContext2D,
  cfg: VariantConfig,
  band: BandSpec,
  seed: string,
  a0: number,
  a1: number,
) => {
  const R = band.radius * RING_OUTER;
  const th = band.thickness;
  const span = a1 - a0;

  ctx.lineCap = "butt";

  for (let i = 0; i < band.tickCount; i++) {
    const a = a0 + rndRange(`${seed}-tick-a-${i}`, 0.05, 0.95) * span;
    const inner = R - (th / 2) * rndRange(`${seed}-tick-i-${i}`, 0.45, 1);
    const outer = R + (th / 2) * rndRange(`${seed}-tick-o-${i}`, 0.45, 1);
    ctx.strokeStyle = withAlpha(cfg.palette.ringMain, rndRange(`${seed}-tick-al-${i}`, 0.45, 0.92));
    ctx.lineWidth = rndRange(`${seed}-tick-w-${i}`, 3, 7);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();
  }

  for (let i = 0; i < band.dashCount; i++) {
    const width = Math.min(span * 0.32, rndRange(`${seed}-dash-w-${i}`, 0.01, 0.038));
    const start = a0 + rndRange(`${seed}-dash-a-${i}`, 0.03, 0.93) * (span - width);
    const dashR = R + rndRange(`${seed}-dash-r-${i}`, -0.3, 0.3) * th;
    ctx.strokeStyle = withAlpha(cfg.palette.ringMain, rndRange(`${seed}-dash-al-${i}`, 0.6, 0.95));
    ctx.lineWidth = th * rndRange(`${seed}-dash-t-${i}`, 0.2, 0.4);
    ctx.beginPath();
    ctx.arc(0, 0, dashR, start, start + width);
    ctx.stroke();
  }

  for (let i = 0; i < band.blockCount; i++) {
    const width = Math.min(span * 0.2, rndRange(`${seed}-blk-w-${i}`, 0.005, 0.014));
    const start = a0 + rndRange(`${seed}-blk-a-${i}`, 0.05, 0.9) * (span - width);
    const blockR = R + rndRange(`${seed}-blk-r-${i}`, -0.18, 0.18) * th;
    ctx.strokeStyle = shade(cfg.palette.ringMain, 0.55, 0.96);
    ctx.lineWidth = th * 0.62;
    ctx.beginPath();
    ctx.arc(0, 0, blockR, start, start + width);
    ctx.stroke();
  }
};

const drawSector = (
  ctx: CanvasRenderingContext2D,
  cfg: VariantConfig,
  band: BandSpec,
) => {
  const R = band.radius * RING_OUTER;
  const th = band.thickness;
  const sector = (2 * Math.PI) / band.symmetry;
  const seed = `${cfg.seed}-${band.id}`;

  if (cfg.ringMode === "continuous") {
    // A hair of overlap keeps the repeated sectors seamless.
    ctx.strokeStyle = withAlpha(cfg.palette.ringDim, 0.6);
    ctx.lineWidth = Math.max(2.5, th * 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, R, -0.002, sector + 0.002);
    ctx.stroke();
    decorateRun(ctx, cfg, band, seed, 0, sector);
    return;
  }

  for (const [i, arc] of (band.arcs ?? []).entries()) {
    const a0 = arc.start * DEG;
    const a1 = (arc.start + arc.span) * DEG;

    ctx.strokeStyle = withAlpha(cfg.palette.ringMain, 0.62);
    ctx.lineWidth = th * 0.4;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.arc(0, 0, R, a0, a1);
    ctx.stroke();

    ctx.strokeStyle = withAlpha(cfg.palette.ringDim, 0.55);
    ctx.lineWidth = Math.max(2.5, th * 0.12);
    ctx.beginPath();
    ctx.arc(0, 0, R - th * 0.46, a0, a1);
    ctx.stroke();

    decorateRun(ctx, cfg, band, `${seed}-arc-${i}`, a0, a1);
  }

  if (band.progressArc) {
    const a0 = band.progressArc.start * DEG;
    const a1 = (band.progressArc.start + band.progressArc.span) * DEG;
    ctx.lineCap = "round";
    ctx.strokeStyle = withAlpha(cfg.palette.ringMain, 0.9);
    ctx.lineWidth = th * 0.86;
    ctx.beginPath();
    ctx.arc(0, 0, R, a0, a1);
    ctx.stroke();
    ctx.strokeStyle = shade(cfg.palette.symbolCore, 0, 0.85);
    ctx.lineWidth = th * 0.22;
    ctx.beginPath();
    ctx.arc(0, 0, R, a0, a1);
    ctx.stroke();
    ctx.lineCap = "butt";
  }
};

/**
 * Each band is stamped to its own sprite once, then blitted with a rotation
 * transform every frame. Ticks and dashes are never re-stroked at render time.
 */
export const RingBand: React.FC<Props> = ({ buffers, cfg, band, frame, drift }) => {
  const sprite = useMemo(() => {
    const R = band.radius * RING_OUTER;
    const half = Math.ceil(R + band.thickness + (band.bright ? 90 : 55));
    const size = half * 2;

    const content = makeCanvas(size, size);
    const cctx = context2d(content);
    cctx.translate(half, half);
    for (let i = 0; i < band.symmetry; i++) {
      cctx.save();
      cctx.rotate((i * 2 * Math.PI) / band.symmetry);
      drawSector(cctx, cfg, band);
      cctx.restore();
    }

    const baked = makeCanvas(size, size);
    const bctx = context2d(baked);
    bctx.filter = `blur(${band.bright ? 30 : 15}px)`;
    bctx.globalAlpha = band.bright ? 0.9 : 0.6;
    bctx.drawImage(content, 0, 0);
    bctx.filter = "none";
    bctx.globalAlpha = 1;
    bctx.globalCompositeOperation = "lighter";
    bctx.drawImage(content, 0, 0);

    return { canvas: baked, half };
  }, [cfg, band]);

  useLayoutEffect(() => {
    // A whole number of symmetry periods across the loop, so frame 900 lands
    // exactly back on frame 0.
    const angle =
      band.spin *
      cfg.rotationDirection *
      band.periods *
      ((2 * Math.PI) / band.symmetry) *
      (frame / DURATION);

    const ctx = beginWorld(layerFor(buffers, band.depth), drift);
    ctx.save();
    ctx.translate(SYMBOL_CX, SYMBOL_CY);
    ctx.rotate(angle);
    ctx.drawImage(sprite.canvas, -sprite.half, -sprite.half);
    ctx.restore();
  });

  return null;
};
