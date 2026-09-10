import { REFERENCE_HEIGHT } from "../constants";
import { css, parseHex } from "../color";
import { createRng, seedFor } from "../rng";
import { buildMotif, motifExtent, type MotifGeometry } from "../motifs/shapes";
import { legibleInk, type Box, type FillOptions } from "../fills/treatments";
import type { CompositionSpec, MotifSpec } from "../types";
import type { Palette } from "../palettes";

const TAU = Math.PI * 2;

/** A motif spec resolved to pixels for a given frame size. */
export type MotifInstance = {
  readonly index: number;
  readonly spec: MotifSpec;
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly stroke: number;
  readonly extent: number;
  /** Half-extents of the axis-aligned bounds, for the open-centre guard. */
  readonly halfW: number;
  readonly halfH: number;
  /** Default stipple / hatch direction: inward, so motifs fade toward centre. */
  readonly fillAngle: number;
};

const DEFAULT_STROKE = 0.0018;

export const resolveMotifs = (
  composition: CompositionSpec,
  width: number,
  height: number,
): MotifInstance[] =>
  composition.motifs.map((spec, index) => {
    const radius = spec.r * height;
    const cx = spec.x * width;
    const cy = spec.y * height;
    const extent = motifExtent(spec, radius);
    const inward = Math.atan2(height / 2 - cy, width / 2 - cx);
    return {
      index,
      spec,
      cx,
      cy,
      radius,
      stroke: (spec.stroke ?? DEFAULT_STROKE) * height,
      extent,
      halfW: spec.motif === "kumo" ? radius * (spec.aspect ?? 1.7) : radius,
      halfH: spec.motif === "kumo" ? radius * 0.62 : radius,
      fillAngle:
        spec.fillAngle === undefined
          ? inward
          : (spec.fillAngle * Math.PI) / 180,
    };
  });

/* ── THE OPEN CENTRE GUARD ──────────────────────────────────────────────────
   Every composition keeps the middle of the frame clear; that open centre is
   what makes these images usable for copy. The guard is measured, not
   eyeballed, and reported at render time.                                   */

export type OpenCentreRect = { x0: number; y0: number; x1: number; y1: number };

export const openCentreRect = (
  composition: CompositionSpec,
  width: number,
  height: number,
): OpenCentreRect => {
  const w = composition.openCentre.w * width;
  const h = composition.openCentre.h * height;
  return {
    x0: (width - w) / 2,
    y0: (height - h) / 2,
    x1: (width + w) / 2,
    y1: (height + h) / 2,
  };
};

/** Distance from a motif to the open centre. Negative means it intrudes. */
export const clearance = (
  instance: MotifInstance,
  rect: OpenCentreRect,
): number => {
  if (instance.spec.motif === "kumo") {
    const sepX = Math.max(
      rect.x0 - (instance.cx + instance.halfW),
      instance.cx - instance.halfW - rect.x1,
    );
    const sepY = Math.max(
      rect.y0 - (instance.cy + instance.halfH),
      instance.cy - instance.halfH - rect.y1,
    );
    return Math.max(sepX, sepY);
  }
  const nx = Math.max(rect.x0 - instance.cx, 0, instance.cx - rect.x1);
  const ny = Math.max(rect.y0 - instance.cy, 0, instance.cy - rect.y1);
  return Math.hypot(nx, ny) - instance.extent;
};

/** Local-space box covering only the part of the motif inside the frame. */
const visibleBox = (
  instance: MotifInstance,
  width: number,
  height: number,
): Box => ({
  x0: Math.max(-instance.extent, -instance.cx),
  y0: Math.max(-instance.extent, -instance.cy),
  x1: Math.min(instance.extent, width - instance.cx),
  y1: Math.min(instance.extent, height - instance.cy),
});

export type MotifEnv = {
  readonly width: number;
  readonly height: number;
  readonly palette: Palette;
  readonly composition: CompositionSpec;
};

export type Painter = (options: FillOptions) => void;

const strokeDots = (
  ctx: CanvasRenderingContext2D,
  dots: MotifGeometry["dots"],
) => {
  for (const dot of dots) {
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.r, 0, TAU);
    ctx.fill();
  }
};

/**
 * Draw one motif instance. The fill of its area is delegated to `paint`, which
 * the <FillTreatment> component supplies; everything else (lattice outlines,
 * centre dots, sakura stamens) belongs to the shape itself.
 */
export const drawMotifInstance = (
  ctx: CanvasRenderingContext2D,
  instance: MotifInstance,
  env: MotifEnv,
  paint: Painter,
): void => {
  const { spec } = instance;
  const scale = env.height / REFERENCE_HEIGHT;
  const rng = createRng(seedFor(env.composition.id, `motif-${instance.index}`));
  const geometry = buildMotif(spec, instance.radius, instance.stroke, rng);

  const paper = parseHex(env.palette.paper);
  const rawInk = parseHex(env.palette.motifs[spec.ink ?? 0]);
  const ink = legibleInk(rawInk, paper);
  const alpha = spec.alpha ?? 1;

  ctx.save();
  ctx.translate(instance.cx, instance.cy);

  if (geometry.regions) {
    paint({
      ctx,
      region: geometry.regions,
      rule: geometry.regionRule,
      ink,
      paper,
      alpha,
      extent: instance.extent,
      box: visibleBox(instance, env.width, env.height),
      scale,
      strokePx: instance.stroke,
      angle: instance.fillAngle,
      density: spec.fillDensity ?? 1,
      rng,
    });

    if (spec.outline) {
      ctx.strokeStyle = css(ink, alpha);
      ctx.lineWidth = instance.stroke;
      ctx.stroke(geometry.regions);
    }
  }

  if (geometry.lines.length > 0) {
    ctx.save();
    if (geometry.clip) {
      ctx.beginPath();
      ctx.clip(geometry.clip);
    }
    ctx.strokeStyle = css(ink, alpha);
    for (const line of geometry.lines) {
      ctx.lineWidth = line.width;
      ctx.stroke(line.path);
    }
    ctx.restore();
  }

  if (geometry.dots.length > 0) {
    ctx.fillStyle = css(ink, alpha);
    strokeDots(ctx, geometry.dots);
  }

  // Paper-toned detail over the fill: sakura stamens and their tip dots.
  if (geometry.knockoutLines.length > 0 || geometry.knockoutDots.length > 0) {
    ctx.strokeStyle = css(paper, 0.94);
    ctx.fillStyle = css(paper, 0.94);
    ctx.lineCap = "round";
    for (const line of geometry.knockoutLines) {
      ctx.lineWidth = line.width;
      ctx.stroke(line.path);
    }
    strokeDots(ctx, geometry.knockoutDots);
  }

  ctx.restore();
};
