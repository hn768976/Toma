/**
 * SVG path helpers. Angles are in degrees with 0 at 12 o'clock, increasing
 * clockwise, which makes the layout tables readable as clock positions.
 */
export const polar = (r: number, deg: number) => {
  const t = ((deg - 90) * Math.PI) / 180;
  return { x: r * Math.cos(t), y: r * Math.sin(t) };
};

/** Open arc along a circle of radius `r`. Never call with |a1 - a0| >= 360. */
export const arcPath = (r: number, a0: number, a1: number) => {
  const p0 = polar(r, a0);
  const p1 = polar(r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y}`;
};

/** Straight segment along the radius at `deg`, from r0 out to r1. */
export const radialPath = (r0: number, r1: number, deg: number) => {
  const p0 = polar(r0, deg);
  const p1 = polar(r1, deg);
  return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`;
};

/** Closed rectangle as an explicit path so `pathLength` draw-on is reliable. */
export const rectPath = (x: number, y: number, w: number, h: number) =>
  `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;

/**
 * Places an element at polar (r, deg) and turns it so its local +y points
 * outward — i.e. tangential alignment, which is how every ring element sits.
 */
export const tangentialTransform = (r: number, deg: number) => {
  const p = polar(r, deg);
  return `translate(${p.x} ${p.y}) rotate(${deg})`;
};
