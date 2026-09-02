import React, { useMemo } from "react";
import { Panel } from "./Panel";
import type { Rect } from "../layout";
import { PALETTE, withAlpha } from "../palette";
import { WAVEFORM_SCROLL_PERIOD } from "../timing";
import { drawScrollingTrace, makeJaggedSeries } from "@lib/panels/traces";
import { guideLines } from "@lib/draw/grid";

const SAMPLES = 96;

export type WaveformPanelProps = {
  rect: Rect;
  index: number;
  panelCount: number;
  frame: number;
  label: string;
  seed: string;
};

/**
 * A jagged line trace on a faint grid, scrolling leftward. The pattern is one
 * panel-width long and advances exactly one panel width per
 * WAVEFORM_SCROLL_PERIOD frames, so it tiles into itself on the loop.
 */
export const WaveformPanel: React.FC<WaveformPanelProps> = ({
  rect,
  index,
  panelCount,
  frame,
  label,
  seed,
}) => {
  const main = useMemo(() => makeJaggedSeries(`${seed}-main`, SAMPLES, 0.1), [seed]);
  const ghost = useMemo(() => makeJaggedSeries(`${seed}-ghost`, SAMPLES, 0.04), [seed]);

  const drawStatic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    guideLines(ctx, { ...inner, color: PALETTE.gridLine, vertical: 8, horizontal: 4 });
    ctx.strokeStyle = withAlpha(PALETTE.elementDim, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y + inner.h / 2);
    ctx.lineTo(inner.x + inner.w, inner.y + inner.h / 2);
    ctx.stroke();
  };

  const drawDynamic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const phase = (frame % WAVEFORM_SCROLL_PERIOD) / WAVEFORM_SCROLL_PERIOD;

    ctx.save();
    ctx.beginPath();
    ctx.rect(inner.x, inner.y, inner.w, inner.h);
    ctx.clip();

    const trace = (series: number[], color: string, lineWidth: number, glow: number) =>
      drawScrollingTrace(ctx, {
        ...inner,
        series,
        offsetFraction: phase,
        color,
        lineWidth,
        glow,
      });

    trace(ghost, withAlpha(PALETTE.elementDim, 0.85), 2, 0);
    trace(main, PALETTE.elementCyan, 3, 12);
    ctx.restore();
  };

  return (
    <Panel
      rect={rect}
      index={index}
      panelCount={panelCount}
      frame={frame}
      label={label}
      drawStatic={drawStatic}
      drawDynamic={drawDynamic}
    />
  );
};
