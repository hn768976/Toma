import React from "react";
import { AbsoluteFill } from "remotion";
import { WorldMap } from "./hud-parts";

// Build-time asset, not a deliverable: renders the Natural Earth map (filled
// outline + dot grid) in white on transparent, once, to
// public/map/world-fill.png (scripts/build-map-texture.sh). The HUD uses that
// PNG as a tinted mask, because rasterising these very large paths on every
// frame was not bit-identical between a cold render and a sequence render.
export const MapTexture: React.FC = () => (
  <AbsoluteFill>
    <WorldMap mode="fill" color="#ffffff" opacity={1} dot={2.6} />
  </AbsoluteFill>
);
