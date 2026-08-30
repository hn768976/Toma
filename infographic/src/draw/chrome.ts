import type { Variant } from "../theme";
import { font } from "../fonts";
import { fillerHeading, pick, rnd, type Ctx } from "./primitives";

/**
 * Every panel carries the same small chrome: a bold heading line and a hairline
 * rule under it. It is static, so it is drawn once into the panel's offscreen
 * canvas and blitted from then on.
 */
export const drawPanelHeading = (
  ctx: Ctx,
  variant: Variant,
  seed: string,
  w: number,
  scale: number,
) => {
  const size = 20 * scale;
  ctx.font = font(700, size);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = variant.palette.inkDark;
  const heading = fillerHeading(seed);
  ctx.fillText(heading, 0, size, w);

  ctx.font = font(400, size * 0.78);
  ctx.fillStyle = variant.palette.textDim;
  const sub = `${pick(`${seed}-sub`, ["Ser.", "Tab.", "Fig.", "Sec."])} ${Math.floor(rnd(`${seed}-n`) * 89 + 10)}`;
  ctx.fillText(sub, 0, size * 2.15, w);

  ctx.strokeStyle = variant.palette.textDim;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.beginPath();
  ctx.moveTo(0, size * 2.75);
  ctx.lineTo(w, size * 2.75);
  ctx.stroke();
  ctx.globalAlpha = 1;

  return size * 3.5;
};

/** Emissive treatment. Zero everywhere except the dark variant. */
export const withGlow = (ctx: Ctx, variant: Variant, colour: string) => {
  if (variant.chart.glowBlur > 0) {
    ctx.shadowBlur = variant.chart.glowBlur;
    ctx.shadowColor = colour;
  }
};

export const clearGlow = (ctx: Ctx) => {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
};
