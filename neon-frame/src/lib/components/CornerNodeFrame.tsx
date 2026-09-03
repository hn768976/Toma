/**
 * <CornerNodeFrame> — a thin rectangular outline with four bright, separately
 * hued corner nodes.
 *
 * The outline is modest: a clean stroke with a soft glow whose brightness
 * varies along its length, brightest at the corners and dimmest at the
 * midpoint of each edge, so the light reads as coming from the nodes and
 * travelling inward along the lines. The corners carry the energy — each is a
 * small intense point inside a wide soft halo, each a different hue, each
 * pulsing on its own period, and each emitting a wide flat anamorphic streak.
 * A faint highlight travels the perimeter, completing a whole number of
 * circuits per loop.
 *
 * The interior is left empty on purpose: this is a title plate, and the space
 * inside is meant to hold something else. An optional scrim calms whatever is
 * behind the plate so a title placed there stays legible.
 *
 * Deterministic and palette-agnostic — every colour, proportion and period is
 * a prop, and all motion is a pure function of useCurrentFrame(). Every
 * default period divides a 360-frame loop, so frame 0 and frame `loopLength`
 * are identical.
 *
 * @example
 *   <CornerNodeFrame
 *     width={3840} height={2160} loopLength={360}
 *     rect={{x: 1980, y: 517, w: 1500, h: 1125}}
 *     lineColor="#4F8FE8" coreColor="#E8F2FF"
 *     nodeColors={{topLeft: "#3FD4F5", topRight: "#E85FC4",
 *                  bottomLeft: "#F5A03F", bottomRight: "#4FE8A8"}}
 *     strokeWidth={4} nodeHaloRadius={300}
 *   />
 */
import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { TAU, frac, offscreen, rgba, useCanvas2D } from "../canvas";
import { blitSprite, lightSprite } from "../sprites";
import { bloomPass, type BloomOptions } from "../bloom-pass";
import { neonStroke, type NeonSegment, type NeonStrokePass } from "../neon-stroke";

export type CornerKey = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export const CORNERS: CornerKey[] = [
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
];

export type Rect = { x: number; y: number; w: number; h: number };

export type PulseSpec = { period: number; phase: number };

/**
 * Four different periods, all dividing 360, with phase offsets — so the nodes
 * pulse independently and never brighten together.
 */
export const DEFAULT_PULSE: Record<CornerKey, PulseSpec> = {
  topLeft: { period: 90, phase: 0 },
  topRight: { period: 120, phase: 0.31 },
  bottomLeft: { period: 72, phase: 0.57 },
  bottomRight: { period: 60, phase: 0.79 },
};

export const DEFAULT_STROKE_PASSES: NeonStrokePass[] = [
  { widthScale: 10, endAlpha: 0.11, midAlpha: 0.02 },
  { widthScale: 4, endAlpha: 0.24, midAlpha: 0.05 },
  { widthScale: 1, endAlpha: 0.95, midAlpha: 0.26 },
];

export type CornerNodeFrameProps = {
  /** Canvas backing-store size. */
  width: number;
  height: number;
  /** Frames per loop. Every period below should divide it. */
  loopLength: number;
  /** The plate rectangle, in canvas pixels. */
  rect: Rect;
  /** Hex colour of the outline between the corners. */
  lineColor: string;
  /** Hex colour of the hot inner core and the travelling highlight. */
  coreColor: string;
  /** One hex hue per corner. */
  nodeColors: Record<CornerKey, string>;
  /** Base outline width in canvas pixels. */
  strokeWidth: number;
  /** Radius of a node's soft halo, in canvas pixels. */
  nodeHaloRadius: number;
  /** Multiplier on the anamorphic streak's length. */
  streakScale?: number;
  /** How many times wider than tall the anamorphic streak is. */
  streakAspect?: number;
  /** Whole circuits the travelling highlight makes per loop. */
  highlightCircuits?: number;
  /** Length of the highlight's tail as a fraction of the perimeter. */
  highlightTail?: number;
  pulse?: Record<CornerKey, PulseSpec>;
  strokePasses?: NeonStrokePass[];
  /** Calms whatever is behind the plate. Pass null to leave it untouched. */
  interiorScrim?: { color: string; opacity: number } | null;
  bloom?: BloomOptions;
  bloomScale?: number;
  style?: React.CSSProperties;
};

/**
 * The travelling highlight is a hot core stroke plus a soft underglow.
 *
 * The core is drawn straight onto the layer. The underglow is NOT drawn with
 * `ctx.filter = "blur(...)"`: setting a filter makes Chromium allocate a
 * filter layer for the draw, and a tail is dozens of short strokes, so at 4K
 * that alone cost more than the entire rest of the composition (measured: it
 * tripled total render time). Instead the wider passes go into the same
 * low-resolution bright-pass buffer as the corner nodes and are blurred once,
 * by bloomPass, along with everything else that glows.
 */
