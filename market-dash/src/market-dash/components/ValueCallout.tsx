import React from "react";
import { CanvasLayer } from "../CanvasLayer";
import { font } from "../fonts";
import type { Callout } from "../data";
import type { Palette } from "../variants";

export type ValueCalloutProps = {
  callouts: Callout[];
  palette: Palette;
};

/**
 * The scattered numeric labels — some riding a series' leading point, the
 * rest floating free over the map. Only the brightest are given bloom.
 */
export const ValueCallout: React.FC<ValueCalloutProps> = ({
  callouts,
  palette,
}) => {
  const paint = (ctx: CanvasRenderingContext2D, brightOnly: boolean) => {
    ctx.textBaseline = "alphabetic";
    for (const callout of callouts) {
      if (brightOnly && !callout.bright) continue;
      if (callout.opacity <= 0.004) continue;
      ctx.globalAlpha = brightOnly ? callout.opacity * 0.9 : callout.opacity;
      ctx.textAlign = callout.align;
      ctx.font = font(callout.size, callout.bright ? 500 : 400);
      ctx.fillStyle = callout.bright ? palette.textBright : palette.textPale;
      ctx.fillText(callout.text, callout.x, callout.y);
    }
    ctx.globalAlpha = 1;
  };

  return (
    <CanvasLayer
      draw={(ctx) => paint(ctx, false)}
      drawBloom={(ctx) => paint(ctx, true)}
      bloom={16}
      bloomOpacity={0.55}
    />
  );
};
