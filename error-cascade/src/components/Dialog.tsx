/**
 * The dialog itself, drawn ONCE into a small offscreen canvas.
 *
 * This is the single most important optimisation in the piece: re-drawing the
 * border, title bar, icon and message text for hundreds of dialogs per frame
 * at 4K would be unrenderable. Instead every dialog on screen is one
 * `drawImage` of this sprite under a translate/rotate/scale.
 *
 * The dialog is a generic window, not a reproduction of any real operating
 * system: square corners, a thin flat border, a flat solid title bar, and a
 * one-pixel bevel highlight along the top and left edges. That bevel plus the
 * drop shadow is the whole reason it reads as a window rather than a
 * rectangle.
 */

import type { Palette, Variant, VariantName } from "../config";
import { VARIANTS } from "../config";
import { fontsReady, FONT_FAMILY } from "../fonts";
import { drawErrorIcon } from "./ErrorIcon";
import { drawTitleBar } from "./TitleBar";

/** Room around the dialog inside the sprite for the shadow to spill into. */
const spritePadding = (variant: Variant) =>
  Math.ceil(
    variant.dialog.shadowBlur +
      Math.max(variant.dialog.shadowOffsetX, variant.dialog.shadowOffsetY) +
      4,
  );

export interface DialogSprite {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

const drawDialog = (variant: Variant, palette: Palette, messages: Variant["messages"]) => {
  const style = variant.dialog;
  const pad = spritePadding(variant);
  const canvas = document.createElement("canvas");
  canvas.width = style.width + pad * 2;
  canvas.height = style.height + pad * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not acquire a 2d context for the dialog sprite");
  }

  const x = pad;
  const y = pad;
  const w = style.width;
  const h = style.height;
  const b = style.borderWidth;

  // Body fill, and with it the drop shadow below and to the right.
  ctx.save();
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = style.shadowBlur;
  ctx.shadowOffsetX = style.shadowOffsetX;
  ctx.shadowOffsetY = style.shadowOffsetY;
  ctx.fillStyle = palette.dialogFill;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  const titleHeight = Math.round(h * style.titleBarRatio);
  drawTitleBar({
    ctx,
    style,
    palette,
    label: messages.title,
    x: x + b,
    y: y + b,
    width: w - b * 2,
    height: titleHeight,
  });

  // Body: the icon on the left, one line of message text beside it.
  const bodyTop = y + b + titleHeight;
  const bodyCentreY = bodyTop + (h - b * 2 - titleHeight) / 2;
  const iconCx = x + b + style.paddingX + style.iconRadius;
  drawErrorIcon({ ctx, style, palette, cx: iconCx, cy: bodyCentreY });

  ctx.fillStyle = palette.bodyText;
  ctx.font = `400 ${style.bodyFontSize}px "${FONT_FAMILY}", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(messages.body, iconCx + style.iconRadius + 18, bodyCentreY + 1);

  // Thin border, square corners, drawn last so it stays crisp.
  ctx.strokeStyle = palette.dialogBorder;
  ctx.lineWidth = b;
  ctx.strokeRect(x + b / 2, y + b / 2, w - b, h - b);

  // 1px highlight along the top and left edges, inside the border.
  ctx.save();
  ctx.globalAlpha = style.bevelAlpha;
  ctx.strokeStyle = palette.dialogBevel;
  ctx.lineWidth = style.bevelWidth;
  const inset = b + style.bevelWidth / 2;
  ctx.beginPath();
  ctx.moveTo(x + inset, y + h - inset);
  ctx.lineTo(x + inset, y + inset);
  ctx.lineTo(x + w - inset, y + inset);
  ctx.stroke();
  ctx.restore();

  return { canvas, width: canvas.width, height: canvas.height };
};

const cache = new Map<VariantName, { sprite: DialogSprite; withFont: boolean }>();

/** Drop the cache so the sprite is redrawn — used when the webfont lands. */
export const invalidateDialogSprites = () => cache.clear();

export const getDialogSprite = (variantName: VariantName): DialogSprite => {
  const cached = cache.get(variantName);
  if (cached && cached.withFont) {
    return cached.sprite;
  }
  const variant = VARIANTS[variantName];
  const sprite = drawDialog(variant, variant.palette, variant.messages);
  cache.set(variantName, { sprite, withFont: fontsReady() });
  return sprite;
};
