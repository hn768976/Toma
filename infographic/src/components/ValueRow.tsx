import React, { useMemo } from "react";
import type { PanelSpec } from "../layout";
import { font } from "../fonts";
import {
  drawTabular,
  makeCanvas,
  rndInt,
  rndRange,
  withAlpha,
  type Ctx,
} from "../draw/primitives";
import { drawPanelHeading } from "../draw/chrome";
import { usePanelPainter, usePlane } from "./PlaneContext";

/**
 * A group of three or four rows. Each is a coloured bar carrying its own
 * numeric label, set against a longer neutral bar: a progress comparison.
 */
export const ValueRow: React.FC<{ panel: PanelSpec }> = ({ panel }) => {
  const { variant } = usePlane();
  const scale = variant.contentScale;
  const top = 70 * scale;

  const rows = useMemo(() => {
    const count = rndInt(`${panel.seed}-n`, 3, 4);
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push({
        value: rndRange(`${panel.seed}-v${i}`, 0.22, 0.94),
        ceiling: rndRange(`${panel.seed}-c${i}`, 0.82, 1),
        tone:
          variant.chart.barTones[
            rndInt(`${panel.seed}-t${i}`, 0, variant.chart.barTones.length - 1)
          ],
      });
    }
    return out;
  }, [panel.seed, variant.chart.barTones]);

  const avail = panel.h - top;
  const rowH = Math.min(62 * scale, (avail / rows.length) * 0.56);
  const gap = Math.min(38 * scale, (avail - rowH * rows.length) / rows.length);
  const blockH = rows.length * rowH + (rows.length - 1) * gap;
  const y0 = top + (avail - blockH) / 2;

  const staticLayer = useMemo(() => {
    const c = makeCanvas(panel.w, panel.h);
    const ctx = c.getContext("2d") as Ctx;
    drawPanelHeading(ctx, variant, panel.seed, panel.w, scale);
    rows.forEach((row, i) => {
      const y = y0 + i * (rowH + gap);
      ctx.fillStyle = withAlpha(
        variant.palette.inkGrey,
        variant.chart.neutralAlpha,
      );
      ctx.fillRect(0, y, panel.w * row.ceiling, rowH);
    });
    return c;
  }, [panel.w, panel.h, panel.seed, variant, scale, rows, y0, rowH, gap]);

  usePanelPainter(panel, (ctx, api) => {
    ctx.drawImage(staticLayer, 0, 0);
    ctx.textBaseline = "middle";
    ctx.font = font(700, rowH * 0.46);

    rows.forEach((row, i) => {
      const y = y0 + i * (rowH + gap);
      const w = panel.w * row.value * api.t;
      if (w > 0.5) {
        ctx.fillStyle = row.tone;
        ctx.fillRect(0, y, w, rowH);
      }
      const shown = Math.round(row.value * 1000 * api.t);
      const label = String(shown).padStart(4, "0");
      const inside = w > rowH * 3.2;
      ctx.fillStyle = inside
        ? variant.palette.counterText
        : variant.palette.textDim;
      drawTabular(
        ctx,
        label,
        inside ? w - rowH * 0.4 : w + rowH * 0.4,
        y + rowH / 2,
        inside ? "right" : "left",
      );
    });
    ctx.textBaseline = "alphabetic";
  });

  return null;
};
