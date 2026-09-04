import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { hashInt } from "./random";

/**
 * Film grain, tiled from a 192x192 noise plate in `public/textures`.
 *
 * The tile is offset by a hash of the frame rather than by a running counter,
 * so it is reproducible when frames are rendered out of order and it repeats
 * exactly at the loop.
 */
export const Grain: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  // One noise pixel covers four frame pixels at 4K, two at the 1080p preview.
  // Grain finer than that sits at Nyquist: it reads as digital noise rather
  // than film, and it is the most expensive thing an H.264 encoder can be
  // asked to keep.
  const tile = 192 * (width / 960);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile("textures/grain.png")})`,
        backgroundSize: `${tile}px ${tile}px`,
        backgroundPosition: `${hashInt(0, 191, frame, "gx")}px ${hashInt(0, 191, frame, "gy")}px`,
        imageRendering: "pixelated",
        mixBlendMode: "overlay",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

/** Very faint horizontal scanlines, as on a large backlit panel. */
export const Scanlines: React.FC<{ opacity: number }> = ({ opacity }) => {
  const { height } = useVideoConfig();
  const period = Math.max(3, Math.round(height / 240));
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `repeating-linear-gradient(180deg, rgba(0,0,0,0.9) 0px, rgba(0,0,0,0.9) ${
          period / 2
        }px, rgba(0,0,0,0) ${period / 2}px, rgba(0,0,0,0) ${period}px)`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

/** The soft wash a bright panel throws over its own surface. */
export const ScreenGlow: React.FC<{ color: string; opacity: number }> = ({ color, opacity }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 62% 55% at 50% 38%, ${color} 0%, rgba(0,0,0,0) 72%)`,
      mixBlendMode: "screen",
      opacity,
      pointerEvents: "none",
    }}
  />
);

export const Vignette: React.FC<{ strength: number }> = ({ strength }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 78% 78% at 50% 50%, rgba(0,0,0,0) 42%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);
