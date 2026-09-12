/** Small polar / SVG-path helpers shared by every dial on the board. */

export const rad = (deg: number) => (deg * Math.PI) / 180;

export const polar = (
  cx: number,
  cy: number,
  r: number,
  deg: number,
): [number, number] => [
  cx + Math.cos(rad(deg)) * r,
  cy + Math.sin(rad(deg)) * r,
];

/**
 * Arc path from `startDeg` clockwise by `sweepDeg` at radius `r`.
 * Drawn as a stroke, so the caller supplies stroke-width / linecap.
 */
export const arcPath = (
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  sweepDeg: number,
): string => {
  const [x0, y0] = polar(cx, cy, r, startDeg);
  const [x1, y1] = polar(cx, cy, r, startDeg + sweepDeg);
  const largeArc = Math.abs(sweepDeg) > 180 ? 1 : 0;
  const sweepFlag = sweepDeg >= 0 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${x1} ${y1}`;
};

/**
 * The needle blade: a tapered wedge pointing east from the origin, rounded at
 * the tip. The hub disc is drawn separately so the blade can be narrower than
 * the hub, the way a real pointer is.
 */
export const needlePath = (base: number, length: number, tip: number): string =>
  [
    `M 0 ${-base}`,
    `L ${length - tip} ${-tip}`,
    `A ${tip} ${tip} 0 0 1 ${length - tip} ${tip}`,
    `L 0 ${base}`,
    "Z",
  ].join(" ");

/** Clamped linear remap. */
export const remap = (
  v: number,
  a: number,
  b: number,
  c: number,
  d: number,
): number => {
  if (b === a) return c;
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return c + (d - c) * t;
};
