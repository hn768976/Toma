import type { Variant } from "../theme";
import { font } from "../fonts";
import { drawTabular, type Ctx } from "./primitives";

export type CircleLayout = {
  cx: number;
  cy: number;
  r: number;
  /** Null when the panel is square enough that the circle fills it alone. */
  legend: { x: number; y: number; w: number; h: number } | null;
};

/**
 * Circle charts have to sit in whatever slot the layout array gives them. Where
 * the panel is close to square the circle simply fills it, exactly as the brief
 * describes. Where the panel is much wider or taller, the leftover strip
 * becomes a small legend rather than dead paper.
 */
export const circleLayout = (
  w: number,
  h: number,
  top: number,
  fill: number,
): CircleLayout => {
  const availH = h - top;
  const size = Math.min(w, availH);
  const slackW = w - size;
  const slackH = availH - size;
  const gap = size * 0.06;

  if (slackW > size * 0.35) {
    const r = (size * fill) / 2;
    return {
      cx: size / 2,
      cy: top + size / 2,
      r,
      legend: { x: size + gap, y: top, w: slackW - gap, h: size },
    };
  }
  if (slackH > size * 0.3) {
    const r = (size * fill) / 2;
    return {
      cx: w / 2,
      cy: top + size / 2,
      r,
      legend: { x: 0, y: top + size + gap, w, h: slackH - gap },
    };
  }
  return {
    cx: w / 2,
    cy: top + availH / 2,
    r: (Math.min(w, availH) * fill) / 2,
    legend: null,
  };
};

export type LegendRow = { tone: string; label: string };

/** The static half of a legend: swatch and label per row. */
export const drawLegendStatic = (
  ctx: Ctx,
  variant: Variant,
  box: { x: number; y: number; w: number; h: number },
  rows: LegendRow[],
  scale: number,
) => {
  const rowH = Math.min(56 * scale, box.h / rows.length);
  const y0 = box.y + (box.h - rowH * rows.length) / 2;
  const sw = Math.min(22 * scale, rowH * 0.42);
  ctx.font = font(500, Math.min(19 * scale, rowH * 0.36));
  ctx.textBaseline = "middle";
  rows.forEach((row, i) => {
    const cy = y0 + rowH * (i + 0.5);
    ctx.fillStyle = row.tone;
    ctx.fillRect(box.x, cy - sw / 2, sw, sw);
    ctx.fillStyle = variant.palette.textDim;
    ctx.fillText(row.label, box.x + sw * 1.7, cy, box.w * 0.55);
  });
  ctx.textBaseline = "alphabetic";
  return { rowH, y0, sw };
};

/** The climbing half: one value per row, right-aligned on fixed digit advances. */
export const drawLegendValues = (
  ctx: Ctx,
  variant: Variant,
  box: { x: number; y: number; w: number; h: number },
  values: number[],
  scale: number,
) => {
  const rowH = Math.min(56 * scale, box.h / values.length);
  const y0 = box.y + (box.h - rowH * values.length) / 2;
  ctx.font = font(700, Math.min(21 * scale, rowH * 0.4));
  ctx.textBaseline = "middle";
  ctx.fillStyle = variant.palette.textDark;
  values.forEach((v, i) => {
    drawTabular(
      ctx,
      `${Math.round(v * 100)}%`,
      box.x + box.w,
      y0 + rowH * (i + 0.5),
      "right",
    );
  });
  ctx.textBaseline = "alphabetic";
};
