import React from "react";
import { AbsoluteFill } from "remotion";
import { VANISHING_POINT } from "./layout";
import type { Palette } from "./palette";

/** The sky: brightest at the vanishing point, falling away toward the corners. */
export const Sky: React.FC<{ palette: Palette }> = ({ palette }) => {
  const cx = `${VANISHING_POINT.x * 100}%`;
  const cy = `${VANISHING_POINT.y * 100}%`;

  // Note the explicit two-axis ellipse: `circle <percentage>` is not valid
  // CSS and is silently dropped.
  const stops = palette.skyRamp
    .map(([at, t]) => `${mix(palette.skyCentre, palette.skyEdge, t)} ${at}%`)
    .join(", ");

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse ${palette.skySize[0]} ${palette.skySize[1]} at ${cx} ${cy}, ${stops})`,
      }}
    />
  );
};

const mix = (a: string, b: string, t: number) => {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(ar, br)}, ${c(ag, bg)}, ${c(ab, bb)})`;
};