const HIGHLIGHT_GLOW_PASSES = [
  { widthScale: 6, alphaScale: 0.42, segments: 16 },
  { widthScale: 2.4, alphaScale: 0.5, segments: 24 },
] as const;
const HIGHLIGHT_CORE_SEGMENTS = 64;
const HIGHLIGHT_CORE_ALPHA = 0.62;

type EdgeSpec = NeonSegment & {
  length: number;
};

const buildEdges = (
  rect: Rect,
  nodeColors: Record<CornerKey, string>,
): EdgeSpec[] => {
  const { x, y, w, h } = rect;
  return [
    {
      from: { x, y },
      to: { x: x + w, y },
      length: w,
      startColor: nodeColors.topLeft,
      endColor: nodeColors.topRight,
    },
    {
      from: { x: x + w, y },
      to: { x: x + w, y: y + h },
      length: h,
      startColor: nodeColors.topRight,
      endColor: nodeColors.bottomRight,
    },
    {
      from: { x: x + w, y: y + h },
      to: { x, y: y + h },
      length: w,
      startColor: nodeColors.bottomRight,
      endColor: nodeColors.bottomLeft,
    },
    {
      from: { x, y: y + h },
      to: { x, y },
      length: h,
      startColor: nodeColors.bottomLeft,
      endColor: nodeColors.topLeft,
    },
  ];
};

export const cornerPoint = (rect: Rect, corner: CornerKey) => {
  const { x, y, w, h } = rect;
  switch (corner) {
    case "topLeft":
      return { x, y };
    case "topRight":
      return { x: x + w, y };
    case "bottomLeft":
      return { x, y: y + h };
    case "bottomRight":
      return { x: x + w, y: y + h };
  }
};

/** Point at normalised perimeter position t (top -> right -> bottom -> left). */
const perimeterPoint = (edges: EdgeSpec[], perimeter: number, t: number) => {
  let d = frac(t) * perimeter;
  for (const edge of edges) {
    if (d <= edge.length) {
      const u = edge.length === 0 ? 0 : d / edge.length;
      return {
        x: edge.from.x + (edge.to.x - edge.from.x) * u,
        y: edge.from.y + (edge.to.y - edge.from.y) * u,
      };
    }
    d -= edge.length;
  }
  return edges[0].from;
};

/** Polyline from t0 to t1 that turns properly at any corner in between. */
const perimeterPolyline = (
  edges: EdgeSpec[],
  perimeter: number,
  t0: number,
  t1: number,
) => {
  const points = [perimeterPoint(edges, perimeter, t0)];
  let offset = 0;
  for (const edge of edges) {
    offset += edge.length;
    const boundary = offset / perimeter;
    for (const candidate of [boundary - 1, boundary, boundary + 1]) {
      if (candidate > t0 && candidate < t1) {
        points.push(perimeterPoint(edges, perimeter, candidate));
      }
    }
  }
  points.push(perimeterPoint(edges, perimeter, t1));
  return points;
};

