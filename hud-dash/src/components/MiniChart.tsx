import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { LOOP } from "../constants";
import { loopT, sampleSeries, series } from "../lib/anim";
import { alpha } from "../lib/color";
import { line, text, type Ctx } from "../lib/draw";
import type { Palette, Variant } from "../variants";
import { Layer } from "./Layer";

export type ChartKind = "areaChart" | "lineSpike" | "miniLines";

const grid = (ctx: Ctx, w: number, h: number, p: Palette): void => {
  for (let i = 1; i < 4; i++) {
    line(ctx, 0, (h * i) / 4, w, (h * i) / 4, alpha(p.panelBorder, 0.3), 2);
  }
  for (let i = 1; i < 6; i++) {
    line(ctx, (w * i) / 6, 0, (w * i) / 6, h, alpha(p.panelBorder, 0.22), 2);
  }
};

/**
 * All three chart kinds scroll by a whole number of tiles across the loop,
 * sampling a periodic series — so the last frame joins the first exactly.
 */
const path = (
  ctx: Ctx,
  w: number,
  h: number,
  data: number[],
  offset: number,
  steps: number,
  shape: (t: number, v: number) => number,
): void => {
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const v = sampleSeries(data, offset + t * data.length * 0.45);
    const y = shape(t, v);
    if (i === 0) {
      ctx.moveTo(0, y);
    } else {
      ctx.lineTo(t * w, y);
    }
  }
};

export const MiniChart: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ChartKind;
  seed: string;
  variant: Variant;
}> = ({ x, y, w, h, kind, seed, variant }) => {
  const frame = useCurrentFrame();
  const p = variant.palette;
  const scale = variant.panels.textScale;
  const n = variant.panels.chartSamples;
  const a = useMemo(() => series(`${seed}-a`, n, 2), [seed, n]);
  const b = useMemo(() => series(`${seed}-b`, n, 3), [seed, n]);
  const spikes = useMemo(() => series(`${seed}-s`, n, 0), [seed, n]);

  // three whole tiles of scroll per loop, so the series closes at the seam
  const offset = loopT(frame) * n * 3;
  const steps = 120;

  return (
    <Layer
      x={x}
      y={y}
      w={w}
      h={h}
      bloom={{ radius: 10, alpha: 0.34 }}
      draw={(ctx) => {
        grid(ctx, w, h, p);

        if (kind === "areaChart") {
          // amplitude decays left to right
          const shape = (t: number, v: number) =>
            h - (0.12 + v * 0.88) * h * Math.pow(1 - t, 1.35) * 0.98;
          path(ctx, w, h, a, offset, steps, shape);
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.closePath();
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, alpha(p.element, 0.85));
          g.addColorStop(1, alpha(p.element, 0.08));
          ctx.save();
          ctx.fillStyle = g;
          ctx.fill();
          ctx.restore();
          path(ctx, w, h, a, offset, steps, shape);
          ctx.save();
          ctx.strokeStyle = p.accent;
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.restore();
        }

        if (kind === "lineSpike") {
          const shape = (t: number, v: number) => {
            const sp = sampleSeries(spikes, offset * 1.0 + t * n * 0.45);
            const boost = sp > 0.93 ? (sp - 0.93) * 9 : 0;
            return h - (0.18 + v * 0.42 + boost) * h * 0.92;
          };
          path(ctx, w, h, b, offset, steps, shape);
          ctx.save();
          ctx.strokeStyle = p.accent;
          ctx.lineWidth = 4;
          ctx.lineJoin = "round";
          ctx.stroke();
          ctx.restore();
          path(ctx, w, h, b, offset - n * 0.06, steps, (t, v) =>
            h - (0.18 + v * 0.42) * h * 0.6,
          );
          ctx.save();
          ctx.strokeStyle = alpha(p.element, 0.6);
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.restore();
        }

        if (kind === "miniLines") {
          const mk = (
            data: number[],
            off: number,
            colour: string,
            lo: number,
            hi: number,
          ) => {
            path(ctx, w, h, data, off, steps, (_t, v) => h - (lo + v * hi) * h);
            ctx.save();
            ctx.strokeStyle = colour;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
          };
          mk(a, offset, p.element, 0.5, 0.42);
          mk(b, offset * -1, p.accent, 0.08, 0.38);
        }

        // playhead: one whole traversal per loop
        const px = ((frame % LOOP) / LOOP) * w;
        line(ctx, px, 0, px, h, alpha(p.pale, 0.55), 3);

        text(ctx, `${(sampleSeries(a, offset) * 100).toFixed(1)}`, w - 6, 18 * scale, {
          size: 26 * scale,
          color: p.textBright,
          weight: 700,
          align: "right",
          tabular: true,
        });
      }}
    />
  );
};
