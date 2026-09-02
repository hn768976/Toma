import React from "react";
import { Panel } from "./Panel";
import type { Rect } from "../layout";
import { PALETTE, withAlpha } from "../palette";
import { DURATION, FPS } from "../timing";
import { monoFont, sansFont } from "../fonts";
import { smallCaps } from "@lib/draw/panel-chrome";
import { steppedSpring, steppedValue } from "@lib/motion/stepped";

export type ReadoutPanelProps = {
  rect: Rect;
  index: number;
  panelCount: number;
  frame: number;
  label: string;
  unit: string;
  seed: string;
  /** The one amber corner flag. Used on exactly two readouts in the frame. */
  flagged?: boolean;
};

/** A large tabular value with a small label, a track bar and a delta line. */
export const ReadoutPanel: React.FC<ReadoutPanelProps> = ({
  rect,
  index,
  panelCount,
  frame,
  label,
  unit,
  seed,
  flagged = false,
}) => {
  const drawStatic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    ctx.strokeStyle = withAlpha(PALETTE.elementDim, 0.55);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y + inner.h - 54);
    ctx.lineTo(inner.x + inner.w, inner.y + inner.h - 54);
    ctx.stroke();
    smallCaps(ctx, unit, inner.x + inner.w, inner.y + 20, {
      font: sansFont(500, 24),
      color: PALETTE.textPale,
      align: "right",
    });
  };

  const drawDynamic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const { value } = steppedValue({
      frame,
      period: 90,
      loopLength: DURATION,
      seed: `${seed}-val`,
      min: 10,
      max: 99,
    });
    const bar = steppedSpring({
      frame,
      fps: FPS,
      period: 90,
      loopLength: DURATION,
      seed: `${seed}-bar`,
      min: 0.18,
      max: 0.96,
    });

    ctx.save();
    ctx.font = monoFont(700, 118);
    ctx.fillStyle = PALETTE.textBright;
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = withAlpha(PALETTE.elementCyan, 0.7);
    ctx.shadowBlur = 18;
    ctx.fillText(String(Math.floor(value)), inner.x, inner.y + 112);
    ctx.restore();

    // The rationed amber: a small corner flag, nothing more.
    if (flagged) {
      ctx.fillStyle = PALETTE.accentAmber;
      ctx.beginPath();
      ctx.moveTo(inner.x + 150, inner.y + 112);
      ctx.lineTo(inner.x + 196, inner.y + 112);
      ctx.lineTo(inner.x + 196, inner.y + 66);
      ctx.closePath();
      ctx.fill();
    }

    smallCaps(ctx, label, inner.x, inner.y + inner.h - 78, {
      font: sansFont(500, 26),
      color: PALETTE.textPale,
    });

    const trackY = inner.y + inner.h - 34;
    ctx.fillStyle = withAlpha(PALETTE.elementDim, 0.45);
    ctx.fillRect(inner.x, trackY, inner.w, 10);
    ctx.fillStyle = PALETTE.elementCyan;
    ctx.fillRect(inner.x, trackY, inner.w * bar, 10);

    ctx.save();
    ctx.font = monoFont(400, 22);
    ctx.fillStyle = withAlpha(PALETTE.textPale, 0.85);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${(bar * 100).toFixed(1)}%`, inner.x + inner.w, inner.y + inner.h - 78);
    ctx.restore();
  };

  return (
    <Panel
      rect={rect}
      index={index}
      panelCount={panelCount}
      frame={frame}
      label={`${label} readout`}
      drawStatic={drawStatic}
      drawDynamic={drawDynamic}
    />
  );
};
