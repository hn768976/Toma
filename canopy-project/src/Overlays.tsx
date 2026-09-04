import React from "react";
import { AbsoluteFill } from "remotion";
import { VANISHING_POINT } from "./layout";
import type { Palette } from "./palette";

const CX = `${VANISHING_POINT.x * 100}%`;
const CY = `${VANISHING_POINT.y * 100}%`;

/** Soft glow around the vanishing point, wrapping over the near branches. */
export const Bloom: React.FC<{ palette: Palette }> = ({ palette }) => (
  <AbsoluteFill
    style={{
      background:
        `radial-gradient(ellipse 36% 46% at ${CX} ${CY}, ` +
        `rgba(${palette.bloom}, ${palette.bloomOpacity}) 0%, ` +
        `rgba(${palette.bloom}, ${palette.bloomOpacity * 0.42}) 32%, ` +
        `rgba(${palette.bloom}, 0) 100%)`,
      mixBlendMode: "screen",
      pointerEvents: "none",
    }}
  />
);

/** Neutral corner falloff — pure black, so it adds no cast of its own. */
export const Vignette: React.FC<{ palette: Palette }> = ({ palette }) => (
  <AbsoluteFill
    style={{
      background:
        `radial-gradient(ellipse 82% 88% at ${CX} ${CY}, ` +
        `rgba(0, 0, 0, 0) 38%, ` +
        `rgba(0, 0, 0, ${palette.vignette * 0.42}) 74%, ` +
        `rgba(0, 0, 0, ${palette.vignette}) 100%)`,
      pointerEvents: "none",
    }}
  />
);
