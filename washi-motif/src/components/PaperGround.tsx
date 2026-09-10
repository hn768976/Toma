import React, { useMemo } from "react";
import { createPaperCanvas } from "../paper";
import type { Palette } from "../palettes";
import type { PaperTone } from "../types";
import { useStageLayer } from "./CanvasStage";

/**
 * The washi sheet everything else sits on.
 *
 * Drawn ONCE into an offscreen canvas held by useMemo and then blitted: four
 * thousand fibre strands and a per-pixel grain pass are not something to
 * redraw.
 */
export const PaperGround: React.FC<{
  id?: string;
  order?: number;
  width: number;
  height: number;
  palette: Palette;
  tone: PaperTone;
  seed: string;
  fibreDensity?: number;
  /** Where to blit the sheet — the contact sheet lays out many of them. */
  x?: number;
  y?: number;
}> = ({
  id = "paper",
  order = 0,
  width,
  height,
  palette,
  tone,
  seed,
  fibreDensity,
  x = 0,
  y = 0,
}) => {
  const sheet = useMemo(
    () =>
      createPaperCanvas({
        width,
        height,
        palette,
        tone,
        seed,
        fibreDensity,
      }),
    [width, height, palette, tone, seed, fibreDensity],
  );

  useStageLayer(id, order, (ctx) => {
    ctx.drawImage(sheet, x, y);
  });

  return null;
};
