import React, { useMemo } from "react";
import { CanvasLayer, createOffscreen, roundedRectPath } from "./CanvasLayer";
import { fillTracked, fontString, SANS } from "../fonts";
import { mix, withAlpha } from "../color";
import type { Layout } from "../layout";
import { black } from "../color";
import { NO_ENTRANCE } from "../stages";
import type { Entrance } from "../stages";
import { BAR_FILL_ALPHA, BAR_SHADOW_ALPHA, SEARCH_LABEL } from "../variants";
import type { BarStyle, ChromeConfig, Palette } from "../variants";

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
  chrome: ChromeConfig,
  bloom: boolean,
  borderColor: string,
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

  // A faint lift across the interior so the pill is not a flat slab. The
  // minimal and input styles want a genuinely flat fill, so they skip it.
  if (barStyle === "glow" || barStyle === "terminal") {
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

  // ── the inner shadow, which is how an input field reads on white ────────
  if (barStyle === "input") {
    ctx.save();
    path();
    ctx.clip();
    const inner = ctx.createLinearGradient(barX, barY, barX, barY + barH * 0.4);
    inner.addColorStop(0, black(0.09));
    inner.addColorStop(1, black(0));
    ctx.fillStyle = inner;
    ctx.fillRect(barX, barY, barW, barH * 0.4);
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
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = layout.borderWidth;
  path();
  ctx.stroke();
  ctx.restore();

  if (!chrome.label) {
    return;
  }

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

/**
 * A pill path that starts at the leftmost point, so a dashed reveal strokes
 * out from the left, around the top, along the right cap and back underneath.
 */
const pillPathFromLeft = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, Math.PI * 1.5, Math.PI * 0.5);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI * 0.5, Math.PI);
  ctx.closePath();
};

const pillPerimeter = (w: number, h: number) => 2 * (w - h) + Math.PI * h;

export const Bar: React.FC<{
  layout: Layout;
  palette: Palette;
  barStyle: BarStyle;
  chrome: ChromeConfig;
  bloom: boolean;
  /** 0..1 border draw-on; 1 blits the finished chrome. */
  reveal?: number;
  /** The field has been clicked, so the border sits brighter. */
  focused?: boolean;
  /** The search button is flashing to its hover colour. */
  buttonHot?: boolean;
  /** The in-pill chrome arriving behind the stroked-on border. */
  chromeFade?: number;
  entrance?: Entrance;
}> = React.memo(
  ({
    layout,
    palette,
    barStyle,
    chrome,
    bloom,
    reveal = 1,
    focused = false,
    buttonHot = false,
    chromeFade = 1,
    entrance = NO_ENTRANCE,
  }) => {
    // Focus brightens the border by pulling it towards the text colour, so no
    // extra palette entry is needed for a state that only one variant has.
    const focusBorder = mix(palette.barBorder, palette.text, 0.35, 1);

    const bake = (borderColor: string) => {
      const canvas = createOffscreen(layout.layerW, layout.layerH);
      const ctx = canvas.getContext("2d");
      if (ctx !== null) {
        ctx.translate(-layout.layerX, -layout.layerY);
        paintChrome(ctx, layout, palette, barStyle, chrome, bloom, borderColor);
      }
      return canvas;
    };

    const resting = useMemo(
      () => bake(palette.barBorder),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [layout, palette, barStyle, chrome, bloom],
    );
    // Only built for the variants that actually have a focus state.
    const brightened = useMemo(
      () => (focused ? bake(focusBorder) : null),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [layout, palette, barStyle, chrome, bloom, focused, focusBorder],
    );

    return (
      <CanvasLayer
        x={layout.layerX}
        y={layout.layerY}
        width={layout.layerW}
        height={layout.layerH}
        draw={(ctx) => {
          // The border strokes itself on before anything else exists.
          if (reveal < 1) {
            if (reveal <= 0) {
              return;
            }
            const perimeter = pillPerimeter(layout.barW, layout.barH);
            ctx.save();
            ctx.strokeStyle = palette.barBorder;
            ctx.lineWidth = layout.borderWidth;
            ctx.setLineDash([perimeter * reveal, perimeter]);
            pillPathFromLeft(ctx, layout.barX, layout.barY, layout.barW, layout.barH);
            ctx.stroke();
            ctx.restore();
            return;
          }

          const transformed = entrance.scale !== 1 || entrance.opacity !== 1;
          if (transformed) {
            ctx.save();
            ctx.globalAlpha = entrance.opacity;
            const cx = layout.barX + layout.barW / 2;
            const cy = layout.iconCy;
            ctx.translate(cx, cy);
            ctx.scale(entrance.scale, entrance.scale);
            ctx.translate(-cx, -cy);
          }

          ctx.drawImage(brightened ?? resting, layout.layerX, layout.layerY);

          // The button is drawn live rather than baked, because it flashes.
          if (chrome.icon === "button" && palette.button !== null && chromeFade > 0) {
            ctx.globalAlpha *= chromeFade;
            ctx.fillStyle = buttonHot ? palette.button.hover : palette.button.fill;
            roundedRectPath(
              ctx,
              layout.buttonX,
              layout.buttonY,
              layout.buttonW,
              layout.buttonH,
              layout.buttonR,
            );
            ctx.fill();
            ctx.globalAlpha = 1;
          }

          if (transformed) {
            ctx.restore();
          }
        }}
      />
    );
  },
);
Bar.displayName = "Bar";
