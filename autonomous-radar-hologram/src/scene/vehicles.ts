/**
 * Procedural wireframe vehicles. Everything is generated in code (no model
 * assets): bodies are lofted from a handful of key cross-sections, then
 * emitted as quad wire segments plus a triangle list for the faint fill.
 *
 * Convention: metres, vehicle centred on x, wheels on y = 0, nose toward -z.
 */

export type Section = {
  z: number;
  /** bottom / top of the cross-section */
  y0: number;
  y1: number;
  /** half width at the bottom */
  hw: number;
  /** super-ellipse exponent (2 = ellipse, higher = boxier) */
  n: number;
  /** width multiplier at the top (tumblehome) */
  taper: number;
};

export type Shape = {
  /** flat list of segment endpoints: x,y,z,x,y,z per segment */
  wire: number[];
  /** flat list of triangle vertices */
  tris: number[];
};

export const emptyShape = (): Shape => ({ wire: [], tris: [] });

const sec = (
  z: number,
  y0: number,
  y1: number,
  hw: number,
  n = 4,
  taper = 1,
): Section => ({ z, y0, y1, hw, n, taper });

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
};

const sampleSections = (keys: Section[], perSpan: number): Section[] => {
  const out: Section[] = [];
  const k = (i: number) => keys[Math.max(0, Math.min(keys.length - 1, i))];
  for (let i = 0; i < keys.length - 1; i++) {
    const steps = i === keys.length - 2 ? perSpan + 1 : perSpan;
    for (let s = 0; s < steps; s++) {
      const t = s / perSpan;
      const f = (key: keyof Section) =>
        catmull(k(i - 1)[key], k(i)[key], k(i + 1)[key], k(i + 2)[key], t);
      out.push({
        // z is interpolated linearly so sections never fold over each other
        z: k(i).z + (k(i + 1).z - k(i).z) * t,
        y0: f("y0"),
        y1: f("y1"),
        hw: Math.max(0.01, f("hw")),
        n: Math.max(2, f("n")),
        taper: f("taper"),
      });
    }
  }
  return out;
};

const ringPoint = (s: Section, a: number): [number, number, number] => {
  const c = Math.cos(a);
  const si = Math.sin(a);
  const e = 2 / s.n;
  const px = Math.sign(c) * Math.pow(Math.abs(c), e);
  const py = Math.sign(si) * Math.pow(Math.abs(si), e);
  const v = (py + 1) / 2;
  const w = 1 + (s.taper - 1) * v;
  return [s.hw * px * w, s.y0 + (s.y1 - s.y0) * v, s.z];
};

/** Loft a closed body through the key sections. */
export const loft = (
  keys: Section[],
  perSpan: number,
  ringN: number,
  into: Shape,
  opts: { caps?: boolean; ringEvery?: number; longEvery?: number } = {},
) => {
  const { caps = true, ringEvery = 1, longEvery = 1 } = opts;
  const secs = sampleSections(keys, perSpan);
  const rings = secs.map((s) => {
    const pts: [number, number, number][] = [];
    for (let j = 0; j < ringN; j++) {
      pts.push(ringPoint(s, (j / ringN) * Math.PI * 2 + Math.PI / ringN));
    }
    return pts;
  });
  const { wire, tris } = into;
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    for (let j = 0; j < ringN; j++) {
      const a = r[j];
      const b = r[(j + 1) % ringN];
      if (i % ringEvery === 0 || i === rings.length - 1) {
        wire.push(...a, ...b);
      }
      if (i < rings.length - 1) {
        const c = rings[i + 1][j];
        const d = rings[i + 1][(j + 1) % ringN];
        if (j % longEvery === 0) {
          wire.push(...a, ...c);
        }
        tris.push(...a, ...b, ...d, ...a, ...d, ...c);
      }
    }
  }
  if (caps) {
    for (const r of [rings[0], rings[rings.length - 1]]) {
      for (let j = 0; j < ringN / 4; j++) {
        // pair points with equal height on the left / right side
        const right = r[j];
        const left = r[ringN / 2 - 1 - j];
        wire.push(...right, ...left);
        const right2 = r[ringN - 1 - j];
        const left2 = r[ringN / 2 + j];
        wire.push(...right2, ...left2);
        tris.push(...right, ...left, ...left2, ...right, ...left2, ...right2);
      }
    }
  }
};

/** Axis-aligned wire box, optionally subdivided. */
export const box = (
  into: Shape,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  fill = false,
) => {
  const x0 = cx - sx / 2;
  const x1 = cx + sx / 2;
  const y0 = cy - sy / 2;
  const y1 = cy + sy / 2;
  const z0 = cz - sz / 2;
  const z1 = cz + sz / 2;
  const w = into.wire;
  for (const y of [y0, y1]) {
    w.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1);
    w.push(x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
  }
  for (const x of [x0, x1]) {
    for (const z of [z0, z1]) {
      w.push(x, y0, z, x, y1, z);
    }
  }
  if (fill) {
    const t = into.tris;
    const quad = (a: number[], b: number[], c: number[], d: number[]) =>
      t.push(...a, ...b, ...c, ...a, ...c, ...d);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]);
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]);
    quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]);
  }
};

