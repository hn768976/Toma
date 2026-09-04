import React from "react";
import { DURATION_IN_FRAMES } from "./constants";
import { hash } from "./random";
import type { Layout } from "./useLayout";
import type { Theme } from "./themes";

/** One tiled turbulence tile, built once and reused for every frame. */
const GRAIN_TILE =
  `url("data:image/svg+xml;utf8,` +
  `%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320'%3E` +
  `%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E` +
  `%3Crect width='320' height='320' filter='url(%23g)'/%3E%3C/svg%3E")`;

export const Grain: React.FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundImage: GRAIN_TILE,
      backgroundRepeat: "repeat",
      // Shifting the tile per frame keeps the grain alive; the shift is keyed
      // on frame % duration so it repeats at the loop point.
      backgroundPosition: `${hash(frame % DURATION_IN_FRAMES, 1) % 320}px ${
        hash(frame % DURATION_IN_FRAMES, 2) % 320
      }px`,
      opacity: 0.02,
      pointerEvents: "none",
    }}
  />
);

export const Scanlines: React.FC<{ layout: Layout }> = ({ layout }) => {
  const period = Math.max(2, Math.round(layout.rowH / 10) * 2); // 4px at 4K
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `repeating-linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) ${
          period / 2
        }px, rgba(0,0,0,0) ${period / 2}px, rgba(0,0,0,0) ${period}px)`,
        opacity: 0.05,
        pointerEvents: "none",
      }}
    />
  );
};

export const Vignette: React.FC<{ theme: Theme }> = ({ theme }) => (
  <>
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(to bottom, rgba(${theme.glow}, 0.07) 0%, rgba(${theme.glow}, 0.02) 22%, rgba(0,0,0,0) 40%)`,
        pointerEvents: "none",
      }}
    />
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(ellipse 72% 68% at 50% 46%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)",
        pointerEvents: "none",
      }}
    />
  </>
);

const GLITCH_INTENSITY = [0.55, 1, 0.85, 0.4];

/** Intensity of the wrap glitch at this frame, 0 when it is not running. */
export const glitchAt = (frame: number): number => {
  // Two frames before the wrap and two after, so it reads as continuous
  // across the loop point where the alert set resets.
  const w = (frame + 2) % DURATION_IN_FRAMES;
  return w < GLITCH_INTENSITY.length ? GLITCH_INTENSITY[w] : 0;
};

export const Glitch: React.FC<{
  frame: number;
  layout: Layout;
  theme: Theme;
}> = ({ frame, layout, theme }) => {
  const intensity = glitchAt(frame);
  if (intensity === 0) {
    return null;
  }

  const bands: React.ReactNode[] = [];
  for (let k = 0; k < 5; k++) {
    const h = hash(frame, k, 0x41);
    const height = layout.rowH * (0.25 + ((h >>> 3) % 100) / 100);
    bands.push(
      <div
        key={k}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: (h % 1000) / 1000 * layout.height,
          height,
          transform: `translateX(${
            (((h >>> 11) % 2 === 0 ? 1 : -1) * ((h >>> 13) % 40) * layout.charW) /
            10
          }px)`,
          backgroundColor:
            (h >>> 17) % 3 === 0
              ? `rgba(224, 16, 48, ${0.3 * intensity})`
              : `rgba(${theme.glow}, ${0.28 * intensity})`,
          mixBlendMode: "screen",
        }}
      />,
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {bands}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(255, 255, 255, ${0.04 * intensity})`,
        }}
      />
    </div>
  );
};
