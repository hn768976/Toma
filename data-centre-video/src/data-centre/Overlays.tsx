/**
 * 2D finishing passes drawn over the canvas.
 *
 * Grain is a small pre-generated noise tile scrolled per frame — far cheaper
 * than an SVG turbulence filter at 4K, and deterministic because the offset
 * is a pure function of the frame. The vignette is V1 only. There is no
 * depth of field in either version: isometric implies an infinitely distant
 * viewer, and DOF on a parallel projection looks wrong.
 */

import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { grainDataUrl } from "./textures";
import type { Theme } from "./theme";

export const Overlays: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const grain = useMemo(() => grainDataUrl(), []);

  // Deterministic per-frame jitter of the noise tile.
  const ox = (frame * 61) % 128;
  const oy = (frame * 37) % 128;

  return (
    <>
      {theme.vignette > 0 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 74% 74% at 50% 46%, rgba(0,0,0,0) 38%, rgba(0,0,0,${theme.vignette}) 100%)`,
            pointerEvents: "none",
          }}
        />
      ) : null}
      {theme.grain > 0 ? (
        <AbsoluteFill
          style={{
            backgroundImage: `url(${grain})`,
            backgroundRepeat: "repeat",
            backgroundSize: "128px 128px",
            backgroundPosition: `${ox}px ${oy}px`,
            opacity: theme.grain,
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />
      ) : null}
    </>
  );
};
