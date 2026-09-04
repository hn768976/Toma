export const clamp = (v: number, lo = 0, hi = 1) =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Cubic ease-out; used for the draw-on so it settles rather than stops. */
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

export const easeInOutSine = (t: number) =>
  -(Math.cos(Math.PI * clamp(t)) - 1) / 2;

export type Vec2 = { x: number; y: number };

/**
 * Centripetal Catmull-Rom interpolation between p1 and p2.
 * Used to turn the hand-authored anchor sets into smooth contours.
 */
export const catmullRom = (
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number,
): Vec2 => {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 *
    (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
};

/** Resample a polyline (closed or open) at a fixed arc-length step. */
export const resample = (pts: Vec2[], step: number, closed: boolean): Vec2[] => {
  const src = closed ? [...pts, pts[0]] : pts;
  const out: Vec2[] = [];
  let carry = 0;
  for (let i = 0; i < src.length - 1; i++) {
    const a = src[i];
    const b = src[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    let d = carry;
    while (d < len) {
      const t = d / len;
      out.push({ x: a.x + dx * t, y: a.y + dy * t });
      d += step;
    }
    carry = d - len;
  }
  return out;
};
