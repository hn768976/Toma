/**
 * <PercentDial> — a numeric value inside a thin circle with a broken outer ring.
 *
 * The readout kind comes from config: "percent" counts the acquisition, while
 * "confidence" swaps in a small filled bar beneath the number. Both share the
 * same chrome, so the panel set changes without a second component.
 */
import React, { useEffect, useRef } from "react";
import { monoFont, sansFont } from "../fonts";
import { tickRing, useOffscreen, withAlpha } from "../shared/draw";
import type { Rect } from "../layout";
import type { Palette, ReadoutConfig } from "../variants";

export const PercentDial: React.FC<{
  rect: Rect;
  palette: Palette;
  readout: ReadoutConfig;
  /** Already quantised by the caller so it jumps rather than counting smoothly. */
  value: number;
  /** 0..1, drives the confidence bar. */
  fill: number;
}> = ({ rect, palette, readout, value, fill }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const cx = rect.w / 2;
  const cy = rect.h * 0.44;
  const r = rect.w * 0.3;

  const chrome = useOffscreen(
    rect.w,
    rect.h,
    (ctx) => {
      ctx.strokeStyle = withAlpha(palette.panelBorder, 0.9);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      tickRing(ctx, cx, cy, r * 1.34, withAlpha(palette.panelBorder, 0.95), {
        ticks: 60,
        tickLength: 8,
        thickness: 2.5,
        breaks: 4,
        seed: "dial-ring",
        everyNthLong: 5,
      });
    },
    [rect.w, rect.h, palette, cx, cy, r],
  );

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, rect.w, rect.h);
    ctx.drawImage(chrome, 0, 0);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Monospace figures: inherently tabular, so digits never shift the layout.
    const text =
      readout.kind === "percent" ? `${Math.round(value)}%` : value.toFixed(1);
    ctx.font = monoFont(readout.kind === "percent" ? 74 : 64, 500);
    ctx.fillStyle = palette.textBright;
    ctx.fillText(text, cx, cy - (readout.kind === "confidence" ? 12 : 0));

    if (readout.kind === "confidence") {
      const bw = r * 1.25;
      const bh = 13;
      const bx = cx - bw / 2;
      const by = cy + 34;
      ctx.strokeStyle = withAlpha(palette.panelBorder, 0.95);
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = palette.textBright;
      ctx.fillRect(bx + 2, by + 2, Math.max(0, (bw - 4) * fill), bh - 4);
    }

    ctx.font = sansFont(25, 600);
    ctx.fillStyle = palette.textPale;
    ctx.letterSpacing = "5px";
    ctx.fillText(readout.label, cx, cy + r * 1.72);
    ctx.letterSpacing = "0px";
  });

  return (
    <canvas
      ref={ref}
      width={rect.w}
      height={rect.h}
      style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    />
  );
};
