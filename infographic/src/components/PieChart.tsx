import React, { useMemo } from "react";
import type { PanelSpec } from "../layout";
import { font } from "../fonts";
import {
  fillerWords,
  makeCanvas,
  rndInt,
  rndRange,
  type Ctx,
} from "../draw/primitives";
import { drawPanelHeading } from "../draw/chrome";
import {
  circleLayout,
  drawLegendStatic,
  drawLegendValues,
} from "../draw/legend";
import { usePanelPainter, usePlane } from "./PlaneContext";

const TAU = Math.PI * 2;
const START = -Math.PI / 2;

export const PieChart: React.FC<{ panel: PanelSpec }> = ({ panel }) => {
  const { variant } = usePlane();
  const scale = variant.contentScale;
  const top = 70 * scale;

  const geo = circleLayout(panel.w, panel.h, top, 0.82);
  const { cx, cy, r } = geo;

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

  const legendLabels = useMemo(
    () => fillerWords(`${panel.seed}-leg`, 5),
    [panel.seed],
  );

  const staticLayer = useMemo(() => {
    const c = makeCanvas(panel.w, panel.h);
    const ctx = c.getContext("2d") as Ctx;
    drawPanelHeading(ctx, variant, panel.seed, panel.w, scale);
    ctx.font = font(500, 16 * scale);
    ctx.textAlign = "center";
    ctx.fillStyle = variant.palette.textDim;
    ctx.fillText("composition, indexed", cx, cy + r + 40 * scale, r * 2.2);
    ctx.textAlign = "left";
    if (geo.legend) {
      drawLegendStatic(
        ctx,
        variant,
        geo.legend,
        wedges.map((w, i) => ({ tone: w.tone, label: legendLabels[i] })),
        scale,
      );
    }
    return c;
  }, [
    panel.w,
    panel.h,
    panel.seed,
    variant,
    scale,
    cx,
    cy,
    r,
    geo.legend,
    wedges,
    legendLabels,
  ]);

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

    if (geo.legend) {
      drawLegendValues(
        ctx,
        variant,
        geo.legend,
        wedges.map((w) => {
          const local = Math.min(
            1,
            Math.max(0, (api.t - w.from) / Math.max(1e-6, w.to - w.from)),
          );
          return (w.to - w.from) * local;
        }),
        scale,
      );
    }
  });

  return null;
};
