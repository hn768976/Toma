import React from "react";

/**
 * Radial darkening at the frame edges. `strength` is the alpha reached in the
 * corners; the falloff starts at `inner` (fraction of the radius) so the centre
 * of the image is untouched.
 */
export const Vignette: React.FC<{
  strength?: number;
  inner?: number;
  color?: string;
}> = ({strength = 0.24, inner = 0.42, color = "#000000"}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: `radial-gradient(ellipse 74% 74% at 50% 48%, ${color}00 ${inner * 100}%, ${color}${Math.round(
        strength * 0.55 * 255,
      )
        .toString(16)
        .padStart(2, "0")} 74%, ${color}${Math.round(strength * 255)
        .toString(16)
        .padStart(2, "0")} 100%)`,
    }}
  />
);
