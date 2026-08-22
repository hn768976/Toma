// Every emissive object gets one of these behind it: a soft radial glow in
// its own hue, wide and blurred. It is the only place a gradient is allowed.

import React from "react";

export const Glow: React.FC<{
  color: string;
  size: number;
  opacity?: number;
  blur?: number;
  x?: number;
  y?: number;
}> = ({ color, size, opacity = 0.4, blur, x = 0, y = 0 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: size,
      height: size,
      marginLeft: -size / 2,
      marginTop: -size / 2,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${color} 0%, ${color} 22%, transparent 68%)`,
      opacity,
      filter: `blur(${blur ?? Math.round(size * 0.16)}px)`,
      pointerEvents: "none",
    }}
  />
);
