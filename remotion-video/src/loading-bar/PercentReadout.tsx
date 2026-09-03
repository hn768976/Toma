import React from "react";
import { Canvas2D } from "./lib/Canvas2D";
import { cssFont } from "./fonts";
import { rgba } from "./lib/color";
import { applyTilt, DEFAULT_TILT, type Tilt } from "./lib/tilt";

export type PercentReadoutProps = {
  width: number;
  height: number;
  progress: number;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  /** Right edge of the readout, in untilted frame coordinates. */
  right: number;
  baseline: number;
  color: string;
  scale: number;
  tilt?: Tilt;
  blend?: React.CSSProperties["mixBlendMode"];
};

/**
 * A small monospace percentage sitting just above the bar's right end.
 *
 * Deliberately dim relative to the word: it is a readout, not a title.
 * Monospace so the digits do not shuffle sideways as the number climbs.
 */
export const PercentReadout: React.FC<PercentReadoutProps> = ({
  width,
  height,
  progress,
  fontFamily,
  fontWeight,
  fontSize,
  right,
  baseline,
  color,
  scale,
  tilt = DEFAULT_TILT,
  blend = "screen",
}) => (
  <Canvas2D
    width={width}
    height={height}
    blend={blend}
    draw={(ctx) => {
      const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
      const label = `${percent}%`;

      ctx.save();
      applyTilt(ctx, width, height, tilt);
      ctx.globalCompositeOperation = "lighter";
      ctx.font = cssFont(fontWeight, fontSize, fontFamily);
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";

      ctx.globalAlpha = 0.34;
      ctx.shadowBlur = 22 * scale;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fillText(label, right, baseline);

      ctx.globalAlpha = 0.62;
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(color, 1);
      ctx.fillText(label, right, baseline);

      ctx.restore();
    }}
  />
);