/** Wheel: axis along x. */
export const wheel = (
  into: Shape,
  cx: number,
  cz: number,
  r: number,
  width: number,
) => {
  const N = 20;
  const w = into.wire;
  const xs = [cx - width / 2, cx + width / 2];
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    const p = (a: number, rr: number) => [r + Math.sin(a) * rr, cz + Math.cos(a) * rr];
    for (const x of xs) {
      for (const rr of [r, r * 0.62]) {
        const [y0, z0] = p(a0, rr);
        const [y1, z1] = p(a1, rr);
        w.push(x, y0, z0, x, y1, z1);
      }
      if (i % 4 === 0) {
        const [y0, z0] = p(a0, r * 0.62);
        w.push(x, r, cz, x, y0, z0);
      }
    }
    if (i % 2 === 0) {
      const [y0, z0] = p(a0, r);
      w.push(xs[0], y0, z0, xs[1], y0, z0);
    }
    const [ya, za] = p(a0, r);
    const [yb, zb] = p(a1, r);
    into.tris.push(xs[0], ya, za, xs[1], ya, za, xs[1], yb, zb);
    into.tris.push(xs[0], ya, za, xs[1], yb, zb, xs[0], yb, zb);
  }
};

/** Vertical cylinder (lidar puck). */
export const puck = (
  into: Shape,
  cx: number,
  y0: number,
  cz: number,
  r: number,
  h: number,
) => {
  const N = 18;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    const x0 = cx + Math.cos(a0) * r;
    const z0 = cz + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r;
    const z1 = cz + Math.sin(a1) * r;
    into.wire.push(x0, y0, z0, x1, y0, z1, x0, y0 + h, z0, x1, y0 + h, z1);
    into.wire.push(x0, y0, z0, x0, y0 + h, z0);
    into.tris.push(x0, y0, z0, x1, y0, z1, x1, y0 + h, z1);
    into.tris.push(x0, y0, z0, x1, y0 + h, z1, x0, y0 + h, z0);
    into.tris.push(cx, y0 + h, cz, x0, y0 + h, z0, x1, y0 + h, z1);
  }
};

export type Vehicle = {
  body: Shape;
  /** interior / mechanical detail, drawn dimmer */
  detail: Shape;
  /** bright solid accents (lidar puck) */
  accent: Shape;
  /** red tail-light segments */
  tail: number[];
  /** bounding box: [sx, sy, sz] */
  size: [number, number, number];
};

const seats = (d: Shape, rows: number[], xs: number[], y: number) => {
  for (const z of rows) {
    for (const x of xs) {
      box(d, x, y + 0.1, z, 0.46, 0.14, 0.5);
      box(d, x, y + 0.42, z + 0.26, 0.44, 0.62, 0.12);
      box(d, x, y + 0.82, z + 0.28, 0.24, 0.16, 0.1);
    }
  }
};

