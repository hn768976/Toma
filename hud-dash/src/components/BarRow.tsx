import React from "react";
import { useCurrentFrame } from "remotion";
import { steppedSpring } from "../lib/anim";
import { alpha } from "../lib/color";
import { line, text, type Ctx } from "../lib/draw";
import type { Palette, Variant } from "../variants";
import { Layer } from "./Layer";

const CODES = "AB CD EF GH IJ KL MN PQ RS TU".split(" ");

/** Horizontal bars of varying fill, each with a tiny label. */
export const drawBarRow = (
  ctx: Ctx,
  w: number,
  h: number,
  count: number,
  seed: string,
  frame: number,
  p: Palette,
  scale: number,
): void => {
  const gap = h * 0.16 / count;
  const bh = (h - gap * (count - 1)) / count;
  const labelW = 62 * scale;
  const valueW = 76 * scale;
  const trackX = labelW + 12 * scale;
  const trackW = w - trackX - valueW;

  for (let i = 0; i < count; i++) {
    const y = i * (bh + gap);
    // staggered cycles: 65 frames, offset per bar
    const fill = steppedSpring(frame, `${seed}-bar-${i}`, 65, 0.14, 0.98, i * 7);

    text(ctx, CODES[i % CODES.length], 0, y + bh / 2, {
      size: Math.min(bh * 0.72, 26 * scale),
      color: p.textPale,
      weight: 600,
      tracking: 2,
    });

    ctx.save();
    ctx.fillStyle = alpha(p.panelBorder, 0.3);
    ctx.fillRect(trackX, y, trackW, bh);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = i % 3 === 0 ? p.accent : p.element;
    ctx.fillRect(trackX, y, trackW * fill, bh);
    ctx.restore();

    // notch ticks along the track
    for (let n = 1; n < 10; n++) {
      const nx = trackX + (trackW * n) / 10;
      line(ctx, nx, y, nx, y + bh, p.panelFill, 2, 0.65);
    }

    text(ctx, `${(fill * 100).toFixed(0)}%`, w, y + bh / 2, {
      size: Math.min(bh * 0.78, 28 * scale),
      color: p.textBright,
      weight: 700,
      align: "right",
      tabular: true,
    });
  }
};

/** Vertical bar chart — the left column's spectrum panel. */
export const drawBarChart = (
  ctx: Ctx,
  w: number,
  h: number,
  count: number,
  seed: string,
  frame: number,
  p: Palette,
): void => {
  const gap = w * 0.3 / count;
  const bw = (w - gap * (count - 1)) / count;
  const base = h;

  line(ctx, 0, base, w, base, alpha(p.panelBorder, 0.9), 2);
  for (let g = 1; g <= 3; g++) {
    const gy = base - (h * g) / 4;
    line(ctx, 0, gy, w, gy, alpha(p.panelBorder, 0.35), 2);
  }

  for (let i = 0; i < count; i++) {
    const x = i * (bw + gap);
    const v = steppedSpring(frame, `${seed}-vb-${i}`, 65, 0.1, 1, i * 5);
    const bh = v * (h - 6);
    ctx.save();
    ctx.fillStyle = i % 4 === 1 ? p.accent : p.element;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(x, base - bh, bw, bh);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = p.pale;
    ctx.fillRect(x, base - bh - 5, bw, 5);
    ctx.restore();
  }
};

export const BarRow: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  seed: string;
  variant: Variant;
  orientation?: "horizontal" | "vertical";
  count?: number;
}> = ({ x, y, w, h, seed, variant, orientation = "horizontal", count }) => {
  const frame = useCurrentFrame();
  const scale = variant.panels.textScale;
  const n = count ?? variant.panels.barRowCount;
  return (
    <Layer
      x={x}
      y={y}
      w={w}
      h={h}
      bloom={{ radius: 9, alpha: 0.3 }}
      draw={(ctx) => {
        if (orientation === "horizontal") {
          drawBarRow(ctx, w, h, n, seed, frame, variant.palette, scale);
        } else {
          drawBarChart(ctx, w, h, n, seed, frame, variant.palette);
        }
      }}
    />
  );
};
