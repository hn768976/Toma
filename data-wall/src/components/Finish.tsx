import React from "react";
import { useCurrentFrame } from "remotion";
import { useCanvas, useFrameGuard } from "../useCanvas";
import { DURATION } from "../plane";
import { mulberry32, rnd } from "../rng";
import type { VariantConfig } from "../variants";

type Props = { config: VariantConfig; variantKey: string };

/**
 * Grain is generated at 1280×720 and stretched over the frame. Full-resolution
 * noise at 4K costs eight million PRNG draws a frame for a texture nobody can
 * resolve; this reads identically and is a fraction of the cost.
 */
const GRAIN_W = 1280;
const GRAIN_H = 720;

export const Finish: React.FC<Props> = ({ config, variantKey }) => {
  const frame = useCurrentFrame();
  const { ctx, mount } = useCanvas(GRAIN_W, GRAIN_H);
  const shouldDraw = useFrameGuard();

  if (shouldDraw(`${variantKey}:${frame}`)) {
    // Seeded from frame % 600, so the grain pattern closes with the loop.
    const seed = Math.floor(rnd(`grain-${frame % DURATION}`) * 0x7fffffff);
    const next = mulberry32(seed);
    const image = ctx.createImageData(GRAIN_W, GRAIN_H);
    const data = image.data;
    const alpha = Math.round(config.grain * 255);
    for (let i = 0; i < data.length; i += 4) {
      const v = (next() * 255) | 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = alpha;
    }
    ctx.putImageData(image, 0, 0);
  }

  const { vignette } = config.palette;
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 42%, ${vignette} 100%)`,
          opacity: config.vignette,
          pointerEvents: "none",
        }}
      />
      <div
        ref={mount}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />
    </>
  );
};
