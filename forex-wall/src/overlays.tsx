import React from "react";
import { AbsoluteFill } from "remotion";
import { DURATION_IN_FRAMES } from "./constants";
import type { Theme } from "./theme";

/**
 * A tileable fractal-noise tile, repeated across the frame and nudged each
 * frame. Generating one small tile and repeating it costs a fraction of
 * running feTurbulence across a 4K surface, and `stitchTiles` keeps the
 * seams invisible.
 */
const GRAIN_TILE = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter>` +
    `<rect width='320' height='320' filter='url(#n)'/></svg>`,
);

const GRAIN_STEPS = 16;

export const Grain: React.FC<{ opacity: number; frame: number; u: number }> = ({
  opacity,
  frame,
  u,
}) => {
  // Periodic in the loop, so the grain pattern at frame 480 is the one at 0.
  const step = frame % GRAIN_STEPS;
  const gx = ((step * 97) % 320) * u;
  const gy = ((step * 173) % 320) * u;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("data:image/svg+xml,${GRAIN_TILE}")`,
        backgroundRepeat: "repeat",
        backgroundSize: `${320 * u}px ${320 * u}px`,
        backgroundPosition: `${gx}px ${gy}px`,
        opacity,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};

/** Faint bluish lift, as a screen of this size gives off in a dark room. */
export const ScreenGlow: React.FC<{ strength: number }> = ({ strength }) => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(58% 62% at 68% 42%, rgba(88,150,210,0.10) 0%, rgba(60,110,170,0.045) 45%, rgba(0,0,0,0) 78%)",
      opacity: strength,
      mixBlendMode: "screen",
      pointerEvents: "none",
    }}
  />
);

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(76% 84% at 60% 44%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.34) 74%, rgba(0,0,0,0.66) 100%)",
      pointerEvents: "none",
    }}
  />
);

/**
 * Softens the horizon so the deepest rows fade out instead of stopping at a
 * hard edge where the plane runs out of quotes.
 */
export const HorizonHaze: React.FC<{ theme: Theme }> = ({ theme }) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(to right, ${theme.background} 0%, ${theme.background}00 6%)`,
      pointerEvents: "none",
    }}
  />
);

export const loopFraction = (frame: number): number =>
  (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;
