import React, { useMemo } from "react";
import { Panel } from "./Panel";
import type { Rect } from "../layout";
import { PALETTE, withAlpha } from "../palette";
import { BAR_FAST_PERIOD, BAR_SLOW_PERIOD } from "../timing";
import { monoFont } from "../fonts";
import { rndRange } from "@lib/random/seeded";
import { drawBarSeries, staggeredBarLevel } from "@lib/panels/bars";
import { guideLines } from "@lib/draw/grid";

export type BarPanelProps = {
  rect: Rect;
  index: number;
  panelCount: number;
  frame: number;
  label: string;
  seed: string;
  count: number;
  orientation: "horizontal" | "vertical";
  color: string;
  /** Index of the single bar drawn in `highlightColor`. -1 for none. */
  highlight?: number;
  highlightColor?: string;
  showValues?: boolean;
};

/**
 * Bars whose lengths shift on staggered cycles.
 *
 * Each bar sums two sines on different periods (90 and 50 frames) with its own
 * seeded phase, so no two bars move together and nothing reads as a loop —
 * while both periods still divide 450 exactly, so the whole strip returns to
 * its starting configuration at the cut.
 *
 * Serves both the horizontal top strip and the taller vertical panel.
 */
export const BarPanel: React.FC<BarPanelProps> = ({
  rect,
  index,
  panelCount,
  frame,
  label,
  seed,
  count,
  orientation,
  color,
  highlight = -1,
  highlightColor = PALETTE.accentAmber,
  showValues = false,
}) => {
  const phases = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        slow: rndRange(`${seed}-p1-${i}`, 0, 1),
        fast: rndRange(`${seed}-p2-${i}`, 0, 1),
        bias: rndRange(`${seed}-b-${i}`, -0.14, 0.14),
      })),
    [seed, count],
  );

  const level = (i: number) =>
    staggeredBarLevel({
      frame,
      slowPeriod: BAR_SLOW_PERIOD,
      fastPeriod: BAR_FAST_PERIOD,
      slowPhase: phases[i].slow,
      fastPhase: phases[i].fast,
      bias: phases[i].bias,
    });

  const drawStatic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    guideLines(ctx, {
      ...inner,
      color: PALETTE.gridLine,
      ...(orientation === "vertical" ? { horizontal: 5 } : { vertical: 6 }),
    });
    ctx.strokeStyle = withAlpha(PALETTE.elementDim, 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (orientation === "vertical") {
      ctx.moveTo(inner.x, inner.y + inner.h);
      ctx.lineTo(inner.x + inner.w, inner.y + inner.h);
    } else {
      ctx.moveTo(inner.x, inner.y);
      ctx.lineTo(inner.x, inner.y + inner.h);
    }
    ctx.stroke();
  };

  const drawDynamic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const valueGutter = showValues ? 118 : 0;
    const values = Array.from({ length: count }, (_, i) => level(i));

    const bars = drawBarSeries(ctx, {
      ...inner,
      values,
      orientation,
      highlightIndex: highlight,
      gutter: valueGutter,
      colors: {
        bar: color,
        highlight: highlightColor,
        cap: withAlpha(PALETTE.textBright, orientation === "vertical" ? 0.5 : 0.6),
        // Each bar's track is tinted from that bar's own colour, so the amber
        // highlight carries an amber track rather than a cyan one.
        track:
          orientation === "horizontal"
            ? (_i, barColor) => withAlpha(barColor, 0.2)
            : undefined,
      },
    });

    if (showValues && orientation === "horizontal") {
      ctx.save();
      ctx.font = monoFont(400, 21);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const b of bars) {
        ctx.fillStyle = b.index === highlight ? highlightColor : PALETTE.textPale;
        ctx.fillText(
          String(Math.round(values[b.index] * 9999)).padStart(4, "0"),
          inner.x + inner.w,
          b.y + b.h / 2,
        );
      }
      ctx.restore();
    }
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
