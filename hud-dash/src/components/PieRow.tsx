import React from "react";
import { useCurrentFrame } from "remotion";
import { LOOP } from "../constants";
import { LAYOUT } from "../layout";
import { sampleSeries, series, steppedSpring, wrap } from "../lib/anim";
import { alpha } from "../lib/color";
import { ring, text, type Ctx } from "../lib/draw";
import type { Palette, Variant } from "../variants";
import { Layer } from "./Layer";

const TAU = Math.PI * 2;

/**
 * One pie: three segments whose angles re-settle on a slow spring cycle,
 * with a percentage label beneath.
 */
export const drawPie = (
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  seed: string,
  frame: number,
  p: Palette,
  labelY: number | null,
  labelSize: number,
): void => {
  const a = steppedSpring(frame, `${seed}-a`, 130, 0.18, 0.62);
  const b = steppedSpring(frame, `${seed}-b`, 130, 0.12, 0.4, 65);
  const total = a + b;
  const parts: { span: number; color: string }[] = [
    { span: a, color: p.element },
    { span: b, color: p.accent },
    { span: Math.max(0.04, 1 - total), color: alpha(p.panelBorder, 0.55) },
  ];

  let cursor = -Math.PI / 2;
  for (const part of parts) {
    const to = cursor + part.span * TAU;
    ctx.save();
    ctx.fillStyle = part.color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, cursor, to);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    cursor = to;
  }

  // knock the middle out so it reads as a HUD pie, not a business chart
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.42, 0, TAU);
  ctx.fill();
  ctx.restore();

  ring(ctx, cx, cy, r + 6, alpha(p.pale, 0.7), 2);

  if (labelY !== null) {
    text(ctx, `${(a * 100).toFixed(0)}%`, cx, labelY, {
      size: labelSize,
      color: p.textBright,
      weight: 700,
      align: "center",
      tabular: true,
    });
  }
};

/** Short horizontal waveform strip. */
export const drawWave = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  data: number[],
  frame: number,
  p: Palette,
  scrollSamples: number,
): void => {
  const offset = (wrap(frame) / LOOP) * scrollSamples;
  ctx.save();
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s = sampleSeries(data, offset + t * data.length * 0.5);
    const yy = y + h / 2 + Math.sin(t * 22 + s * 9) * h * 0.36 * (0.35 + s);
    if (i === 0) {
      ctx.moveTo(x, yy);
    } else {
      ctx.lineTo(x + t * w, yy);
    }
  }
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = alpha(p.panelBorder, 0.6);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
  ctx.restore();
};

/**
 * The centre-bottom cluster: three pies with percentage labels and a short
 * waveform strip between them.
 */
export const CentrePieRow: React.FC<{ variant: Variant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { cy, r, xs, labelY, wave } = LAYOUT.pieRow;
  const x0 = xs[0] - r - 40;
  const x1 = xs[2] + r + 40;
  const w = x1 - x0;
  const top = cy - r - 40;
  const h = labelY + 40 - top;
  const data = React.useMemo(
    () => series(`${variant.name}-centre-wave`, 96, 2),
    [variant.name],
  );

  return (
    <Layer
      x={x0}
      y={top}
      w={w}
      h={h}
      bloom={{ radius: 12, alpha: 0.38 }}
      draw={(ctx) => {
        xs.forEach((x, i) => {
          drawPie(
            ctx,
            x - x0,
            cy - top,
            r,
            `${variant.name}-centre-pie-${i}`,
            frame,
            variant.palette,
            labelY - top,
            40,
          );
        });
        for (let i = 0; i < 2; i++) {
          const mid = (xs[i] + xs[i + 1]) / 2 - x0;
          drawWave(
            ctx,
            mid - wave.w / 2,
            cy - top - wave.h / 2,
            wave.w,
            wave.h,
            data,
            frame,
            variant.palette,
            i === 0 ? 96 : 192,
          );
        }
      }}
    />
  );
};

/** Row of small pie indicators inside a left-column panel. */
export const PieRow: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  seed: string;
  variant: Variant;
}> = ({ x, y, w, h, seed, variant }) => {
  const frame = useCurrentFrame();
  const scale = variant.panels.textScale;
  const r = Math.min(h * 0.34, w / 8);
  return (
    <Layer
      x={x}
      y={y}
      w={w}
      h={h}
      bloom={{ radius: 9, alpha: 0.3 }}
      draw={(ctx) => {
        [0.18, 0.5, 0.82].forEach((f, i) => {
          drawPie(
            ctx,
            w * f,
            h * 0.42,
            r,
            `${seed}-pie-${i}`,
            frame,
            variant.palette,
            h * 0.42 + r + 30 * scale,
            30 * scale,
          );
        });
      }}
    />
  );
};
