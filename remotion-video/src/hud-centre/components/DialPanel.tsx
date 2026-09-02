import React from "react";
import { Panel } from "./Panel";
import type { Rect } from "../layout";
import { PALETTE, withAlpha } from "../palette";
import { DURATION, FPS } from "../timing";
import { monoFont, sansFont } from "../fonts";
import { smallCaps } from "@lib/draw/panel-chrome";
import { brokenArcRing, tickRing } from "@lib/draw/shapes";
import { steppedSpring } from "@lib/motion/stepped";

export type DialPanelProps = {
  rect: Rect;
  index: number;
  panelCount: number;
  frame: number;
  label: string;
  seed: string;
};

/** Bottom-centre-left: a single circular gauge ringed with fine radial ticks,
 *  a needle and a swept sector. */
export const DialPanel: React.FC<DialPanelProps> = ({
  rect,
  index,
  panelCount,
  frame,
  label,
  seed,
}) => {
  const centre = (inner: Rect) => ({
    cx: inner.x + inner.w / 2,
    cy: inner.y + inner.h / 2,
    radius: Math.min(inner.w, inner.h) / 2 - 30,
  });

  const drawStatic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const { cx, cy, radius } = centre(inner);

    tickRing(ctx, {
      cx,
      cy,
      radius: radius * 0.86,
      count: 120,
      length: radius * 0.05,
      width: 1.5,
      color: withAlpha(PALETTE.elementDim, 0.85),
      majorEvery: 10,
      majorLength: radius * 0.12,
      majorColor: withAlpha(PALETTE.textPale, 0.9),
      majorWidth: 2,
    });

    ctx.strokeStyle = withAlpha(PALETTE.elementDim, 0.85);
    ctx.lineWidth = 2;
    for (const r of [radius, radius * 0.55, radius * 0.32]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    brokenArcRing(ctx, {
      cx,
      cy,
      radius: radius * 0.72,
      width: 3,
      color: withAlpha(PALETTE.elementDim, 0.9),
      seed: `${seed}-ring`,
      pieces: 6,
    });

    ctx.strokeStyle = PALETTE.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      smallCaps(
        ctx,
        String(i * 30).padStart(3, "0"),
        cx + Math.cos(a) * (radius * 0.98 + 14),
        cy + Math.sin(a) * (radius * 0.98 + 14),
        { font: sansFont(500, 17), color: withAlpha(PALETTE.textPale, 0.7), align: "center" },
      );
    }
  };

  const drawDynamic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const { cx, cy, radius } = centre(inner);
    const v = steppedSpring({
      frame,
      fps: FPS,
      period: 90,
      loopLength: DURATION,
      seed: `${seed}-needle`,
      min: 0,
      max: 1,
    });
    const a = -Math.PI / 2 + v * Math.PI * 2;

    // Swept sector behind the needle.
    ctx.save();
    ctx.fillStyle = withAlpha(PALETTE.elementCyan, 0.16);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius * 0.82, a - 0.5, a);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = PALETTE.elementCyan;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.shadowColor = PALETTE.elementCyan;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * radius * 0.16, cy - Math.sin(a) * radius * 0.16);
    ctx.lineTo(cx + Math.cos(a) * radius * 0.82, cy + Math.sin(a) * radius * 0.82);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = PALETTE.textBright;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.font = monoFont(500, 30);
    ctx.fillStyle = PALETTE.textBright;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${String(Math.round(v * 359)).padStart(3, "0")}`, cx, cy + radius * 0.44);
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
