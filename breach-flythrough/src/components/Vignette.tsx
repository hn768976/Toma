import React from "react";

/** Corner falloff, so the flight reads as seen through a lens. */
export const Vignette: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(ellipse 74% 74% at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.45) 72%, rgba(0,0,0,0.86) 100%)",
      pointerEvents: "none",
    }}
  />
);
