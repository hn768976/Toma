import React from "react";
import { AbsoluteFill } from "remotion";
import type { Theme } from "./theme";

/** One 480px noise tile, shifted by whole pixels per frame. */
const TILE = 480;
const NOISE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch' seed='11'/><feColorMatrix type='saturate' values='0'/></filter><rect width='${TILE}' height='${TILE}' filter='url(#n)'/></svg>`,
)}")`;

export const Grade: React.FC<{ theme: Theme; frame: number }> = ({
  theme,
  frame,
}) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {theme.vignetteOpacity > 0 ? (
      <AbsoluteFill
        style={{
          background: `radial-gradient(130% 100% at 50% 48%, rgba(0,0,0,0) 38%, rgba(0,0,0,${theme.vignetteOpacity}) 100%)`,
        }}
      />
    ) : null}
    {theme.grainOpacity > 0 ? (
      <AbsoluteFill
        style={{
          backgroundImage: NOISE,
          // 7 and 13 px per frame: both land back on 0 at frame 480, so the
          // grain loops with everything else.
          backgroundPosition: `${(frame * 7) % TILE}px ${(frame * 13) % TILE}px`,
          opacity: theme.grainOpacity,
          mixBlendMode: "overlay",
        }}
      />
    ) : null}
  </AbsoluteFill>
);
