import React, { useMemo } from "react";
import { interpolate } from "remotion";
import { useCanvasDraw } from "./canvas";
import { generateTraces, type Trace } from "./circuitTraces";
import { strokePolylineTo, vertexProgress } from "./drawOn";
import { mixColors, withAlpha } from "./postFx";
import { rand, randRange } from "./random";

/**
 * A full-frame field of right-angle circuit traces with square pads and stub
 * terminations. Traces stroke on over a configurable window, several at a
 * time; once every trace is complete the finished field is blitted from a
 * pre-rendered offscreen canvas and only the blinking pads are redrawn.
 *
 * Subject-agnostic and palette-agnostic: both colours, all geometry and all
 * timing are props. Pure function of `frame`.
 */
export const CircuitBackdrop: React.FC<{
  frame: number;
  width: number;
  height: number;
  /** Base trace colour. */
  dimColor: string;
  /** Colour the brightest traces and the pads reach. */
  brightColor: string;
  seed: string;
  /** Number of independent traces. */
  count?: number;
  /** Coarse grid the right angles snap to. */
  gridSize?: number;
  minTurns?: number;
  maxTurns?: number;
  lineWidth?: number;
  padSize?: number;
  padChance?: number;
  stubChance?: number;
  /** Draw-on window, in frames. Traces start at staggered points inside it. */
  drawOnStart?: number;
  drawOnEnd?: number;
  /** Per-trace stroke duration range, in frames. */
  minDrawFrames?: number;
  maxDrawFrames?: number;
  padBlinkPeriodMin?: number;
  padBlinkPeriodMax?: number;
  /** Base pad opacity, and how much the blink adds on top. */
  padBaseAlpha?: number;
  padBlinkAlpha?: number;
  style?: React.CSSProperties;
}> = ({
  frame,
  width,
  height,
  dimColor,
  brightColor,
  seed,
  count = 120,
  gridSize = 96,
  minTurns = 3,
  maxTurns = 9,
  lineWidth = 3,
  padSize = 15,
  padChance = 0.26,
  stubChance = 0.55,
  drawOnStart = 0,
  drawOnEnd = 40,
  minDrawFrames = 12,
  maxDrawFrames = 20,
  padBlinkPeriodMin = 90,
  padBlinkPeriodMax = 240,
  padBaseAlpha = 0.22,
  padBlinkAlpha = 0.6,
  style,
}) => {
  const traces = useMemo(
    () =>
      generateTraces({
        width,
        height,
        count,
        gridSize,
        minTurns,
        maxTurns,
        padChance,
        stubChance,
        seed,
      }),
    [width, height, count, gridSize, minTurns, maxTurns, padChance, stubChance, seed],
  );

  /** Per-trace draw-on window, staggered so several stroke at once. */
  const schedule = useMemo(
    () =>
      traces.map((trace) => {
        const latestStart = Math.max(
          drawOnStart,
          drawOnEnd - maxDrawFrames,
        );
        const start = randRange(`${seed}:start:${trace.index}`, drawOnStart, latestStart);
        const duration = randRange(
          `${seed}:dur:${trace.index}`,
          minDrawFrames,
          maxDrawFrames,
        );
        return { start, end: Math.min(drawOnEnd, start + duration) };
      }),
    [traces, seed, drawOnStart, drawOnEnd, minDrawFrames, maxDrawFrames],
  );

  const strokeFor = (trace: Trace) =>
    mixColors(dimColor, brightColor, Math.pow(trace.brightness, 2.2), 1);

  /**
   * The finished trace field, rendered exactly once. Re-stroking every
   * polyline on every idle frame would be pure waste, and re-generating them
   * would make the field crawl.
   */
  const staticField = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    for (const trace of traces) {
      ctx.strokeStyle = mixColors(dimColor, brightColor, Math.pow(trace.brightness, 2.2), 1);
      strokePolylineTo(ctx, trace.points, 1, trace.cumulative);
    }
    return canvas;
  }, [traces, width, height, lineWidth, dimColor, brightColor]);

  const ref = useCanvasDraw(width, height, (ctx) => {
    const drawnOn = frame >= drawOnEnd;
    const progressOf = (i: number) =>
      drawnOn
        ? 1
        : interpolate(frame, [schedule[i].start, schedule[i].end], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

    if (drawnOn) {
      ctx.drawImage(staticField, 0, 0);
    } else {
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "square";
      ctx.lineJoin = "miter";
      traces.forEach((trace, i) => {
        const progress = progressOf(i);
        if (progress <= 0) return;
        ctx.strokeStyle = strokeFor(trace);
        strokePolylineTo(ctx, trace.points, progress, trace.cumulative);
      });
    }

    // Pads sit on top so they can blink independently of the cached field.
    const half = padSize / 2;
    traces.forEach((trace, i) => {
      const progress = progressOf(i);
      for (const vi of trace.padIndices) {
        if (vertexProgress(trace.cumulative, vi) > progress) continue;
        const period = interpolate(
          rand(`${seed}:padPeriod:${trace.index}:${vi}`),
          [0, 1],
          [padBlinkPeriodMin, padBlinkPeriodMax],
        );
        const phase = rand(`${seed}:padPhase:${trace.index}:${vi}`) * Math.PI * 2;
        const blink = 0.5 + 0.5 * Math.sin((frame / period) * Math.PI * 2 + phase);
        const point = trace.points[vi];
        ctx.fillStyle = withAlpha(brightColor, padBaseAlpha + padBlinkAlpha * Math.pow(blink, 3));
        ctx.fillRect(point.x - half, point.y - half, padSize, padSize);
      }
    });
  });

  return <canvas ref={ref} style={style} />;
};
