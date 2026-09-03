import React, { useMemo } from "react";
import { Canvas2D } from "./lib/Canvas2D";
import { grainPass, makeGrainTile, vignettePass } from "./lib/postFx";

export type FilmFinishProps = {
  width: number;
  height: number;
  frame: number;
  vignetteStrength?: number;
  grainAlpha?: number;
  seed: string;
};

/**
 * The top layer: vignette and grain, applied over everything else so
 * the glow and the dust are darkened at the edges along with the wall.
 *
 * The grain tile is baked once and jittered per frame; regenerating
 * 8.3M noise samples every frame would dominate render time and buy
 * nothing visible.
 */
export const FilmFinish: React.FC<FilmFinishProps> = ({
  width,
  height,
  frame,
  vignetteStrength = 0.24,
  grainAlpha = 0.04,
  seed,
}) => {
  const tile = useMemo(() => makeGrainTile(256, `${seed}-grain`), [seed]);

  return (
    <>
      <Canvas2D
        width={width}
        height={height}
        draw={(ctx) => {
          vignettePass(ctx, width, height, vignetteStrength);
        }}
      />
      <Canvas2D
        width={width}
        height={height}
        blend="overlay"
        draw={(ctx) => {
          grainPass(ctx, tile, width, height, frame, grainAlpha);
        }}
      />
    </>
  );
};
