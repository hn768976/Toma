import React from "react";
import type { Palette } from "./variants";
import { rgba } from "./color";
import { useCanvasPass } from "./useCanvasPass";

/**
 * Near-black ground with one broad, soft radial wash in the palette's mid hue
 * behind the centre, falling away to black at the corners. No grid, no
 * geometry, no particles — the notation is the only content in the frame.
 */
export const BackgroundWash: React.FC<{
  buffer: HTMLCanvasElement;
  palette: Palette;
  width: number;
  height: number;
}> = ({ buffer, palette, width, height }) => {
  useCanvasPass(() => {
    const ctx = buffer.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.deep;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height * 0.48;
    const r = width * 0.66;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, (height / width) * 1.22);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, rgba(palette.wash, 0.92));
    g.addColorStop(0.28, rgba(palette.wash, 0.6));
    g.addColorStop(0.55, rgba(palette.wash, 0.26));
    g.addColorStop(0.78, rgba(palette.wash, 0.07));
    g.addColorStop(1, rgba(palette.wash, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  return null;
};
