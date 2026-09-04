import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { makeRng } from "../rng";
import type { Theme } from "../theme";

/**
 * Screen texture: grid, scanlines, grain, glow and vignette.
 *
 * The grain tile is a single fixed SVG turbulence, translated by a
 * seeded offset each frame — cheaper than re-running feTurbulence over
 * a 4K frame 600 times, and it reads the same.
 */

const NOISE_TILE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220">
     <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/></filter>
     <rect width="220" height="220" filter="url(#n)"/>
   </svg>`,
)}`;

const grainRng = makeRng(0x1f77);
const GRAIN_OFFSETS = Array.from({ length: 600 }, () => ({
  x: Math.floor(grainRng() * 220),
  y: Math.floor(grainRng() * 220),
}));

export const BackgroundField: React.FC<{ theme: Theme }> = ({ theme }) => {
  const { height } = useVideoConfig();
  const cell = height * 0.0555;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `
          radial-gradient(120% 100% at 50% 42%, ${theme.bg} 0%, ${theme.bgDeep} 100%)
        `,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, ${theme.grid} ${Math.max(1, height * 0.0009)}px, transparent 0),
            linear-gradient(to bottom, ${theme.grid} ${Math.max(1, height * 0.0009)}px, transparent 0)
          `,
          backgroundSize: `${cell}px ${cell}px, ${cell}px ${cell}px`,
          opacity: 0.75,
        }}
      />
    </div>
  );
};

export const ScreenTexture: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const off = GRAIN_OFFSETS[frame % GRAIN_OFFSETS.length];
  const scanPeriod = Math.max(2, height * 0.0028);

  return (
    <>
      {/* Glow pooling around the centre panel. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(46% 44% at 50% 60%, ${theme.glow} 0%, transparent 72%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
      {/* Scanlines, ~5%. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(
            to bottom,
            rgba(0,0,0,0.5) 0px,
            rgba(0,0,0,0.5) ${scanPeriod / 3}px,
            transparent ${scanPeriod / 3}px,
            transparent ${scanPeriod}px
          )`,
          opacity: 0.05,
          pointerEvents: "none",
        }}
      />
      {/* Grain, ~2%. */}
      <div
        style={{
          position: "absolute",
          inset: `-240px`,
          backgroundImage: `url("${NOISE_TILE}")`,
          backgroundPosition: `${off.x}px ${off.y}px`,
          opacity: 0.02,
          pointerEvents: "none",
        }}
      />
      {/* Vignette. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(78% 74% at 50% 50%, transparent 42%, rgba(0,0,0,0.62) 100%)",
          pointerEvents: "none",
        }}
      />
    </>
  );
};
