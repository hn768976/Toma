// Doodle shape generators (centre-lines for the pen).
import { cubic, handEllipse, handLine, Pt, wobble } from './geom';
import { range, Rng, signed } from './random';

/** 5-point star vertices with hand jitter. */
export const starPoints = (c: Pt, R: number, r: Rng, rot = 0): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + rot + (i * Math.PI) / 5 + signed(r, 0.06);
    const rad = (i % 2 ? R * range(r, 0.4, 0.5) : R * range(r, 0.88, 1.08));
    pts.push([c[0] + rad * Math.cos(a), c[1] + rad * Math.sin(a)]);
  }
  return pts;
};

/** A star drawn in one stroke around its outline, ending a little past the start. */
export const starStroke = (c: Pt, R: number, r: Rng, rot = 0): Pt[] => {
  const v = starPoints(c, R, r, rot);
  const loop = [...v, v[0], v[1]];
  const out: Pt[] = [];
  for (let i = 0; i < loop.length - 1; i++) {
    let b = loop[i + 1];
    if (i === loop.length - 2) b = [loop[i][0] + (b[0] - loop[i][0]) * 0.25, loop[i][1] + (b[1] - loop[i][1]) * 0.25];
    out.push(...handLine(loop[i], b, r, 2).slice(i ? 1 : 0));
  }
  return out;
};

/** 4-point sparkle (concave diamond), one stroke. */
export const sparkleStroke = (c: Pt, R: number, r: Rng): Pt[] => {
  const tips: Pt[] = [0, 1, 2, 3, 4].map((i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 2 + signed(r, 0.05);
    const rad = R * (i % 2 ? range(r, 0.62, 0.78) : range(r, 0.95, 1.08));
    return [c[0] + rad * Math.cos(a), c[1] + rad * Math.sin(a)];
  });
  const out: Pt[] = [];
  for (let i = 0; i < 4; i++) {
    const a = tips[i];
    const b = i === 3 ? ([tips[4][0] + signed(r, 10), tips[4][1] + range(r, 8, 22)] as Pt) : tips[i + 1];
    const k = range(r, 0.1, 0.2);
    const m1: Pt = [a[0] + (c[0] - a[0]) * (0.75 - k), a[1] + (c[1] - a[1]) * (0.75 - k)];
    const m2: Pt = [b[0] + (c[0] - b[0]) * (0.75 - k), b[1] + (c[1] - b[1]) * (0.75 - k)];
    out.push(...cubic(a, m1, m2, b, 30).slice(i ? 1 : 0));
  }
  return wobble(out, r, 2, 400);
};

/** Short radiating dashes around a centre. */
export const rays = (c: Pt, r0: number, r1: number, n: number, r: Rng, rot = 0): Pt[][] =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (i * Math.PI * 2) / n + signed(r, 0.12);
    const a0 = r0 * range(r, 0.9, 1.1);
    const a1 = r1 * range(r, 0.8, 1.15);
    return handLine([c[0] + a0 * Math.cos(a), c[1] + a0 * Math.sin(a)], [c[0] + a1 * Math.cos(a), c[1] + a1 * Math.sin(a)], r, 1.5);
  });

/** "Shine" marks: three ticks fanning out from a corner. */
export const shineMarks = (c: Pt, dir: number, len: number, r: Rng): Pt[][] =>
  [-0.55, 0, 0.55].map((d, i) => {
    const a = dir + d + signed(r, 0.08);
    const l = len * (i === 1 ? range(r, 1.05, 1.2) : range(r, 0.7, 0.9));
    const s0 = len * 0.25;
    return handLine([c[0] + Math.cos(a) * s0, c[1] + Math.sin(a) * s0], [c[0] + Math.cos(a) * (s0 + l), c[1] + Math.sin(a) * (s0 + l)], r, 1.5);
  });

/** Speech bubble centre-line: ellipse with a tail, as one closed loop starting at the tail. */
export const speechBubble = (c: Pt, rx: number, ry: number, tip: Pt, r: Rng, gap = 0.34): Pt[] => {
  const ta = Math.atan2((tip[1] - c[1]) / ry, (tip[0] - c[0]) / rx);
  const a0 = ta + gap / 2;
  const a1 = ta + Math.PI * 2 - gap / 2;
  const n = 90;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const k = 1 + 0.035 * Math.sin(a * 3 + 1.3);
    pts.push([c[0] + Math.cos(a) * rx * k, c[1] + Math.sin(a) * ry * k]);
  }
  const end = pts[pts.length - 1];
  const t2 = handLine(end, tip, r, 3);
  const t3 = handLine(tip, [pts[0][0] + signed(r, 6), pts[0][1] + signed(r, 6)], r, 3);
  return [...pts, ...t2.slice(1), ...t3.slice(1)];
};

/** Rounded-rectangle speech bubble with a tail on the bottom edge. */
export const boxBubble = (x: number, y: number, w: number, h: number, tipX: number, tip: Pt, r: Rng): Pt[] => {
  const rad = Math.min(w, h) * 0.28;
  const corner = (cx: number, cy: number, a0: number): Pt[] =>
    Array.from({ length: 13 }, (_, i) => {
      const a = a0 + (i / 12) * (Math.PI / 2);
      return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad] as Pt;
    });
  const tw = w * 0.07;
  // build clockwise from the tail: bottom-right corner, right edge up, top, left, bottom-left, back to tail
  const br = corner(x + w - rad, y + h - rad, 0).reverse(); // from bottom to right
  const tr = corner(x + w - rad, y + rad, -Math.PI / 2).reverse(); // right to top
  const tl = corner(x + rad, y + rad, Math.PI).reverse(); // top to left
  const bl = corner(x + rad, y + h - rad, Math.PI / 2).reverse(); // left to bottom
  const loop: Pt[] = [[tipX + tw, y + h], ...br, ...tr, ...tl, ...bl, [tipX - tw, y + h]];
  const smooth = wobble(loop, r, 6, 900);
  const t2 = handLine(smooth[smooth.length - 1], tip, r, 3);
  const t3 = handLine(tip, [smooth[0][0] + signed(r, 5), smooth[0][1] + signed(r, 5)], r, 3);
  return [...smooth, ...t2.slice(1), ...t3.slice(1)];
};

