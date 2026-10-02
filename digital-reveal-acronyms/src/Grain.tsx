import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// Film grain from SVG feTurbulence. The seed is a pure function of the frame
// number (never Math.random), so every render thread produces the same grain.
export const GRAIN_OPACITY = 0.34;

export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // Grain size tied to frame height so it looks the same at any resolution.
  const freq = 0.9 * (1080 / height);
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: GRAIN_OPACITY }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <filter id="grain" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={2} seed={(frame % 997) + 1} stitchTiles="noStitch" />
          <feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" />
        </filter>
        <rect width={width} height={height} filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};
