import React, { useMemo } from "react";
import { FINISH, HEIGHT, WIDTH } from "../config";
import { buildGrainTiles, grainPass, vignettePass } from "../lib/postFx";
import type { Theme } from "../theme";
import { layerStyle, useCanvasDraw } from "../lib/canvas";

/** Vignette and film grain, over everything else. */
export const PostFx: React.FC<{ frame: number; theme: Theme }> = ({ frame, theme }) => {
  const grainTiles = useMemo(
    () =>
      buildGrainTiles({
        size: FINISH.grainTileSize,
        count: FINISH.grainTileCount,
        light: theme.grainLight,
        dark: theme.grainDark,
        seed: "cloud-icon/grain",
      }),
    [theme],
  );

  const ref = useCanvasDraw(WIDTH, HEIGHT, (ctx) => {
    grainPass(ctx, {
      width: WIDTH,
      height: HEIGHT,
      tiles: grainTiles,
      frame,
      alpha: FINISH.grainAlpha,
      seed: "cloud-icon/grain-offset",
    });
    vignettePass(ctx, {
      width: WIDTH,
      height: HEIGHT,
      color: theme.vignette,
      strength: FINISH.vignetteStrength,
    });
  });

  return <canvas ref={ref} style={layerStyle(6)} />;
};
