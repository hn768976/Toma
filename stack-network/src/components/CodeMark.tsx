import React from "react";

/**
 * The `</>` hero mark, drawn as three strokes in a 100x100 box.
 *
 * Mitred joins and butt caps give it the chunky, cut-from-plate look the
 * references have, rather than the rounded feel of a text glyph.
 */
export const CodeMark: React.FC<{
  size: number;
  color: string;
  weight?: number;
  /** Slight open/close of the two chevrons; 0 is the resting pose. */
  spread?: number;
}> = ({ size, color, weight = 8.5, spread = 0 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    stroke={color}
    strokeWidth={weight}
    strokeLinecap="butt"
    strokeLinejoin="miter"
    strokeMiterlimit={3}
    style={{ display: "block", overflow: "visible" }}
  >
    <path d={`M ${32 + spread} 20 L ${6 + spread} 50 L ${32 + spread} 80`} />
    <path d="M 56 16 L 44 84" />
    <path d={`M ${68 - spread} 20 L ${94 - spread} 50 L ${68 - spread} 80`} />
  </svg>
);
