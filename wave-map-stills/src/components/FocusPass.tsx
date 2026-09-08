import React from "react";
import {BRACKETS} from "../lib/stage";
import {usePass, type PassProps} from "./pass";

/**
 * Depth of field. Each of the four blur buffers is blurred exactly once, on the
 * way onto the frame, softest first. Per-dot blurring would be unusably slow at
 * 4K. The light layer goes on last.
 */
export const FocusPass: React.FC<PassProps> = (props) => {
  usePass(props, (ctx, stage) => {
    const {buffers, field, lightLayer, width, height, k} = stage;
    ctx.globalCompositeOperation = "lighter";
    ctx.imageSmoothingQuality = "high";

    for (let b = buffers.length - 1; b >= 0; b--) {
      const blur = BRACKETS[b].blur * k;
      ctx.filter = blur > 0.5 ? `blur(${blur.toFixed(2)}px)` : "none";
      ctx.drawImage(buffers[b].canvas, field.x0, field.y0, field.w, field.h);
    }

    ctx.filter = `blur(${(3 * k).toFixed(2)}px)`;
    ctx.drawImage(lightLayer.canvas, 0, 0, width, height);
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
  });
  return null;
};
