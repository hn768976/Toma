import React, { useMemo } from "react";
import { createGroundCanvas } from "../grounds";
import { applyVignette } from "../grounds";
import type { Palette } from "../palettes";
import type { GroundSpec } from "../surfaces";
import { useStageLayer } from "./CanvasStage";

/**
 * The ground a surface is printed on: washi, woven cloth, beaten metal leaf
 * or a watercolour wash. Drawn once into an offscreen canvas and blitted, for
 * the same reason the washi sheet is.
 */
export const SurfaceGround: React.FC<{
  order?: number;
  width: number;
  height: number;
  palette: Palette;
  spec: GroundSpec;
  seed: string;
}> = ({ order = 0, width, height, palette, spec, seed }) => {
  const ground = useMemo(
    () => createGroundCanvas({ width, height, palette, seed, spec }),
    [width, height, palette, seed, spec],
  );

  useStageLayer("ground", order, (ctx) => {
    ctx.drawImage(ground, 0, 0);
  });

  return null;
};

/**
 * Corners pulled down, over the motifs rather than under them — on a board or
 * a photographed sheet the falloff dims the pattern too.
 */
export const SurfaceVignette: React.FC<{
  order?: number;
  width: number;
  height: number;
  palette: Palette;
  spec: GroundSpec;
  seed: string;
}> = ({ order = 900, width, height, palette, spec, seed }) => {
  useStageLayer("vignette", order, (ctx) => {
    applyVignette({ ctx, width, height, palette, seed }, spec);
  });
  return null;
};
