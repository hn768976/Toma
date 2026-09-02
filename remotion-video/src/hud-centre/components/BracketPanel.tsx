import React from "react";
import { Panel } from "./Panel";
import type { Rect } from "../layout";
import { PALETTE, withAlpha } from "../palette";
import { sansFont } from "../fonts";
import { smallCaps } from "@lib/draw/panel-chrome";
import { irregularDashes } from "@lib/draw/shapes";

export type BracketPanelProps = {
  rect: Rect;
  index: number;
  panelCount: number;
  frame: number;
  label: string;
  seed: string;
};

/**
 * The bracket-framed "empty" panel: corner ticks, a centred reticle, a faint
 * dot field and a broken measurement rule. Empty of data, not empty of image —
 * a genuinely blank rectangle this size punches a hole in the composition.
 */
export const BracketPanel: React.FC<BracketPanelProps> = ({
  rect,
  index,
  panelCount,
  frame,
  label,
  seed,
}) => {
  const drawStatic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    // Dot field.
    ctx.fillStyle = withAlpha(PALETTE.gridLine, 0.9);
    const step = 34;
    for (let x = inner.x + step / 2; x < inner.x + inner.w; x += step) {
      for (let y = inner.y + step / 2; y < inner.y + inner.h; y += step) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    const cx = inner.x + inner.w / 2;
    const cy = inner.y + inner.h / 2 - 10;
    const arm = 74;
    const gap = 26;

    // Reticle: four corner brackets around a crosshair.
    ctx.strokeStyle = withAlpha(PALETTE.textPale, 0.9);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      ctx.moveTo(cx + sx * arm, cy + sy * (arm - 34));
      ctx.lineTo(cx + sx * arm, cy + sy * arm);
      ctx.lineTo(cx + sx * (arm - 34), cy + sy * arm);
    }
    ctx.stroke();

    ctx.strokeStyle = withAlpha(PALETTE.elementCyan, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - gap, cy);
    ctx.lineTo(cx + gap, cy);
    ctx.moveTo(cx, cy - gap);
    ctx.lineTo(cx, cy + gap);
    ctx.stroke();

    // Broken measurement rule along the bottom.
    const ruleY = inner.y + inner.h - 26;
    ctx.strokeStyle = withAlpha(PALETTE.elementDim, 0.9);
    ctx.lineWidth = 2;
    for (const d of irregularDashes(`${seed}-rule`, inner.w, 13, 0.2, 0.85)) {
      ctx.beginPath();
      ctx.moveTo(inner.x + d.start, ruleY);
      ctx.lineTo(inner.x + d.start + d.length, ruleY);
      ctx.stroke();
    }
    smallCaps(ctx, "no signal", cx, inner.y + inner.h - 62, {
      font: sansFont(500, 24),
      color: withAlpha(PALETTE.textPale, 0.6),
      align: "center",
    });
  };

  return (
    <Panel
      rect={rect}
      index={index}
      panelCount={panelCount}
      frame={frame}
      label={label}
      drawStatic={drawStatic}
    />
  );
};
