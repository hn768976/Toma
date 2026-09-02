import React from "react";
import { Panel } from "./Panel";
import type { Rect } from "../layout";
import { PALETTE, withAlpha } from "../palette";
import { DURATION, FPS, GAUGE_SPRING_PERIOD } from "../timing";
import { monoFont, sansFont } from "../fonts";
import { smallCaps } from "@lib/draw/panel-chrome";
import { brokenArcRing, tickRing } from "@lib/draw/shapes";
import { drawGaugeArc, drawGaugeTrack } from "@lib/panels/gauge-ring";
import { steppedSpring } from "@lib/motion/stepped";

export type GaugeColumnProps = {
  rect: Rect;
  index: number;
  panelCount: number;
  frame: number;
  label: string;
  seed: string;
  count: number;
  labels: string[];
  /** Ring gauges get a value and a track; indicators are smaller and barer. */
  variant?: "gauge" | "indicator";
};

/**
 * A vertical stack of ring gauges. Each ring's arc springs to a new seeded
 * position every 90 frames — five re-targets across the loop, closing exactly
 * where it started.
 *
 * Used twice in the frame at two different sizes and densities: the three-ring
 * column on the left and the four-indicator column on the far right.
 */
export const GaugeColumn: React.FC<GaugeColumnProps> = ({
  rect,
  index,
  panelCount,
  frame,
  label,
  seed,
  count,
  labels,
  variant = "gauge",
}) => {
  const geom = (inner: Rect) => {
    const cellH = inner.h / count;
    const radius = Math.min(cellH * 0.34, inner.w * (variant === "gauge" ? 0.28 : 0.34));
    return { cellH, radius };
  };

  const drawStatic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const { cellH, radius } = geom(inner);
    for (let i = 0; i < count; i++) {
      const cx = inner.x + (variant === "gauge" ? radius + 12 : inner.w / 2);
      const cy = inner.y + cellH * i + cellH / 2;

      drawGaugeTrack(ctx, {
        cx,
        cy,
        radius,
        width: radius * 0.19,
        color: withAlpha(PALETTE.elementDim, 0.5),
      });

      tickRing(ctx, {
        cx,
        cy,
        radius: radius * 1.2,
        count: 36,
        length: radius * 0.08,
        width: 1.5,
        color: withAlpha(PALETTE.elementDim, 0.75),
        majorEvery: 9,
        majorLength: radius * 0.17,
        majorColor: withAlpha(PALETTE.textPale, 0.75),
        majorWidth: 2,
      });

      brokenArcRing(ctx, {
        cx,
        cy,
        radius: radius * 0.6,
        width: 1.5,
        color: withAlpha(PALETTE.elementDim, 0.7),
        seed: `${seed}-inner-${i}`,
        pieces: 5,
      });

      if (variant === "gauge") {
        smallCaps(ctx, labels[i % labels.length], cx + radius * 1.5, cy - 26, {
          font: sansFont(500, 26),
          color: PALETTE.textPale,
        });
        ctx.strokeStyle = withAlpha(PALETTE.elementDim, 0.45);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + radius * 1.5, cy + 34);
        ctx.lineTo(inner.x + inner.w, cy + 34);
        ctx.stroke();
      } else {
        smallCaps(ctx, labels[i % labels.length], cx, cy + radius * 1.55, {
          font: sansFont(500, 22),
          color: PALETTE.textPale,
          align: "center",
        });
      }
    }
  };

  const drawDynamic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const { cellH, radius } = geom(inner);
    for (let i = 0; i < count; i++) {
      const cx = inner.x + (variant === "gauge" ? radius + 12 : inner.w / 2);
      const cy = inner.y + cellH * i + cellH / 2;
      const v = steppedSpring({
        frame,
        fps: FPS,
        period: GAUGE_SPRING_PERIOD,
        loopLength: DURATION,
        seed: `${seed}-g${i}`,
        min: 0.1,
        max: 0.95,
      });

      const hot = i === 1 && variant === "gauge";
      drawGaugeArc(ctx, {
        cx,
        cy,
        radius,
        width: radius * 0.19,
        value: v,
        color: hot ? PALETTE.accentAmber : PALETTE.elementCyan,
        glow: radius * 0.28,
      });

      ctx.save();
      ctx.font = monoFont(500, variant === "gauge" ? radius * 0.52 : radius * 0.6);
      ctx.fillStyle = PALETTE.textBright;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(Math.round(v * 100)).padStart(2, "0"), cx, cy);
      ctx.restore();

      if (variant === "gauge") {
        ctx.fillStyle = withAlpha(PALETTE.elementDim, 0.4);
        ctx.fillRect(cx + radius * 1.5, cy + 6, inner.x + inner.w - (cx + radius * 1.5), 8);
        ctx.fillStyle = PALETTE.elementCyan;
        ctx.fillRect(
          cx + radius * 1.5,
          cy + 6,
          (inner.x + inner.w - (cx + radius * 1.5)) * v,
          8,
        );
      }
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
