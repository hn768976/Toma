import React from "react";
import { CanvasLayer } from "../CanvasLayer";
import {
  BAR_BASELINE,
  BAR_MAX_HEIGHT,
  BAR_X0,
  BAR_X1,
  RAIL_BOW,
  RAIL_OFFSET,
} from "../layout";
import type { Palette, Variant } from "../variants";

export type BarRowProps = {
  values: number[];
  progress: number;
  variant: Variant;
  palette: Palette;
  reveal: number;
};

/**
 * The row along the bottom. Bars arrive one at a time as the shared timeline
 * advances, and a thin bright rail bows gently beneath them — that slight
 * curve is what keeps the bottom of the frame from reading as a hard edge.
 */
export const BarRow: React.FC<BarRowProps> = ({
  values,
  progress,
  variant,
  palette,
  reveal,
}) => {
  const count = values.length;
  const slot = (BAR_X1 - BAR_X0) / count;
  const barWidth = slot * (1 - variant.bars.gap);

  const draw = (ctx: CanvasRenderingContext2D) => {
    // The rail dims along with the bars in the descending variant; elsewhere
    // it holds its brightness.
    const railFade =
      variant.bars.mode === "descending" ? 1 - 0.62 * progress : 1;

    ctx.globalAlpha = reveal * 0.85 * railFade;
    ctx.strokeStyle = palette.rail;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    const railY = BAR_BASELINE + RAIL_OFFSET;
    ctx.moveTo(BAR_X0 - 60, railY);
    ctx.quadraticCurveTo(
      (BAR_X0 + BAR_X1) / 2,
      railY + RAIL_BOW * 2,
      BAR_X1 + 60,
      railY,
    );
    ctx.stroke();

    const arrived = progress * count;
    for (let j = 0; j < count; j++) {
      const grown = Math.max(0, Math.min(1, arrived - j));
      if (grown <= 0) continue;
      // Ease each bar up out of the baseline as it arrives.
      const eased = 1 - Math.pow(1 - grown, 3);
      const height = values[j] * BAR_MAX_HEIGHT * eased;
      const x = BAR_X0 + j * slot + (slot - barWidth) / 2;
      const y = BAR_BASELINE - height;

      const gradient = ctx.createLinearGradient(0, BAR_BASELINE, 0, y);
      gradient.addColorStop(0, palette.barBase);
      gradient.addColorStop(1, palette.barBright);
      ctx.globalAlpha = reveal * (0.55 + 0.4 * eased);
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, height);

      ctx.globalAlpha = reveal * eased;
      ctx.fillStyle = palette.barBright;
      ctx.fillRect(x, y, barWidth, 5);
    }
    ctx.globalAlpha = 1;
  };

  return <CanvasLayer draw={draw} />;
};
