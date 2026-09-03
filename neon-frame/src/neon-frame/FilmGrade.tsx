/**
 * The final grade: vignette then grain, on a layer that sits above everything
 * and deliberately does NOT inherit the ambient camera drift.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { HEIGHT, WIDTH, layerStyle, loopedFrame } from "./constants";
import { useCanvas2D } from "../lib/canvas";
import { grainPass } from "../lib/grain-pass";
import { vignettePass } from "../lib/vignette-pass";

export const VIGNETTE_STRENGTH = 0.22;
export const GRAIN_ALPHA = 0.04;

export const FilmGrade: React.FC = () => {
  const frame = useCurrentFrame();
  const f = loopedFrame(frame);

  const ref = useCanvas2D((ctx, width, height) => {
    vignettePass(ctx, width, height, VIGNETTE_STRENGTH);
    grainPass(ctx, width, height, f, GRAIN_ALPHA);
  });

  return <canvas ref={ref} width={WIDTH} height={HEIGHT} style={layerStyle} />;
};