/** Self-driving SUV / hatchback (the ego car) or a plain sedan. */
export const makeCar = (kind: "suv" | "sedan"): Vehicle => {
  const body = emptyShape();
  const detail = emptyShape();
  const accent = emptyShape();
  // lower body
  loft(
    [
      sec(-2.3, 0.46, 0.62, 0.66, 3.2, 0.96),
      sec(-2.16, 0.3, 0.72, 0.84, 4, 0.95),
      sec(-1.6, 0.22, 0.82, 0.91, 4.5, 0.94),
      sec(-0.8, 0.2, 0.9, 0.93, 5, 0.93),
      sec(0.8, 0.2, 0.93, 0.93, 5, 0.93),
      sec(1.7, 0.22, 0.92, 0.92, 4.5, 0.94),
      sec(2.16, 0.28, 0.88, 0.86, 4, 0.95),
      sec(2.3, 0.42, 0.78, 0.74, 3.2, 0.96),
    ],
    6,
    28,
    body,
  );
  // greenhouse
  const cabin =
    kind === "suv"
      ? [
          sec(-1.15, 0.84, 0.88, 0.8, 3, 0.9),
          sec(-0.45, 0.84, 1.42, 0.8, 3.6, 0.8),
          sec(0.4, 0.84, 1.5, 0.8, 3.8, 0.8),
          sec(1.5, 0.84, 1.46, 0.8, 3.8, 0.8),
          sec(2.05, 0.84, 1.3, 0.78, 3.6, 0.82),
          sec(2.24, 0.84, 0.92, 0.74, 3, 0.9),
        ]
      : [
          sec(-1.0, 0.84, 0.88, 0.8, 3, 0.9),
          sec(-0.35, 0.84, 1.36, 0.8, 3.6, 0.78),
          sec(0.45, 0.84, 1.42, 0.8, 3.8, 0.78),
          sec(1.15, 0.84, 1.34, 0.8, 3.6, 0.78),
          sec(1.85, 0.84, 0.9, 0.76, 3, 0.9),
        ];
  loft(cabin, 6, 24, body, { caps: false });
  // wheels + axles
  for (const z of [-1.42, 1.42]) {
    for (const x of [-0.8, 0.8]) {
      wheel(detail, x, z, 0.35, 0.26);
    }
    detail.wire.push(-0.8, 0.35, z, 0.8, 0.35, z);
  }
  // floor pan, engine, drivetrain, seats
  for (let i = -4; i <= 4; i++) {
    detail.wire.push(i * 0.2, 0.26, -1.9, i * 0.2, 0.26, 1.9);
  }
  for (let i = -6; i <= 6; i++) {
    detail.wire.push(-0.8, 0.26, i * 0.3, 0.8, 0.26, i * 0.3);
  }
  box(detail, 0, 0.56, -1.7, 1.1, 0.42, 0.7);
  box(detail, 0, 0.6, -1.7, 0.7, 0.3, 0.46);
  box(detail, 0, 0.38, 0, 0.26, 0.2, 2.6);
  box(detail, 0, 0.55, 1.85, 1.2, 0.36, 0.5);
  seats(detail, [-0.25, 0.75], [-0.4, 0.4], 0.42);
  // dashboard + steering wheel
  box(detail, 0, 0.86, -0.92, 1.5, 0.2, 0.3);
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2;
    const a1 = ((i + 1) / 12) * Math.PI * 2;
    detail.wire.push(
      -0.4 + Math.cos(a0) * 0.17,
      0.98 + Math.sin(a0) * 0.17,
      -0.7,
      -0.4 + Math.cos(a1) * 0.17,
      0.98 + Math.sin(a1) * 0.17,
      -0.7,
    );
  }
  const top = kind === "suv" ? 1.5 : 1.42;
  if (kind === "suv") {
    // roof sensor bar + lidar puck
    box(accent, 0, top + 0.03, 0.35, 1.0, 0.05, 0.12, true);
    puck(accent, 0, top + 0.05, 0.35, 0.17, 0.2);
    box(detail, -0.62, top + 0.02, 0.4, 0.05, 0.05, 1.5);
    box(detail, 0.62, top + 0.02, 0.4, 0.05, 0.05, 1.5);
  }
  const tail = [-0.7, 0.8, 2.32, 0.7, 0.8, 2.32];
  return {
    body,
    detail,
    accent,
    tail,
    size: [2.05, kind === "suv" ? 1.82 : 1.56, 4.9],
  };
};

/** Tall box van / light truck. */
export const makeTruck = (): Vehicle => {
  const body = emptyShape();
  const detail = emptyShape();
  const accent = emptyShape();
  loft(
    [
      sec(-2.8, 0.75, 1.75, 0.94, 4, 0.98),
      sec(-2.68, 0.55, 2.4, 1.04, 5, 0.97),
      sec(-2.3, 0.5, 3.0, 1.1, 6, 0.96),
      sec(-1.7, 0.48, 3.2, 1.12, 7, 0.97),
      sec(0, 0.48, 3.25, 1.12, 8, 0.97),
      sec(2.62, 0.48, 3.25, 1.12, 8, 0.97),
      sec(2.8, 0.55, 3.15, 1.08, 6, 0.97),
    ],
    7,
    32,
    body,
  );
  // inner liner gives the layered "x-ray" look
  loft(
    [
      sec(-1.4, 0.75, 2.95, 0.96, 8, 1),
      sec(0.5, 0.75, 3.0, 0.96, 8, 1),
      sec(2.6, 0.75, 3.0, 0.96, 8, 1),
    ],
    5,
    16,
    detail,
    { longEvery: 2 },
  );
  for (const z of [-1.9, 1.75]) {
    for (const x of [-0.94, 0.94]) {
      wheel(detail, x, z, 0.5, 0.32);
    }
    detail.wire.push(-0.94, 0.5, z, 0.94, 0.5, z);
  }
  // ladder chassis
  for (const x of [-0.42, 0.42]) {
    box(detail, x, 0.58, 0.1, 0.1, 0.16, 5.0);
  }
  for (let i = -4; i <= 4; i++) {
    detail.wire.push(-0.42, 0.58, i * 0.6, 0.42, 0.58, i * 0.6);
  }
  box(detail, 0, 0.9, -2.25, 1.2, 0.6, 0.7);
  seats(detail, [-1.9], [-0.5, 0.5], 1.0);
  box(detail, 0, 1.55, -2.4, 1.8, 0.24, 0.3);
  // cargo
  box(detail, -0.35, 1.3, 0.0, 0.9, 1.1, 1.2);
  box(detail, 0.4, 1.15, 1.3, 0.8, 0.8, 1.0);
  box(detail, -0.25, 1.5, 2.0, 1.1, 1.5, 0.8);
  box(detail, 0, 2.2, 0.8, 1.7, 0.08, 3.4);
  const tail = [-0.92, 1.02, 2.82, 0.92, 1.02, 2.82];
  return { body, detail, accent, tail, size: [2.5, 3.5, 5.9] };
};
