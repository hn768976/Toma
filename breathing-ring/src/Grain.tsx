import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { GRAIN_TILE_PX } from "./design";

/**
 * Fine grain over the whole frame.
 *
 * The background is a very gradual dark gradient, which bands visibly once
 * H.264 has had its way with it. A couple of percent of grain dithers the
 * banding out. Check the encoded file, not the preview — the preview is
 * lossless and will not show the banding this is here to fix.
 */

// Deterministic per-frame jitter so the grain crawls instead of sitting still.
const hash = (n: number, salt: number): number => {
  let t = (n + salt * 0x9e3779b9) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const Grain: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  if (opacity <= 0) {
    return null;
  }

  const offsetX = Math.floor(hash(frame, 1) * GRAIN_TILE_PX);
  const offsetY = Math.floor(hash(frame, 2) * GRAIN_TILE_PX);

  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile("grain.png")})`,
        backgroundRepeat: "repeat",
        backgroundSize: `${GRAIN_TILE_PX}px ${GRAIN_TILE_PX}px`,
        backgroundPosition: `${offsetX}px ${offsetY}px`,
        // Keep the noise crisp when the tile is scaled up.
        imageRendering: "pixelated",
        mixBlendMode: "overlay",
        opacity,
      }}
    />
  );
};
