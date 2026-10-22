import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { MILLER_YMAX } from "./projection";
import { buildLandTexture } from "./texture";

export const MAP_TEX_W = 4096;
export const MAP_TEX_H = Math.round((MAP_TEX_W * MILLER_YMAX) / Math.PI);

/**
 * Still composition that bakes the procedural land relief texture to
 * public/map/land-relief.jpg (`npm run bake`). Greyscale luminance in Miller
 * projection space; palettes colourise it at render time.
 */
export const MapTextureBake: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const t = buildLandTexture(MAP_TEX_W);
    const ctx = ref.current!.getContext("2d")!;
    const img = ctx.createImageData(t.w, t.h);
    for (let i = 0; i < t.lum.length; i++) {
      const v = Math.round(t.lum[i] * 255);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, []);
  return (
    <AbsoluteFill>
      <canvas ref={ref} width={MAP_TEX_W} height={MAP_TEX_H} style={{ width: MAP_TEX_W, height: MAP_TEX_H }} />
    </AbsoluteFill>
  );
};