/** Thought-cloud outline: scalloped bumps around an ellipse, one loop. */
export const cloud = (c: Pt, rx: number, ry: number, bumps: number, r: Rng): Pt[] => {
  const pts: Pt[] = [];
  const start = range(r, 0, Math.PI * 2);
  for (let b = 0; b < bumps; b++) {
    const a0 = start + (b / bumps) * Math.PI * 2;
    const a1 = start + ((b + 1) / bumps) * Math.PI * 2;
    const p0: Pt = [c[0] + Math.cos(a0) * rx, c[1] + Math.sin(a0) * ry];
    const p1: Pt = [c[0] + Math.cos(a1) * rx, c[1] + Math.sin(a1) * ry];
    const am = (a0 + a1) / 2;
    const bulge = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * range(r, 0.42, 0.62);
    const n: Pt = [Math.cos(am), Math.sin(am)];
    const m1: Pt = [p0[0] + n[0] * bulge + (p1[0] - p0[0]) * 0.05, p0[1] + n[1] * bulge + (p1[1] - p0[1]) * 0.05];
    const m2: Pt = [p1[0] + n[0] * bulge - (p1[0] - p0[0]) * 0.05, p1[1] + n[1] * bulge - (p1[1] - p0[1]) * 0.05];
    pts.push(...cubic(p0, m1, m2, p1, 22).slice(b ? 1 : 0));
  }
  pts.push(...cubic(pts[pts.length - 1], pts[pts.length - 1], pts[3], pts[6], 6).slice(1));
  return wobble(pts, r, 4, 700);
};

/** Back-and-forth paint-marker passes over a box (for filling a shape in). */
export const paintZigzag = (x0: number, y0: number, x1: number, y1: number, gap: number): Pt[] => {
  const pts: Pt[] = [];
  let y = y0;
  let dir = 1;
  while (y <= y1 + gap) {
    pts.push(dir > 0 ? [x0, y] : [x1, y]);
    pts.push(dir > 0 ? [x1, y + gap * 0.5] : [x0, y + gap * 0.5]);
    y += gap;
    dir = -dir;
  }
  return pts;
};

export const bbox = (pts: Pt[]) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};

/** A small heart, one stroke, slightly lopsided, ending past its start. */
export const heartStroke = (c: Pt, s: number, r: Rng): Pt[] => {
  const k = range(r, 0.92, 1.08);
  const bottom: Pt = [c[0] + signed(r, s * 0.04), c[1] + s * 0.95];
  const top: Pt = [c[0], c[1] - s * 0.35];
  const left = cubic(top, [c[0] - s * 0.35, c[1] - s * 1.05], [c[0] - s * 1.25 * k, c[1] - s * 0.35], bottom, 40);
  const right = cubic(bottom, [c[0] + s * 1.2, c[1] - s * 0.3], [c[0] + s * 0.42, c[1] - s * 1.08], [top[0] + s * 0.05, top[1] + s * 0.12], 40);
  return wobble([...left, ...right.slice(1)], r, s * 0.02, s * 2);
};

/** Spiral curl (corner flourish). */
export const curl = (c: Pt, R: number, turns: number, rot: number, dir: 1 | -1, r: Rng): Pt[] => {
  const n = Math.ceil(60 * turns);
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = rot + dir * t * turns * Math.PI * 2;
    const rad = R * (1 - t * 0.82);
    pts.push([c[0] + Math.cos(a) * rad, c[1] + Math.sin(a) * rad]);
  }
  return wobble(pts, r, 2, 300);
};

export { handEllipse };

/** A bell doodle: body (one stroke), rim, clapper, knob. Centre c = middle of the body. */
export const bellStrokes = (c: Pt, s: number, r: Rng): Pt[][] => {
  const [x, y] = c;
  const body = wobble(
    [
      ...cubic([x - s * 0.95, y + s * 0.62], [x - s * 0.62, y + s * 0.45], [x - s * 0.7, y - s * 0.2], [x - s * 0.5, y - s * 0.55], 30),
      ...cubic([x - s * 0.5, y - s * 0.55], [x - s * 0.3, y - s * 0.98], [x + s * 0.32, y - s * 0.98], [x + s * 0.5, y - s * 0.52], 30).slice(1),
      ...cubic([x + s * 0.5, y - s * 0.52], [x + s * 0.7, y - s * 0.15], [x + s * 0.6, y + s * 0.45], [x + s * 0.97, y + s * 0.6], 30).slice(1),
    ],
    r,
    s * 0.012,
    s * 2,
  );
  const rim = handLine([x + s * 1.0, y + s * 0.66], [x - s * 1.02, y + s * 0.7], r, s * 0.015);
  const clapper = handEllipse([x + s * 0.02, y + s * 0.86], s * 0.15, s * 0.12, 0.1, r, { wob: 1, sweep: Math.PI * 2 + 0.3 });
  const knob = handEllipse([x, y - s * 0.98], s * 0.1, s * 0.09, 0, r, { wob: 1, sweep: Math.PI * 2 + 0.2 });
  return [body, rim, clapper, knob];
};
