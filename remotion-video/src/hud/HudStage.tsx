import React from "react";
import { AbsoluteFill } from "remotion";
import { BASE_HEIGHT, BASE_WIDTH } from "./constants";
import { Backdrop, Vignette } from "./layers/Backdrop";
import { DataField } from "./layers/DataField";
import type { HudTheme } from "./theme";
import type { MapWindow } from "./worldMap";

// Shared scaffolding for both layouts.
//
// Everything vector lives in a single <svg> with a 1920x1080 viewBox
// whose pixel size is the real output size, so the 4K compositions
// re-rasterise paths and glyphs at native resolution instead of scaling
// up a 1080p bitmap. The canvas layer gets the same treatment via its
// backing store. That is why `scale` is threaded through rather than
// wrapping the tree in a CSS transform, which would composite once at 1x
// and then upscale.
export const HudStage: React.FC<{
  theme: HudTheme;
  scale: number;
  mapWindow: MapWindow;
  glowX: number;
  glowY: number;
  parallax?: number;
  seed: string;
  children: React.ReactNode;
}> = ({ theme, scale, mapWindow, glowX, glowY, parallax, seed, children }) => (
  <AbsoluteFill>
    <Backdrop theme={theme} glowX={glowX} glowY={glowY} />
    <DataField
      theme={theme}
      scale={scale}
      mapWindow={mapWindow}
      parallax={parallax}
      seed={seed}
    />
    <svg
      width={Math.round(BASE_WIDTH * scale)}
      height={Math.round(BASE_HEIGHT * scale)}
      viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      shapeRendering="geometricPrecision"
    >
      {children}
    </svg>
    <Vignette theme={theme} />
  </AbsoluteFill>
);
