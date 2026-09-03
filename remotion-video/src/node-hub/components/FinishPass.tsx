/**
 * The finishing layer: vignette, then fine grain, over everything below.
 *
 * Bloom is not applied here — each layer blooms its own content, so the hub
 * can glow generously while the side chrome barely does. This layer only ever
 * darkens and textures.
 */
import { useMemo } from "react";
import { grainPass, makeGrainTiles, vignettePass } from "../passes";
import { Layer } from "./Layer";
import type { Palette } from "../variants";

const VIGNETTE_STRENGTH = 0.22;
const GRAIN_ALPHA = 0.04;

export type FinishPassProps = {
  palette: Palette;
  frame: number;
  width: number;
  height: number;
};

export const FinishPass: React.FC<FinishPassProps> = ({
  palette,
  frame,
  width,
  height,
}) => {
  const grainTiles = useMemo(() => makeGrainTiles(), []);

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    vignettePass(ctx, w, h, VIGNETTE_STRENGTH, palette.bgDeep);
    grainPass(ctx, w, h, frame, GRAIN_ALPHA, grainTiles);
  };

  return <Layer draw={draw} width={width} height={height} />;
};
