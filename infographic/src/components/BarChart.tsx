import React, { useMemo } from "react";
import type { PanelSpec } from "../layout";
import { font } from "../fonts";
import {
  drawTabular,
  makeCanvas,
  rndInt,
  rndRange,
  type Ctx,
} from "../draw/primitives";
import { clearGlow, drawPanelHeading, withGlow } from "../draw/chrome";
import { usePanelPainter, usePlane } from "./PlaneContext";

type Bar = { value: number; tone: string };

export const BarChart: React.FC<{ panel: PanelSpec }> = ({ panel }) => {
  const { variant } = usePlane();
  const scale = variant.contentScale;
  const tones = variant.chart.barTones;

  const bars: Bar[] = useMemo(() => {
    const count = rndInt(`${panel.seed}-n`, 7, 12);
    const out: Bar[] = [];
    for (let i = 0; i < count; i++) {
      out.push({
        value: rndRange(`${panel.seed}-v${i}`, 0.18, 1),
        tone: tones[rndInt(`${panel.seed}-t${i}`, 0, tones.length - 1)],
      });
    }
    return out;
  }, [panel.seed, tones]);

  const top = 70 * scale;
  const labelBand = 30 * scale;
  const baseline = panel.h - labelBand;
  const plotTop = top + 16 * scale;
  const plotH = baseline - plotTop;
  const slot = panel.w / bars.length;
  const barW = slot * 0.62;

  const staticLayer = useMemo(() => {
    const c = makeCanvas(panel.w, panel.h);
    const ctx = c.getContext("2d") as Ctx;
    drawPanelHeading(ctx, variant, panel.seed, panel.w, scale);

    // Faint gridlines and the shared baseline.
    ctx.strokeStyle = variant.palette.textDim;
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.globalAlpha = 0.22;
    for (let i = 1; i <= 4; i++) {
      const y = baseline - (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(panel.w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = variant.palette.inkGrey;
    ctx.lineWidth = Math.max(1.5, 2.4 * scale);
    ctx.beginPath();
    ctx.moveTo(0, baseline);
    ctx.lineTo(panel.w, baseline);
    ctx.stroke();
    return c;
  }, [panel.w, panel.h, panel.seed, variant, scale, baseline, plotH]);

  usePanelPainter(panel, (ctx, api) => {
    ctx.drawImage(staticLayer, 0, 0);

    ctx.font = font(500, 15 * scale);
    ctx.textBaseline = "alphabetic";

    bars.forEach((bar, i) => {
      const x = i * slot + (slot - barW) / 2;
      const value = bar.value * api.t;
      const bh = plotH * value;

      if (bh > 0.5) {
        withGlow(ctx, variant, bar.tone);
        ctx.fillStyle = bar.tone;
        // Bars grow from the baseline upward.
        ctx.fillRect(x, baseline - bh, barW, bh);
        clearGlow(ctx);
      }

      // Small numeric label beneath each bar. A few of them flicker as they
      // change, which is the only secondary motion on this panel.
      const shown = Math.round(bar.value * 100 * api.t);
      const before = Math.round(bar.value * 100 * api.tPrev);
      const flickers = rndRange(`${panel.seed}-f${i}`, 0, 1) > 0.72;
      ctx.globalAlpha = flickers && shown !== before ? 0.42 : 1;
      ctx.fillStyle = variant.palette.textDim;
      drawTabular(
        ctx,
        String(shown).padStart(2, "0"),
        x + barW / 2,
        baseline + 21 * scale,
        "center",
      );
      ctx.globalAlpha = 1;
    });
  });

  return null;
};
