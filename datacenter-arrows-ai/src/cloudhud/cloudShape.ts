/**
 * Cloud outline built from three circles (left, middle, right lobes) and a
 * flat base, as one SVG path in local coordinates centred on (0, 0).
 */
type Circle = { cx: number; cy: number; r: number };

const L: Circle = { cx: -390, cy: 120, r: 180 };
const M: Circle = { cx: -40, cy: -60, r: 290 };
const R: Circle = { cx: 310, cy: 70, r: 230 };
const BASE_Y = 300;

/** Upper intersection point of two circles. */
const upperIntersection = (a: Circle, b: Circle) => {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const d = Math.hypot(dx, dy);
  const l = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const h = Math.sqrt(a.r * a.r - l * l);
  const mx = a.cx + (dx * l) / d;
  const my = a.cy + (dy * l) / d;
  const p1 = { x: mx + (h * -dy) / d, y: my + (h * dx) / d };
  const p2 = { x: mx - (h * -dy) / d, y: my - (h * dx) / d };
  return p1.y < p2.y ? p1 : p2;
};

const ang = (c: Circle, p: { x: number; y: number }) => Math.atan2(p.y - c.cy, p.x - c.cx);

/** SVG arc command going counter-clockwise on screen (sweep-flag 0). */
const arcCcw = (c: Circle, from: { x: number; y: number }, to: { x: number; y: number }) => {
  let span = ang(c, from) - ang(c, to);
  while (span < 0) span += Math.PI * 2;
  const large = span > Math.PI ? 1 : 0;
  return `A ${c.r} ${c.r} 0 ${large} 0 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
};

const buildCloudPath = () => {
  const lBottom = { x: L.cx, y: L.cy + L.r };
  const rBottom = { x: R.cx, y: R.cy + R.r };
  const rm = upperIntersection(R, M);
  const ml = upperIntersection(M, L);
  // base is flat between the lobe bottoms; lobes reach BASE_Y exactly
  return [
    `M ${lBottom.x} ${BASE_Y}`,
    `L ${rBottom.x} ${BASE_Y}`,
    arcCcw(R, rBottom, rm),
    arcCcw(M, rm, ml),
    arcCcw(L, ml, lBottom),
    "Z",
  ].join(" ");
};

export const CLOUD_PATH = buildCloudPath();
/** Bounding box of the cloud in local coordinates. */
export const CLOUD_BOX = {
  left: L.cx - L.r,
  right: R.cx + R.r,
  top: M.cy - M.r,
  bottom: BASE_Y,
};
const inside = (x: number, y: number) => {
  for (const c of [L, M, R]) if ((x - c.cx) ** 2 + (y - c.cy) ** 2 <= c.r * c.r) return true;
  return x >= L.cx && x <= R.cx && y >= 100 && y <= BASE_Y;
};

/** Where a ray from the cloud's centre at `angle` leaves the outline (local units). */
export const cloudAnchor = (angle: number) => {
  const ox = -30;
  const oy = 60;
  let last = 0;
  for (let t = 0; t < 900; t += 2) {
    if (inside(ox + Math.cos(angle) * t, oy + Math.sin(angle) * t)) last = t;
  }
  return { x: ox + Math.cos(angle) * (last + 6), y: oy + Math.sin(angle) * (last + 6) };
};
