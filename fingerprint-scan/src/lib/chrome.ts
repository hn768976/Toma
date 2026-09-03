/** Adapts this project's palette to the shared library's panel chrome. */
import { panelChrome, type PanelChromeColors } from "../shared/draw";
import { sansFont } from "../fonts";
import type { Palette } from "../variants";

export const chromeColors = (p: Palette): PanelChromeColors => ({
  fill: p.panelFill,
  fillAlpha: p.panelFillAlpha,
  border: p.panelBorder,
  label: p.textPale,
});

export const drawPanelChrome = (
  ctx: CanvasRenderingContext2D,
  size: { w: number; h: number },
  palette: Palette,
  label: string,
) => panelChrome(ctx, size, chromeColors(palette), label, sansFont(21, 600));
