import React from "react";
import { CanvasLayer } from "../CanvasLayer";
import { leadingPoint, type Series } from "../data";
import type { Variant } from "../variants";

export type LineSeriesProps = {
  series: Series[];
  /** 0..1 timeline progress, shared with every other layer. */
  progress: number;
  variant: Variant;
  reveal: number;
};

/**
 * The subject: the polyline series climbing (or falling) across the frame.
 * They extend rightward as the shared timeline advances — the same `progress`
 * that scrolls the axis and adds the bars.
 */
export const LineSeries: React.FC<LineSeriesProps> = ({
  series,
  progress,
  variant,
  reveal,
}) => {
  const { seriesWidth, seriesGlow } = variant;

  const paint = (ctx: CanvasRenderingContext2D, bloomPass: boolean) => {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (const s of series) {
      const head = leadingPoint(s, progress);
      const last = Math.floor(head.index);
      if (head.index <= 0) continue;

      // Calmer, dimmer as the bands descend; the bloom pass leans on that
      // harder so only the topmost series really glows.
      const alpha = bloomPass
        ? Math.pow(s.emphasis, 1.5) * reveal
        : (0.58 + 0.42 * s.emphasis) * reveal;
      if (alpha <= 0.002) continue;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = bloomPass ? seriesWidth * 1.8 : seriesWidth;

      ctx.beginPath();
      ctx.moveTo(s.xs[0], s.ys[0]);
      for (let k = 1; k <= last; k++) ctx.lineTo(s.xs[k], s.ys[k]);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();

      // The leading point the attached callout rides on.
      ctx.beginPath();
      ctx.arc(head.x, head.y, seriesWidth * (bloomPass ? 2.6 : 1.9), 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  return (
    <CanvasLayer
      draw={(ctx) => paint(ctx, false)}
      drawBloom={(ctx) => paint(ctx, true)}
      bloom={seriesGlow}
      bloomOpacity={1}
    />
  );
};
