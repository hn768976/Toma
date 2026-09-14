import React from "react";

export type ScreenTextureProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  pitch?: number;
  opacity?: number;
  color?: string;
};

// Faint LED pitch across the dashboard plane. It is what sells these
// frames as a physical display rather than a flat graphic, and because
// it lives inside the SVG it bends with the camera like real pixels.
export const ScreenTexture: React.FC<ScreenTextureProps> = ({
  x,
  y,
  width,
  height,
  pitch = 6,
  opacity = 0.12,
  color = "rgba(0, 0, 0, 0.85)",
}) => (
  <g opacity={opacity}>
    <defs>
      <pattern
        id={`led-${pitch}`}
        width={pitch}
        height={pitch}
        patternUnits="userSpaceOnUse"
      >
        <rect width={pitch} height={pitch * 0.5} fill={color} />
      </pattern>
    </defs>
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={`url(#led-${pitch})`}
    />
  </g>
);
