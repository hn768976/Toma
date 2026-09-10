// Path-data builders. Every mark in this clip is emitted as SVG path
// data we generate ourselves - no icon library, no font glyphs - so the
// output carries no third-party attribution requirement.

const n = (v: number) => Number(v.toFixed(3));

/** A full circle as two half-arcs. */
export const circlePath = (cx: number, cy: number, r: number) =>
  `M ${n(cx - r)} ${n(cy)} a ${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0 a ${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0 Z`;

/** Axis-aligned rectangle with a uniform corner radius. */
export const roundRectPath = (
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M ${n(x + rr)} ${n(y)}`,
    `H ${n(x + w - rr)}`,
    `A ${n(rr)} ${n(rr)} 0 0 1 ${n(x + w)} ${n(y + rr)}`,
    `V ${n(y + h - rr)}`,
    `A ${n(rr)} ${n(rr)} 0 0 1 ${n(x + w - rr)} ${n(y + h)}`,
    `H ${n(x + rr)}`,
    `A ${n(rr)} ${n(rr)} 0 0 1 ${n(x)} ${n(y + h - rr)}`,
    `V ${n(y + rr)}`,
    `A ${n(rr)} ${n(rr)} 0 0 1 ${n(x + rr)} ${n(y)}`,
    "Z",
  ].join(" ");
};

/**
 * A cogwheel outline: `teeth` trapezoid teeth standing on a root
 * circle, with a bore punched out. Returned as a single even-odd path.
 */
export const gearPath = (
  cx: number,
  cy: number,
  rootR: number,
  tipR: number,
  boreR: number,
  teeth: number,
) => {
  const step = (Math.PI * 2) / teeth;
  const tipHalf = step * 0.17;
  const rootHalf = step * 0.31;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const c = i * step;
    const ring: [number, number][] = [
      [c - rootHalf, rootR],
      [c - tipHalf, tipR],
      [c + tipHalf, tipR],
      [c + rootHalf, rootR],
    ];
    for (const [a, r] of ring) {
      pts.push(`${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)}`);
    }
  }
  return `M ${pts[0]} L ${pts.slice(1).join(" L ")} Z ${circlePath(cx, cy, boreR)}`;
};
