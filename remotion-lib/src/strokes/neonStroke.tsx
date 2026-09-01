/**
 * neonStroke.tsx — the four-pass neon construction.
 *
 * WHAT IT DOES
 *   Renders one path four times at decreasing width and increasing
 *   opacity — wide atmospheric glow, outer glow, mid channel, thin hot
 *   core — composited additively.
 *
 * WHAT IT IS FOR
 *   Anything that should read as a glowing tube of light rather than a
 *   coloured line: neon signage, energy arcs, HUD strokes, light trails.
 *
 * WHY FOUR PASSES AND NOT ONE THICK SEMI-TRANSPARENT STROKE
 *   A single stroke has ONE alpha across its whole width, so its edge is
 *   a hard step no matter how soft the colour. Real neon has a
 *   luminance falloff that is roughly exponential from a tiny
 *   near-white core out to a wide dim haze, and crucially the falloff
 *   spans two or three orders of magnitude in brightness. Four stacked
 *   passes approximate that curve with three visible breakpoints, which
 *   is enough that the eye reads a continuous falloff. Stacking them
 *   ADDITIVELY is the other half: where the passes overlap they sum
 *   toward white, so the core goes hot and desaturated exactly the way a
 *   real emitter's centre clips out on camera. Alpha-composite the same
 *   four passes and you get a flat coloured line with a fuzzy edge.
 *
 * PARAMETERS
 *   d              SVG path data
 *   coreColor      REQUIRED. The hot centre — usually near-white, or the
 *                  hue desaturated most of the way toward white.
 *   glowColor      REQUIRED. The saturated hue of the surrounding haze.
 *   coreWidth      px width of the hot core. Default 2. Everything else
 *                  is a multiple of this, so this is your master size.
 *   atmosphericMul width multiple for pass 1. Default 9.
 *   outerMul       pass 2. Default 4.5.
 *   midMul         pass 3. Default 2.2.
 *   atmosphericOpacity / outerOpacity / midOpacity / coreOpacity
 *                  Defaults 0.18 / 0.35 / 0.6 / 1. These are the falloff
 *                  curve; change them together or not at all.
 *   blurPx         extra gaussian blur on the two glow passes. Default 0.
 *                  The width stack alone gives the falloff; blur is for
 *                  when you want atmosphere rather than a clean tube.
 *   blendMode      Default "screen" — works everywhere and will not clip
 *                  to white as readily. "plus-lighter" is true additive
 *                  and closer to real light, but is Chromium-only (fine
 *                  inside Remotion, wrong if the frame is also shown in
 *                  a browser you do not control).
 *
 * GOTCHA
 *   Additive blending only reads as light against a DARK ground. On a
 *   light background every pass washes out and you get a pale smear.
 *   There is no parameter that fixes this; neon needs a dark scene.
 *
 * GOTCHA 2
 *   coreWidth is in user units, so it scales with any enclosing
 *   transform. Counter-scale it with strokeFor() if the group is scaled.
 *
 * USAGE
 *   <svg><g><NeonStroke d="M 100 300 Q 480 80 860 300"
 *                       coreColor="#eaf6ff" glowColor="#2f6fed" /></g></svg>
 */

import React from "react";
import type { Color } from "../types";

export type NeonPass = {
  /** Stroke width in user units. */
  width: number;
  color: Color;
  opacity: number;
  /** Gaussian blur in px; 0 for the crisp passes. */
  blurPx: number;
  /** Which pass this is, outermost first. */
  name: "atmospheric" | "outer" | "mid" | "core";
};

export type NeonStrokeOptions = {
  coreColor: Color;
  glowColor: Color;
  coreWidth?: number;
  atmosphericMul?: number;
  outerMul?: number;
  midMul?: number;
  atmosphericOpacity?: number;
  outerOpacity?: number;
  midOpacity?: number;
  coreOpacity?: number;
  blurPx?: number;
};

