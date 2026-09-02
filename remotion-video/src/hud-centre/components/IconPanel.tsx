import React from "react";
import { Panel } from "./Panel";
import type { Rect } from "../layout";
import { PALETTE, withAlpha } from "../palette";
import { pulseEnvelope } from "@lib/motion/stepped";

export type IconGlyph = "aperture" | "sector";

export type IconPanelProps = {
  rect: Rect;
  index: number;
  panelCount: number;
  frame: number;
  glyph: IconGlyph;
  seed: string;
};

/**
 * A small square panel carrying one abstract instrument glyph. Deliberately
 * non-representational — no marks, no logos, just technical shapes.
 */
export const IconPanel: React.FC<IconPanelProps> = ({
  rect,
  index,
  panelCount,
  frame,
  glyph,
}) => {
  const drawStatic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const cx = inner.x + inner.w / 2;
    const cy = inner.y + inner.h / 2;
    const r = Math.min(inner.w, inner.h) * 0.42;

    ctx.strokeStyle = withAlpha(PALETTE.elementDim, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    if (glyph === "aperture") {
      // Six blades meeting off-centre, iris style.
      ctx.strokeStyle = withAlpha(PALETTE.textPale, 0.85);
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const b = a + (Math.PI * 2) / 6;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
        ctx.lineTo(cx + Math.cos(b) * r * 0.34, cy + Math.sin(b) * r * 0.34);
        ctx.stroke();
      }
    } else {
      // Four quadrant arcs with a gap at each axis.
      ctx.strokeStyle = withAlpha(PALETTE.textPale, 0.85);
      ctx.lineWidth = 7;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.22;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.62, a, a + Math.PI / 2 - 0.44);
        ctx.stroke();
      }
      ctx.fillStyle = withAlpha(PALETTE.elementCyan, 0.9);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawDynamic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const cx = inner.x + inner.w / 2;
    const cy = inner.y + inner.h / 2;
    const r = Math.min(inner.w, inner.h) * 0.42;
    const glow = pulseEnvelope(frame, 90, glyph === "aperture" ? 0 : 45, 18);
    if (glow <= 0) return;
    ctx.save();
    ctx.globalAlpha = glow * 0.7;
    ctx.strokeStyle = PALETTE.elementCyan;
    ctx.lineWidth = 3;
    ctx.shadowColor = PALETTE.elementCyan;
    ctx.shadowBlur = 20 * glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  return (
    <Panel
      rect={rect}
      index={index}
      panelCount={panelCount}
      frame={frame}
      drawStatic={drawStatic}
      drawDynamic={drawDynamic}
    />
  );
};
