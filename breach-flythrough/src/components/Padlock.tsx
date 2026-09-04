import React from "react";

/**
 * Padlock icon, drawn inline so it scales to any render resolution without a
 * raster asset.
 *
 * The open shackle is an explicit path rather than the closed one under a
 * rotation: rotating it swings a leg out through the side of the body, and at
 * the sizes the nearest padlocks reach that reads as a drawing error rather
 * than as a lock that has been forced.
 */
export const Padlock: React.FC<{
  size: number;
  color: string;
  open: boolean;
  /** Bloom radius in px. The padlocks are the only lit objects in the scene. */
  glow: number;
  opacity: number;
}> = ({ size, color, open, glow, opacity }) => {
  const stroke = 10;
  return (
    <svg
      width={size * (100 / 130)}
      height={size}
      viewBox="0 0 100 130"
      fill="none"
      style={{
        display: "block",
        opacity,
        filter: `drop-shadow(0 0 ${glow * 0.35}px ${color}) drop-shadow(0 0 ${glow}px ${color})`,
      }}
    >
      <path
        d={
          open
            ? // Attached at the left leg; the arc lifts over the top and its
              // free end is left hanging clear of the body.
              "M30 62 L30 34 A22 22 0 0 1 69 27"
            : "M30 62 L30 36 A20 20 0 0 1 70 36 L70 62"
        }
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <rect
        x={14}
        y={58}
        width={72}
        height={64}
        rx={9}
        stroke={color}
        strokeWidth={stroke}
      />
      {/* Keyhole: a bore with a tapered slot below it. */}
      <circle cx={50} cy={82} r={7.5} fill={color} />
      <path d="M45.5 87 H54.5 L57 105 H43 Z" fill={color} />
    </svg>
  );
};
