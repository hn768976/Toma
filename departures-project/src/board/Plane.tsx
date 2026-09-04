import React from "react";

/**
 * The header glyph: an airliner seen from above, banked to the right. Drawn
 * here as a path rather than pulled from an icon set.
 */
export const Plane: React.FC<{ size: number; color: string; glow?: string }> = ({
  size,
  color,
  glow,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 200 200"
    style={{ display: "block", filter: glow ? `drop-shadow(0 0 ${size * 0.05}px ${glow})` : undefined }}
  >
    <g transform="rotate(-21 100 100)">
      <path
        fill={color}
        d="M196 100 C178 92 160 89 140 90 L70 14 L52 16 L106 88 L46 84 L18 46 L6 48 L24 84 L4 86 L2 100 L4 114 L24 116 L6 152 L18 154 L46 116 L106 112 L52 184 L70 186 L140 110 C160 111 178 108 196 100 Z"
      />
    </g>
  </svg>
);
