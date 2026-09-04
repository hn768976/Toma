import React from "react";
import { AbsoluteFill } from "remotion";

/** Corner falloff, painted over everything including the grain. */
export const Vignette: React.FC<{ gradient: string }> = ({ gradient }) => (
  <AbsoluteFill style={{ backgroundImage: gradient, pointerEvents: "none" }} />
);
