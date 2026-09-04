/** Small SVG path helpers, all pure. */

export const polar = (
  cx: number,
  cy: number,
  r: number,
  deg: number,
): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

export const norm360 = (d: number): number => ((d % 360) + 360) % 360;

/** An open arc from a0 to a1 (degrees, clockwise in SVG's y-down space). */
export const arcPath = (
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
): string => {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = norm360(a1 - a0) > 180 ? 1 : 0;
  return `M ${x0.toFixed(3)} ${y0.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
};

/** A filled pie wedge from the centre, a0 to a1. */
export const wedgePath = (
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
): string => {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = norm360(a1 - a0) > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0.toFixed(3)} ${y0.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z`;
};
