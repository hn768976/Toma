// Offscreen sprite atlas.
//
// Rounded rects, outlines, tick marks and their baked glow are rasterised
// once, up front, into small canvases. Per frame the renderer only ever
// blits these with a transform — it never re-strokes a chip.

import {
  CHIP_ASPECTS,
  GLOW_STRENGTH,
  SPARKLE_MAX_SIZE,
  SPRITE_GLOW_BLUR,
  SPRITE_GLOW_PAD,
  SPRITE_WIDTHS,
} from "./config";
import { lighten, withAlpha } from "./color";
import type { Theme } from "./theme";

export type Sprite = {
  canvas: HTMLCanvasElement;
  // Nominal chip width inside the canvas. Blitting at on-screen width W uses
  // scale = W / chipWidth, applied to the whole (padded) canvas.
  chipWidth: number;
  canvasWidth: number;
  canvasHeight: number;
};

// Filled chips carry one sprite per palette colour; hollow chips are always
// the outline-glow colour, or chip white while flashing.
export type HollowColor = 0 | 1;

export type SpriteAtlas = {
  filled: Sprite[][][]; // [sizeIndex][colorIndex][aspectIndex]
  hollow: Sprite[][][]; // [sizeIndex][hollowColor][aspectIndex]
  hollowTicked: Sprite[][][]; // [sizeIndex][hollowColor][aspectIndex]
  sparkle: Sprite;
};

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
};

const roundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) => {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

type SpriteBody = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;

const makeSprite = (chipWidth: number, aspect: number, draw: SpriteBody): Sprite => {
  const chipHeight = chipWidth / aspect;
  const pad = chipWidth * SPRITE_GLOW_PAD;
  const canvasWidth = chipWidth + pad * 2;
  const canvasHeight = chipHeight + pad * 2;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Deliberately NOT "lighter": a chip's own glow and face must layer
    // normally, or every chip saturates to white before it is even blitted.
    // Additive compositing happens once, when the sprite lands on the field.
    draw(ctx, pad, pad, chipWidth, chipHeight);
  }
  return { canvas, chipWidth, canvasWidth, canvasHeight };
};

const glowFor = (chipWidth: number) => chipWidth * SPRITE_GLOW_BLUR * GLOW_STRENGTH;

const drawFilled =
  (color: string, chipWidth: number): SpriteBody =>
  (ctx, x, y, w, h) => {
    const radius = h * 0.24;

    // Two glow passes build a soft halo that falls off further than a single
    // shadow does; the second, tighter pass keeps the core hot.
    ctx.shadowColor = color;
    ctx.fillStyle = withAlpha(color, 0.55);
    ctx.shadowBlur = glowFor(chipWidth);
    roundedRectPath(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.shadowBlur = glowFor(chipWidth) * 0.35;
    ctx.fill();
    ctx.shadowBlur = 0;

    // A lit face, biased toward the top edge, so filled chips read as lit
    // panels rather than flat swatches. Kept close to the chip's own hue —
    // pushing it far toward white here is what drains the palette.
    const face = ctx.createLinearGradient(0, y, 0, y + h);
    face.addColorStop(0, lighten(color, 0.16, 1));
    face.addColorStop(0.5, withAlpha(color, 1));
    face.addColorStop(1, withAlpha(color, 0.72));
    ctx.fillStyle = face;
    roundedRectPath(ctx, x, y, w, h, radius);
    ctx.fill();
  };

const drawHollow =
  (color: string, chipWidth: number, ticked: boolean): SpriteBody =>
  (ctx, x, y, w, h) => {
    const radius = h * 0.28;
    const lineWidth = Math.max(1, h * 0.11);
    const inset = lineWidth / 2;

    ctx.shadowColor = color;
    ctx.shadowBlur = glowFor(chipWidth);
    ctx.strokeStyle = withAlpha(color, 0.85);
    ctx.lineWidth = lineWidth;
    roundedRectPath(ctx, x + inset, y + inset, w - lineWidth, h - lineWidth, radius);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.stroke();

    if (!ticked) return;

    // Tiny illegible tick marks, like a label that never resolves.
    const marginX = w * 0.14;
    const usable = w - marginX * 2;
    const ticks = 5;
    const tickWidth = Math.max(1, usable / (ticks * 2.1));
    const tickHeight = h * 0.34;
    const tickY = y + (h - tickHeight) / 2;
    ctx.fillStyle = withAlpha(color, 0.62);
    for (let i = 0; i < ticks; i++) {
      const tickX = x + marginX + (usable / ticks) * i;
      // Vary the last tick's length so the "label" isn't a regular comb.
      const height = i === ticks - 1 ? tickHeight * 0.6 : tickHeight;
      ctx.fillRect(tickX, tickY + (tickHeight - height) / 2, tickWidth, height);
    }
  };

const drawSparkle = (color: string): Sprite => {
  const size = SPARKLE_MAX_SIZE;
  const pad = size * 0.25;
  const canvasWidth = size + pad * 2;
  const canvas = createCanvas(canvasWidth, canvasWidth);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const c = canvasWidth / 2;
    const arm = size / 2;
    const waist = size * 0.055;
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.16;
    ctx.fillStyle = withAlpha(color, 0.95);

    // Four tapered points: a concave-sided diamond per axis.
    for (let axis = 0; axis < 2; axis++) {
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate((axis * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(0, -arm);
      ctx.quadraticCurveTo(waist * 0.35, -waist * 0.35, waist, 0);
      ctx.quadraticCurveTo(waist * 0.35, waist * 0.35, 0, arm);
      ctx.quadraticCurveTo(-waist * 0.35, waist * 0.35, -waist, 0);
      ctx.quadraticCurveTo(-waist * 0.35, -waist * 0.35, 0, -arm);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const core = ctx.createRadialGradient(c, c, 0, c, c, size * 0.16);
    core.addColorStop(0, withAlpha(color, 0.95));
    core.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, canvasWidth, canvasWidth);
  }
  return { canvas, chipWidth: size, canvasWidth, canvasHeight: canvasWidth };
};

export const buildSpriteAtlas = (theme: Theme): SpriteAtlas | null => {
  if (typeof document === "undefined") return null;

  const hollowColors = [theme.outlineGlow, theme.chipWhite];

  const perSize = <T>(build: (chipWidth: number) => T) => SPRITE_WIDTHS.map(build);

  return {
    filled: perSize((chipWidth) =>
      theme.chipPalette.map((entry) =>
        CHIP_ASPECTS.map((aspect) =>
          makeSprite(chipWidth, aspect, drawFilled(entry.color, chipWidth)),
        ),
      ),
    ),
    hollow: perSize((chipWidth) =>
      hollowColors.map((color) =>
        CHIP_ASPECTS.map((aspect) =>
          makeSprite(chipWidth, aspect, drawHollow(color, chipWidth, false)),
        ),
      ),
    ),
    hollowTicked: perSize((chipWidth) =>
      hollowColors.map((color) =>
        CHIP_ASPECTS.map((aspect) =>
          makeSprite(chipWidth, aspect, drawHollow(color, chipWidth, true)),
        ),
      ),
    ),
    sparkle: drawSparkle(theme.sparkle),
  };
};
