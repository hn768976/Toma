import React from "react";
import { AbsoluteFill } from "remotion";

/** Light corner falloff. V1 only - on a white field it reads as dirt. */
export const Vignette: React.FC<{ strength: number }> = ({ strength }) => {
  if (strength <= 0) {
    return null;
  }
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 78% 78% at 50% 50%, rgba(0,0,0,0) 38%, rgba(0,0,0,${strength}) 100%)`,
        pointerEvents: "none",
      }}
    />
  );
};
