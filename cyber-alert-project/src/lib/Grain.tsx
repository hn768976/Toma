import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { hash01 } from "./random";
import { loopFrame, useLoopFrame, useUnits } from "./loop";

const TILE = 256;

/**
 * Grain overlay, added last (after every glow). A fixed seeded noise tile,
 * shown at one noise cell per 1080p pixel, jumped to a new offset every frame
 * by a hash of (frame % 600). Same pixels every render, loops with the clip.
 */
export const Grain: React.FC<{ opacity?: number; salt?: number; animated?: boolean }> = ({
  opacity = 0.02,
  salt = 1,
  animated = true,
}) => {
  const f = useLoopFrame();
  const { u, width, height } = useUnits();
  const k = animated ? loopFrame(f) : 0;
  const ox = Math.floor(hash01(k, salt) * TILE) * u;
  const oy = Math.floor(hash01(k, salt + 7) * TILE) * u;
  const size = TILE * u;
  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundImage: `url(${staticFile("noise/grain.png")})`,
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: `${-ox}px ${-oy}px`,
        imageRendering: "pixelated",
        width,
        height,
        pointerEvents: "none",
      }}
    />
  );
};