export const CornerNodeFrame: React.FC<CornerNodeFrameProps> = ({
  width,
  height,
  loopLength,
  rect,
  lineColor,
  coreColor,
  nodeColors,
  strokeWidth,
  nodeHaloRadius,
  streakScale = 1,
  streakAspect = 7.5,
  highlightCircuits = 2,
  highlightTail = 0.14,
  pulse = DEFAULT_PULSE,
  strokePasses = DEFAULT_STROKE_PASSES,
  interiorScrim = null,
  bloom = {
    wideRadius: 56,
    tightRadius: 16,
    wideStrength: 0.62,
    tightStrength: 0.45,
  },
  bloomScale = 1 / 6,
  style,
}) => {
  const frame = useCurrentFrame();
  const f = ((frame % loopLength) + loopLength) % loopLength;

  const edges = useMemo(
    () => buildEdges(rect, nodeColors),
    [rect, nodeColors],
  );
  const perimeter = useMemo(
    () => edges.reduce((sum, edge) => sum + edge.length, 0),
    [edges],
  );
  const bloomBuffer = useMemo(
    () => offscreen(Math.round(width * bloomScale), Math.round(height * bloomScale)),
    [width, height, bloomScale],
  );

  const ref = useCanvas2D((ctx, canvasWidth, canvasHeight) => {
    bloomBuffer.ctx.setTransform(1, 0, 0, 1, 0, 0);
    bloomBuffer.ctx.globalAlpha = 1;
    bloomBuffer.ctx.globalCompositeOperation = "source-over";
    bloomBuffer.ctx.clearRect(
      0,
      0,
      bloomBuffer.canvas.width,
      bloomBuffer.canvas.height,
    );
    bloomBuffer.ctx.globalCompositeOperation = "lighter";

    /* --- interior: calmed to clean negative space, nothing drawn in it --- */
    if (interiorScrim) {
      ctx.save();
      ctx.filter = "blur(30px)";
      ctx.fillStyle = rgba(interiorScrim.color, interiorScrim.opacity);
      const inset = strokeWidth * 3;
      ctx.fillRect(
        rect.x + inset,
        rect.y + inset,
        rect.w - inset * 2,
        rect.h - inset * 2,
      );
      ctx.restore();
    }

    /* -------------------------- the outline, brighter near the corners */
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "lighter";
    neonStroke(ctx, edges, {
      baseWidth: strokeWidth,
      bodyColor: lineColor,
      passes: [
        ...strokePasses,
        { widthScale: 0.4, endAlpha: 0.7, midAlpha: 0.09, color: coreColor },
      ],
    });

    /* -------------------------------------- travelling perimeter highlight */
    const headT = frac((f * highlightCircuits) / loopLength);
    // Butt caps, not round: with additive compositing a rounded cap at every
    // segment joint bulges, and the tail reads as a string of beads instead
    // of one travelling stroke.
    const drawTail = (
      target: CanvasRenderingContext2D,
      coordScale: number,
      widthScale: number,
      alphaScale: number,
      segments: number,
    ) => {
      target.lineCap = "butt";
      for (let s = 0; s < segments; s++) {
        const t = s / segments;
        const spanEnd = headT - t * highlightTail;
        const spanStart = spanEnd - highlightTail / segments;
        const alpha = Math.pow(1 - t, 2.2) * alphaScale;
        const points = perimeterPolyline(edges, perimeter, spanStart, spanEnd);
        target.strokeStyle = rgba(coreColor, alpha);
        target.lineWidth =
          strokeWidth * widthScale * (0.5 + 1.1 * (1 - t)) * coordScale;
        target.beginPath();
        target.moveTo(points[0].x * coordScale, points[0].y * coordScale);
        for (let p = 1; p < points.length; p++) {
          target.lineTo(points[p].x * coordScale, points[p].y * coordScale);
        }
        target.stroke();
      }
    };

    for (const pass of HIGHLIGHT_GLOW_PASSES) {
      drawTail(
        bloomBuffer.ctx,
        bloomScale,
        pass.widthScale,
        pass.alphaScale,
        pass.segments,
      );
    }
    drawTail(ctx, 1, 1, HIGHLIGHT_CORE_ALPHA, HIGHLIGHT_CORE_SEGMENTS);
    ctx.lineCap = "round";

    /* ------------------------------------------------ the four corner nodes */
    for (const corner of CORNERS) {
      const colour = nodeColors[corner];
      const point = cornerPoint(rect, corner);
      const { period, phase } = pulse[corner];
      const wave = 0.5 + 0.5 * Math.cos(TAU * (f / period + phase));
      const intensity = 0.55 + 0.45 * Math.pow(wave, 1.5);

      const sprite = lightSprite(colour, 0.07, 2.6);
      const halo = nodeHaloRadius * 2.3 * (0.85 + 0.3 * intensity);

      // Wide flat anamorphic streak: several times wider than tall, low alpha.
      const streakWidth =
        nodeHaloRadius * 2.6 * streakScale * (0.9 + 0.25 * intensity);
      blitSprite(
        ctx,
        sprite,
        point.x,
        point.y,
        streakWidth,
        streakWidth / streakAspect,
        0.34 * intensity,
      );
      // Wide soft halo.
      blitSprite(ctx, sprite, point.x, point.y, halo, halo, 0.4 * intensity);
      // Small intense point of light.
      const core = nodeHaloRadius * 0.17 * (0.8 + 0.4 * intensity);
      blitSprite(ctx, sprite, point.x, point.y, core, core, 1);

      const bloomSize = halo * 0.6 * bloomScale;
      blitSprite(
        bloomBuffer.ctx,
        sprite,
        point.x * bloomScale,
        point.y * bloomScale,
        bloomSize,
        bloomSize,
        0.85 * intensity,
      );
      blitSprite(
        bloomBuffer.ctx,
        sprite,
        point.x * bloomScale,
        point.y * bloomScale,
        streakWidth * bloomScale,
        (streakWidth / streakAspect) * bloomScale,
        0.5 * intensity,
      );
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    bloomPass(ctx, bloomBuffer.canvas, canvasWidth, canvasHeight, bloom);
  });

  return <canvas ref={ref} width={width} height={height} style={style} />;
};
