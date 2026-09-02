import React, { useMemo } from "react";
import { makeSprite, useCanvasDraw } from "@lib/canvas/canvas";
import { drawBorderFlash, drawPanelChrome, panelFlash } from "@lib/draw/panel-chrome";
import { PALETTE, PANEL_FILL_ALPHA, withAlpha } from "../palette";
import {
  PANEL_BORDER_W,
  PANEL_CORNER_TICK,
  PANEL_LABEL_H,
  PANEL_PAD,
  type Rect,
} from "../layout";
import { sansFont } from "../fonts";
import { FLASH_LENGTH, FLASH_SLOT } from "../timing";

/** Content rect of a panel: inside the border, below the label strip. */
export const innerRect = (rect: Rect, hasLabel: boolean): Rect => ({
  x: PANEL_BORDER_W + PANEL_PAD,
  y: PANEL_BORDER_W + (hasLabel ? PANEL_LABEL_H : 0) + PANEL_PAD,
  w: rect.w - (PANEL_BORDER_W + PANEL_PAD) * 2,
  h: rect.h - (PANEL_BORDER_W + (hasLabel ? PANEL_LABEL_H : 0) + PANEL_PAD) - PANEL_PAD,
});

const CHROME_COLORS = {
  fill: withAlpha(PALETTE.panelFill, PANEL_FILL_ALPHA),
  border: PALETTE.panelBorder,
  tick: PALETTE.elementDim,
  labelText: PALETTE.textPale,
  labelStrip: withAlpha(PALETTE.bgWash, 0.62),
};

export type PanelProps = {
  rect: Rect;
  /** Panel index within the dashboard, used only by the flash scheduler. */
  index: number;
  panelCount: number;
  frame: number;
  label?: string;
  bracketOnly?: boolean;
  /** Extra static content, rasterised once into the chrome sprite. */
  drawStatic?: (ctx: CanvasRenderingContext2D, inner: Rect) => void;
  /** Per-frame content, drawn on top of the blitted sprite. */
  drawDynamic?: (ctx: CanvasRenderingContext2D, inner: Rect) => void;
};

/**
 * One panel: static chrome rasterised once, blitted every frame, with the
 * per-frame values drawn on top and an occasional border flash.
 *
 * Every panel in the dashboard goes through this, which is what keeps the
 * chrome genuinely identical rather than identical-by-copy-paste.
 */
export const Panel: React.FC<PanelProps> = ({
  rect,
  index,
  panelCount,
  frame,
  label,
  bracketOnly = false,
  drawStatic,
  drawDynamic,
}) => {
  const hasLabel = label !== undefined;
  const inner = useMemo(() => innerRect(rect, hasLabel), [rect, hasLabel]);

  // The sprite intentionally does not depend on drawStatic: it is a fresh
  // closure every frame, and every panel's static content is a pure function
  // of the panel's size and label, both of which are in the dep list.
  const sprite = useMemo(
    () =>
      makeSprite(rect.w, rect.h, (ctx) => {
        drawPanelChrome(ctx, {
          w: rect.w,
          h: rect.h,
          label,
          labelFont: sansFont(500, 22),
          colors: CHROME_COLORS,
          borderWidth: PANEL_BORDER_W,
          labelHeight: PANEL_LABEL_H,
          cornerTick: PANEL_CORNER_TICK,
          bracketOnly,
        });
        drawStatic?.(ctx, inner);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rect.w, rect.h, label, bracketOnly, inner],
  );

  const flash = panelFlash(frame, index, panelCount, FLASH_SLOT, FLASH_LENGTH);

  const ref = useCanvasDraw(rect.w, rect.h, (ctx) => {
    if (sprite) ctx.drawImage(sprite, 0, 0);
    drawDynamic?.(ctx, inner);
    drawBorderFlash(ctx, rect.w, rect.h, flash, PALETTE.elementPale, PANEL_BORDER_W);
  });

  return (
    <canvas
      ref={ref}
      width={rect.w}
      height={rect.h}
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
      }}
    />
  );
};
