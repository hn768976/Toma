/**
 * Arc-length parameterisation of a pill (a rounded rect whose corner radius is
 * exactly half its height).
 *
 * Sampling the outline analytically rather than with `getPointAtLength()` keeps
 * the component a pure function of the frame: Remotion renders frames out of
 * order across threads, so nothing may depend on a measured DOM node.
 *
 * `t` runs 0..1 clockwise, starting where the left cap meets the top edge —
 * the "upper left" the gradient stops are described against.
 */
export type Pt = { x: number; y: number };

export const makePill = (cx: number, cy: number, w: number, h: number) => {
  const r = h / 2;
  const flat = Math.max(0, w - h); // length of one straight run
  const cap = Math.PI * r; // length of one semicircular end
  const perimeter = 2 * flat + 2 * cap;

  const pointAt = (t: number): Pt => {
    let s = (((t % 1) + 1) % 1) * perimeter;

    if (s < flat) {
      return { x: cx - flat / 2 + s, y: cy - r }; // top edge, left to right
    }
    s -= flat;

    if (s < cap) {
      const a = -Math.PI / 2 + (s / cap) * Math.PI; // right cap, top to bottom
      return { x: cx + flat / 2 + r * Math.cos(a), y: cy + r * Math.sin(a) };
    }
    s -= cap;

    if (s < flat) {
      return { x: cx + flat / 2 - s, y: cy + r }; // bottom edge, right to left
    }
    s -= flat;

    const a = Math.PI / 2 + (s / cap) * Math.PI; // left cap, bottom to top
    return { x: cx - flat / 2 + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  return { r, flat, cap, perimeter, pointAt };
};
