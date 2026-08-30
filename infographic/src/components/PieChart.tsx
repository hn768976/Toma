import React, { useMemo } from "react";
import type { PanelSpec } from "../layout";
import { font } from "../fonts";
import { makeCanvas, rndInt, rndRange, type Ctx } from "../draw/primitives";
import { drawPanelHeading } from "../draw/chrome";
import { usePanelPainter, usePlane } from "./PlaneContext";

const TAU = Math.PI * 2;
const START = -Math.PI / 2;

export const PieChart: React.FC<{ panel: PanelSpec }> = ({ panel }) => {
  const { variant } = usePlane();
  const scale = variant.contentScale;
  const top = 70 * scale;

  const cx = panel.w / 2;
  const cy = top + (panel.h - top) * 0.5;
  const r = Math.min(panel.w * 0.4, (panel.h - top) * 0.42);

  const wedges = useMemo(() => {
    const count = rndInt(`${panel.seed}-n`, 3, 5);
    const raw: number[] = [];
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const v = rndRange(`${panel.seed}-w${i}`, 0.5, 1.6);
      raw.push(v);
      sum += v;
    }
    const exploded = rndInt(`${panel.seed}-x`, 0, count - 1);
    let acc = 0;
    return raw.map((v, i) => {
      const frac = v / sum;
      const w = {
        from: acc,
        to: acc + frac,
        tone: variant.chart.wedgeTones[i % variant.chart.wedgeTones.length],
        exploded: i === exploded,
      };
      acc += frac;
      return w;
    });
  }, [panel.seed, variant.chart.wedgeTones]);

  const staticLayer = useMemo(() => {
    const c = makeCanvas(panel.w, panel.h);
    const ctx = c.getContext("2d") as Ctx;
    drawPanelHeading(ctx, variant, panel.seed, panel.w, scale);
    ctx.font = font(500, 16 * scale);
    ctx.textAlign = "center";
    ctx.fillStyle = variant.palette.textDim;
    ctx.fillText("composition, indexed", cx, cy + r + 40 * scale, panel.w * 0.9);
    ctx.textAlign = "left";
    return c;
  }, [panel.w, panel.h, panel.seed, variant, scale, cx, cy, r]);

  usePanelPainter(panel, (ctx, api) => {
    ctx.drawImage(staticLayer, 0, 0);

    // Wedges sweep in sequentially: each owns its own slice of the shared
    // timeline, so the circle fills once, in order.
    for (const w of wedges) {
      const local = Math.min(
        1,
        Math.max(0, (api.t - w.from) / Math.max(1e-6, w.to - w.from)),
      );
      if (local <= 0) {
        continue;
      }
      const a0 = START + TAU * w.from;
      const a1 = a0 + TAU * (w.to - w.from) * local;
      const mid = (a0 + a1) / 2;
      const off = w.exploded ? r * 0.11 : 0;

      ctx.save();
      ctx.translate(Math.cos(mid) * off, Math.sin(mid) * off);
      ctx.fillStyle = w.tone;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = variant.palette.background;
      ctx.lineWidth = Math.max(2, 3 * scale);
      ctx.stroke();
      ctx.restore();
    }
  });

  return null;
};
