import React, { useMemo } from "react";
import { CanvasLayer, createOffscreen, roundedRectPath } from "./CanvasLayer";
import { fillTracked, fontString, SANS } from "../fonts";
import { withAlpha } from "../color";
import type { Layout } from "../layout";
import { BAR_FILL_ALPHA, BAR_SHADOW_ALPHA, SEARCH_LABEL } from "../variants";
import type { BarStyle, Palette } from "../variants";

/**
 * The pill and its chrome: fill, border, glow or drop shadow, the "SEARCH"
 * label and the divider. None of it changes across the 480 frames, so it is
 * rasterised once into an offscreen canvas (useMemo) and then blitted — only
 * the typed characters, the cursor and the background field are redrawn per
 * frame.
 */
const paintChrome = (
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  palette: Palette,
  barStyle: BarStyle,
  bloom: boolean,
) => {
  const { barX, barY, barW, barH, radius } = layout;
  const path = () => roundedRectPath(ctx, barX, barY, barW, barH, radius);

  // ── the drop shadow, light mode only: down and to the right ──────────────
  if (barStyle === "clean") {
    ctx.save();
    ctx.shadowColor = withAlpha(palette.barGlow, BAR_SHADOW_ALPHA);
    ctx.shadowOffsetX = barH * 0.09;
    ctx.shadowOffsetY = barH * 0.17;
    ctx.shadowBlur = barH * 0.55;
    ctx.fillStyle = palette.barFill;
    path();
    ctx.fill();
    ctx.restore();
  }

  // ── fill ─────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = withAlpha(palette.barFill, BAR_FILL_ALPHA[barStyle]);
  path();
  ctx.fill();
  ctx.restore();

  // A faint lift across the interior so the pill is not a flat slab.
  if (barStyle !== "clean") {
    ctx.save();
    path();
    ctx.clip();
    const wash = ctx.createLinearGradient(barX, barY, barX + barW, barY + barH);
    wash.addColorStop(0, withAlpha(palette.barGlow, 0.05));
    wash.addColorStop(1, withAlpha(palette.barGlow, 0.045));
    ctx.fillStyle = wash;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.restore();
  }

  // ── the border glow ──────────────────────────────────────────────────────
  const glowPasses: { blur: number; alpha: number; width: number }[] =
    barStyle === "glow"
      ? [
          { blur: barH * 1.05, alpha: 0.5, width: layout.borderWidth * 1.5 },
          { blur: barH * 0.5, alpha: 0.55, width: layout.borderWidth * 1.1 },
          { blur: barH * 0.2, alpha: 0.7, width: layout.borderWidth },
        ]
      : barStyle === "terminal"
        ? [{ blur: barH * 0.22, alpha: 0.5, width: layout.borderWidth }]
        : [];

  if (bloom && glowPasses.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < glowPasses.length; i++) {
      const pass = glowPasses[i];
      ctx.shadowColor = palette.barGlow;
      ctx.shadowBlur = pass.blur;
      ctx.strokeStyle = withAlpha(palette.barBorder, pass.alpha);
      ctx.lineWidth = pass.width;
      path();
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── the border itself ────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = palette.barBorder;
  ctx.lineWidth = layout.borderWidth;
  path();
  ctx.stroke();
  ctx.restore();

  // ── "SEARCH", small caps and letterspaced ────────────────────────────────
  ctx.save();
  ctx.fillStyle = palette.label;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = fontString(600, layout.labelSize, SANS);
  fillTracked(ctx, SEARCH_LABEL, layout.labelX, layout.iconCy + layout.labelSize * 0.04, layout.labelTracking);
  ctx.restore();

  // ── the divider ──────────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = palette.divider;
  ctx.lineWidth = Math.max(2, barH * 0.018);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(layout.dividerX, layout.iconCy - barH * 0.23);
  ctx.lineTo(layout.dividerX, layout.iconCy + barH * 0.23);
  ctx.stroke();
  ctx.restore();
};

export const Bar: React.FC<{
  layout: Layout;
  palette: Palette;
  barStyle: BarStyle;
  bloom: boolean;
}> = React.memo(({ layout, palette, barStyle, bloom }) => {
  const chrome = useMemo(() => {
    const canvas = createOffscreen(layout.layerW, layout.layerH);
    const ctx = canvas.getContext("2d");
    if (ctx !== null) {
      ctx.translate(-layout.layerX, -layout.layerY);
      paintChrome(ctx, layout, palette, barStyle, bloom);
    }
    return canvas;
  }, [layout, palette, barStyle, bloom]);

  return (
    <CanvasLayer
      x={layout.layerX}
      y={layout.layerY}
      width={layout.layerW}
      height={layout.layerH}
      draw={(ctx) => {
        ctx.drawImage(chrome, layout.layerX, layout.layerY);
      }}
    />
  );
});
Bar.displayName = "Bar";
