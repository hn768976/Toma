import React from "react";

/*
 * Circles and ellipses drawn as fine polygon paths instead of <circle> /
 * <ellipse>. Chrome rasterises native SVG circles through a special-cased
 * oval path whose anti-aliasing can vary between renders depending on
 * scheduling, which broke byte-for-byte determinism. Plain paths rasterise
 * identically every time. With 2-8 segments per design px of radius the
 * polygon is visually indistinguishable from a true circle.
 */
const ellipseD = (cx: number, cy: number, rx: number, ry: number, phase = 0) => {
  const n = Math.max(24, Math.min(160, Math.ceil(Math.max(rx, ry) * 2)));
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n + phase) * Math.PI * 2;
    d += (i ? "L" : "M") + (cx + rx * Math.cos(a)).toFixed(2) + " " + (cy + ry * Math.sin(a)).toFixed(2);
  }
  return d + "Z";
};

type Common = Omit<React.SVGProps<SVGPathElement>, "d" | "ref">;

export const Circle: React.FC<Common & { cx: number; cy: number; r: number; phase?: number }> = ({ cx, cy, r, phase, ...rest }) => (
  <path d={ellipseD(cx, cy, r, r, phase)} {...rest} />
);

export const Ellipse: React.FC<Common & { cx: number; cy: number; rx: number; ry: number }> = ({ cx, cy, rx, ry, ...rest }) => (
  <path d={ellipseD(cx, cy, rx, ry)} {...rest} />
);