/**
 * The pure part: turns the options into four pass descriptors, outermost
 * first. Exported separately so the same construction can drive canvas,
 * SVG, or a renderer this library has never heard of.
 */
export const neonStrokePasses = ({
  coreColor,
  glowColor,
  coreWidth = 2,
  atmosphericMul = 9,
  outerMul = 4.5,
  midMul = 2.2,
  atmosphericOpacity = 0.18,
  outerOpacity = 0.35,
  midOpacity = 0.6,
  coreOpacity = 1,
  blurPx = 0,
}: NeonStrokeOptions): NeonPass[] => [
  {
    name: "atmospheric",
    width: coreWidth * atmosphericMul,
    color: glowColor,
    opacity: atmosphericOpacity,
    blurPx,
  },
  {
    name: "outer",
    width: coreWidth * outerMul,
    color: glowColor,
    opacity: outerOpacity,
    blurPx: blurPx * 0.5,
  },
  {
    name: "mid",
    width: coreWidth * midMul,
    color: glowColor,
    opacity: midOpacity,
    blurPx: 0,
  },
  {
    name: "core",
    width: coreWidth,
    color: coreColor,
    opacity: coreOpacity,
    blurPx: 0,
  },
];

export type NeonStrokeProps = NeonStrokeOptions & {
  d: string;
  blendMode?: "screen" | "plus-lighter" | "lighten" | "normal";
  strokeLinecap?: "butt" | "round" | "square";
  strokeLinejoin?: "miter" | "round" | "bevel";
  /** Passed through to every pass, e.g. for a draw-on reveal. */
  strokeDasharray?: string | number;
  strokeDashoffset?: string | number;
};

/** SVG renderer for the four-pass construction. */
export const NeonStroke: React.FC<NeonStrokeProps> = ({
  d,
  blendMode = "screen",
  strokeLinecap = "round",
  strokeLinejoin = "round",
  strokeDasharray,
  strokeDashoffset,
  ...options
}) => {
  const passes = neonStrokePasses(options);
  return (
    <g style={{ mixBlendMode: blendMode }}>
      {passes.map((pass) => (
        <path
          key={pass.name}
          d={d}
          fill="none"
          stroke={pass.color}
          strokeWidth={pass.width}
          strokeOpacity={pass.opacity}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          style={{
            mixBlendMode: blendMode,
            filter: pass.blurPx > 0 ? `blur(${pass.blurPx}px)` : undefined,
          }}
        />
      ))}
    </g>
  );
};

/**
 * Canvas renderer for the same construction. `trace` should issue the
 * path commands (ctx.beginPath() is called for you before each pass);
 * it is called once per pass, so keep it cheap.
 */
export const drawNeonStroke = (
  ctx: CanvasRenderingContext2D,
  trace: (ctx: CanvasRenderingContext2D) => void,
  options: NeonStrokeOptions & {
    blendMode?: GlobalCompositeOperation;
    lineCap?: CanvasLineCap;
    lineJoin?: CanvasLineJoin;
  },
): void => {
  const { blendMode = "lighter", lineCap = "round", lineJoin = "round" } = options;
  const passes = neonStrokePasses(options);

  const previousOp = ctx.globalCompositeOperation;
  const previousAlpha = ctx.globalAlpha;
  const previousFilter = ctx.filter;

  ctx.globalCompositeOperation = blendMode;
  ctx.lineCap = lineCap;
  ctx.lineJoin = lineJoin;

  for (const pass of passes) {
    ctx.globalAlpha = pass.opacity;
    ctx.strokeStyle = pass.color;
    ctx.lineWidth = pass.width;
    ctx.filter = pass.blurPx > 0 ? `blur(${pass.blurPx}px)` : "none";
    ctx.beginPath();
    trace(ctx);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = previousOp;
  ctx.globalAlpha = previousAlpha;
  ctx.filter = previousFilter;
};
