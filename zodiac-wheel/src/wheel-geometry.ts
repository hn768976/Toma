/**
 * Polar helpers. Everything in the wheel is authored in a normalised disc
 * space where the outer radius is exactly 1000 units, then scaled once. The
 * tilt is a single vertical squash applied to the whole group -- nothing is
 * projected per element.
 */

export const UNIT = 1000;

/** Angle 0 is 12 o'clock; angles increase clockwise, matching SVG's y-down. */
export const polar = (angleDeg: number, radius: number): [number, number] => {
  const a = (angleDeg * Math.PI) / 180;
  return [radius * Math.sin(a), -radius * Math.cos(a)];
};

export const polarPoint = (angleDeg: number, radius: number) => {
  const [x, y] = polar(angleDeg, radius);
  return `${x.toFixed(2)},${y.toFixed(2)}`;
};

/** A circular arc from angle a0 to a1 (clockwise) at a fixed radius. */
export const arcPath = (a0: number, a1: number, radius: number): string => {
  const [x0, y0] = polar(a0, radius);
  const [x1, y1] = polar(a1, radius);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

/** A radial segment along one angle. */
export const spokePath = (angleDeg: number, r0: number, r1: number): string => {
  const [x0, y0] = polar(angleDeg, r0);
  const [x1, y1] = polar(angleDeg, r1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

/**
 * Dash pattern that turns one stroked circle into `count` evenly spaced marks.
 * Used for the dotted ring and both tick bands -- a thick dashed circle draws
 * radial marks for the price of a single node, and stays perfectly crisp.
 */
export const evenDashes = (radius: number, count: number, markWidth: number) => {
  const step = (2 * Math.PI * radius) / count;
  return `${markWidth} ${Math.max(0.01, step - markWidth)}`;
};
