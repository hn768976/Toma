import { drawPaper } from "../paper";
import { paintFill } from "../fills/treatments";
import { drawMotifInstance, resolveMotifs } from "./motif";
import type { CompositionSpec } from "../types";
import type { Palette } from "../palettes";

export type StillOptions = {
  composition: CompositionSpec;
  palette: Palette;
  width: number;
  height: number;
};

/**
 * Draw a complete still in one pass: the washi ground, then every motif in
 * table order.
 *
 * <WashiMotif> builds the same image through the component tree; this is the
 * plain-function route used by the contact sheet, which renders sixteen stills
 * into one canvas and cannot mount sixteen component trees at different
 * resolutions.
 */
export const drawStill = (
  ctx: CanvasRenderingContext2D,
  { composition, palette, width, height }: StillOptions,
): void => {
  drawPaper(ctx, {
    width,
    height,
    palette,
    tone: composition.tone,
    seed: composition.id,
    fibreDensity: composition.fibreDensity,
  });

  const env = { width, height, palette, composition };
  for (const instance of resolveMotifs(composition, width, height)) {
    drawMotifInstance(ctx, instance, env, (options) =>
      paintFill(instance.spec.fill, options),
    );
  }
};
