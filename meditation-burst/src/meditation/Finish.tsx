import React from "react";
import { grainPass } from "../lib/grainPass";
import { useCanvas } from "../lib/useCanvas";
import { layerStyle } from "./layers";
import { Layout, LOOP } from "./layout";
import { vignettePass } from "../lib/vignettePass";
import { VariantConfig } from "./variants";

/**
 * Lens treatment: a ~24% vignette and fine grain at ~4% alpha, seeded on
 * `frame % 600`. Neither drifts with the camera — they belong to the
 * lens, not to the scene.
 */
export const Finish: React.FC<{
  config: VariantConfig;
  layout: Layout;
  frame: number;
}> = ({ config, layout, frame }) => {
  const ref = useCanvas(layout.width, layout.height, (ctx) => {
    vignettePass(ctx, {
      width: layout.width,
      height: layout.height,
      strength: 0.24,
      color: config.palette.silhouette,
    });
    grainPass(ctx, {
      width: layout.width,
      height: layout.height,
      frame,
      loopLength: LOOP,
      alpha: 0.04,
    });
  });
  return <canvas ref={ref} style={layerStyle("normal")} />;
};
