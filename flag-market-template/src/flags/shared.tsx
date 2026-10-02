import React, { useId } from "react";

// A flag is drawn in its own native coordinate system (`width` x `height`
// = the official construction-sheet grid). <FlagSvg> places it anywhere.
export type FlagDef = {
  width: number;
  height: number;
  /** Draws the flag in viewBox coordinates. `uid` keeps <defs> ids unique. */
  draw: (uid: string) => React.ReactNode;
};

export const FlagSvg: React.FC<{
  flag: FlagDef;
  style?: React.CSSProperties;
  width?: number | string;
  height?: number | string;
}> = ({ flag, style, width = "100%", height = "100%" }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      viewBox={`0 0 ${flag.width} ${flag.height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      style={{ display: "block", ...style }}
    >
      {flag.draw(uid)}
    </svg>
  );
};

/**
 * Points of a regular n-pointed star, first point straight up (before
 * `rotateDeg`, which is clockwise on screen).
 */
export const starPoints = (
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  n = 5,
  rotateDeg = 0,
) => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((-90 + rotateDeg + (i * 180) / n) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(4)},${(cy + r * Math.sin(a)).toFixed(4)}`);
  }
  return pts.join(" ");
};

// Inner/outer radius ratio of a regular pentagram (cos72 / cos36).
export const PENTAGRAM_INNER = 0.381966;
