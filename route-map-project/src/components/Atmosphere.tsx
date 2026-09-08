import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import type { PaletteSpec } from "../lib/palettes";

interface DofProps {
  width: number;
  height: number;
}

/**
 * Light depth of field: the mid band stays sharp and the far top and near
 * bottom soften. `backdrop-filter` blurs what is already painted underneath, so
 * the scene is rasterised once rather than twice.
 */
export const DepthOfField: React.FC<DofProps> = ({ width, height }) => {
  const far = width * 0.0026;
  const near = width * 0.0019;
  // Each band is only as tall as the gradient that fades it out. A full-frame
  // element would make Chrome blur the whole backdrop twice per frame, which at
  // 4K is the single most expensive thing on the page.
  const farBand = Math.round(height * 0.32);
  const nearBand = Math.round(height * 0.24);
  const fade = "linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.55) 38%, transparent 100%)";
  const fadeUp = "linear-gradient(to top, #000 0%, rgba(0,0,0,0.5) 34%, transparent 100%)";
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height: farBand,
          backdropFilter: `blur(${far}px)`,
          WebkitBackdropFilter: `blur(${far}px)`,
          maskImage: fade,
          WebkitMaskImage: fade,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: height - nearBand,
          width,
          height: nearBand,
          backdropFilter: `blur(${near}px)`,
          WebkitBackdropFilter: `blur(${near}px)`,
          maskImage: fadeUp,
          WebkitMaskImage: fadeUp,
          pointerEvents: "none",
        }}
      />
    </>
  );
};

export const Vignette: React.FC<{ pal: PaletteSpec }> = ({ pal }) => (
  <>
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 82% 76% at 50% 52%, transparent 0%, transparent 52%, ${pal.vignette} 100%)`,
        pointerEvents: "none",
      }}
    />
    <AbsoluteFill
      style={{
        background: `linear-gradient(to bottom, ${pal.vignette} 0%, transparent 18%)`,
        opacity: 0.5,
        pointerEvents: "none",
      }}
    />
  </>
);

interface GrainProps {
  frame: number;
  width: number;
}

/** ~2% grain from a pre-baked tile, jittered per frame. */
export const Grain: React.FC<GrainProps> = ({ frame, width }) => {
  const tile = Math.round(width / 7.5);
  const ox = (frame * 137) % 512;
  const oy = (frame * 251) % 512;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile("grain.png")})`,
        backgroundSize: `${tile}px ${tile}px`,
        backgroundPosition: `${ox}px ${oy}px`,
        opacity: 0.021,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};
