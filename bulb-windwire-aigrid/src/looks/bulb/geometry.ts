import { BufferGeometry, CatmullRomCurve3, Curve, Float32BufferAttribute, LatheGeometry, TubeGeometry, Vector2, Vector3 } from "three";

// A generic A-shape incandescent bulb, in bulb units (glass diameter 2).
//   y < 0      : screw base (threads), insulator, contact tip
//   0 .. 2.6   : glass envelope; sphere of radius 1 centred at y = 1.6
// The same envelope radius function is used in GLSL for the inner glow mask.

export const ENV_CENTER = new Vector3(0, 1.6, 0);
export const FILAMENT_A = new Vector3(-0.36, 1.5, 0);
export const FILAMENT_B = new Vector3(0.36, 1.5, 0);
export const BASE_TIP = new Vector3(0, -1.06, 0);

const NECK_R = 0.43;
const TAN_Y = 1.1;
const TAN_R = Math.sqrt(1 - (TAN_Y - 1.6) ** 2);
const TAN_SLOPE = (1.6 - TAN_Y) / TAN_R;

export const envelopeRadius = (y: number) => {
  if (y <= 0) return NECK_R;
  if (y < TAN_Y) {
    // Cubic Hermite from the neck to the tangent point on the sphere.
    const t = y / TAN_Y;
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1,
      h10 = t ** 3 - 2 * t ** 2 + t,
      h01 = -2 * t ** 3 + 3 * t ** 2,
      h11 = t ** 3 - t ** 2;
    return h00 * NECK_R + h10 * TAN_Y * 0.08 + h01 * TAN_R + h11 * TAN_Y * TAN_SLOPE;
  }
  const d = y - 1.6;
  return Math.sqrt(Math.max(0, 1 - d * d));
};

export const ENVELOPE_GLSL = /* glsl */ `
float envelopeRadius(float y) {
  const float NECK_R = ${NECK_R.toFixed(6)};
  const float TAN_Y = ${TAN_Y.toFixed(6)};
  const float TAN_R = ${TAN_R.toFixed(6)};
  const float TAN_SLOPE = ${TAN_SLOPE.toFixed(6)};
  if (y <= 0.0) return NECK_R;
  if (y < TAN_Y) {
    float t = y / TAN_Y;
    float t2 = t * t, t3 = t2 * t;
    return (2.0 * t3 - 3.0 * t2 + 1.0) * NECK_R + (t3 - 2.0 * t2 + t) * TAN_Y * 0.08
         + (-2.0 * t3 + 3.0 * t2) * TAN_R + (t3 - t2) * TAN_Y * TAN_SLOPE;
  }
  float d = y - 1.6;
  return sqrt(max(0.0, 1.0 - d * d));
}
`;

export const buildEnvelope = () => {
  const pts: Vector2[] = [];
  // Crimp where the glass meets the base, then the neck and the sphere.
  pts.push(new Vector2(NECK_R - 0.035, -0.05));
  pts.push(new Vector2(NECK_R - 0.012, -0.025));
  const nNeck = 50;
  for (let i = 0; i <= nNeck; i++) {
    const y = (i / nNeck) * TAN_Y;
    pts.push(new Vector2(envelopeRadius(y), y));
  }
  // Sphere part sampled evenly by angle so the crown stays round.
  const a0 = Math.acos(TAN_Y - 1.6); // angle from the top pole (120°)
  const nS = 120;
  for (let i = 1; i <= nS; i++) {
    const a = a0 * (1 - i / nS);
    pts.push(new Vector2(Math.max(0.0005, Math.sin(a)), 1.6 + Math.cos(a)));
  }
  return new LatheGeometry(pts, 160);
};

/**
 * Screw base: a true single-start helical thread (the radius depends on
 * angle + height, so the crest spirals), a rolled top lip and a bottom shoulder.
 */
export const buildScrew = () => {
  const top = 0.02,
    bot = -0.84,
    pitch = 0.16;
  const nu = 160,
    nv = 260;
  const R0 = NECK_R + 0.005;
  const radius = (theta: number, y: number) => {
    const tt = top - y;
    // Thread only in the middle section; plain collar at the top and shoulder at the bottom.
    const w = Math.min(1, Math.max(0, (tt - 0.07) / 0.04)) * Math.min(1, Math.max(0, (y - (bot + 0.06)) / 0.04));
    const ph = (y / pitch - theta / (Math.PI * 2)) * Math.PI * 2;
    // Rounded crest, narrow root.
    const prof = Math.pow(0.5 + 0.5 * Math.sin(ph), 0.7);
    const lip = tt < 0.035 ? 0.012 * Math.sin((tt / 0.035) * Math.PI) : 0;
    return R0 + w * 0.032 * prof + lip;
  };
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= nv; j++) {
    const y = top - (j / nv) * (top - bot);
    for (let i = 0; i <= nu; i++) {
      const th = (i / nu) * Math.PI * 2;
      const r = radius(th, y);
      pos.push(Math.sin(th) * r, y, Math.cos(th) * r);
    }
  }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i,
        b = a + 1,
        c = a + nu + 1,
        d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

/** Cemented cap closing the top of the shell around the glass neck. */
export const buildCap = () => {
  const pts = [
    new Vector2(0.0005, 0.0),
    new Vector2(NECK_R - 0.02, 0.0),
    new Vector2(NECK_R + 0.01, 0.012),
    new Vector2(NECK_R + 0.022, 0.03),
    new Vector2(NECK_R + 0.012, 0.045),
    new Vector2(NECK_R - 0.03, 0.04),
  ];
  return new LatheGeometry(pts, 96);
};

export const buildInsulator = () => {
  const pts = [
    new Vector2(0.0005, -0.83),
    new Vector2(0.43, -0.835),
    new Vector2(0.425, -0.87),
    new Vector2(0.33, -0.95),
    new Vector2(0.17, -0.99),
    new Vector2(0.0005, -0.99),
  ];
  return new LatheGeometry(pts.reverse(), 64);
};

export const buildContact = () => {
  const pts: Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    pts.push(new Vector2(Math.max(0.0005, Math.sin(a) * 0.15), -0.985 - Math.cos(a) * 0.075));
  }
  pts.push(new Vector2(0.15, -0.975));
  pts.push(new Vector2(0.0005, -0.975));
  return new LatheGeometry(pts, 48);
};

/** The flared glass stem (exhaust tube + pinch) inside the neck. */
export const buildStem = () => {
  const pts: Vector2[] = [];
  const prof: [number, number][] = [
    [0.36, -0.02],
    [0.3, 0.06],
    [0.16, 0.2],
    [0.085, 0.36],
    [0.075, 0.55],
    [0.11, 0.7], // pinch bead
    [0.12, 0.8],
    [0.07, 0.88],
    [0.03, 0.91],
    [0.0005, 0.915],
  ];
  for (const [r, y] of prof) pts.push(new Vector2(r, y));
  return new LatheGeometry(pts, 48);
};

/** Lead-in wires and the support wire, from the pinch to the filament. */
export const buildWires = () => {
  const r = 0.0065;
  const lead = (s: number) =>
    new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.05 * s, 0.1, 0.02),
        new Vector3(0.06 * s, 0.75, 0.02),
        new Vector3(0.12 * s, 0.98, 0.015),
        new Vector3(0.3 * s, 1.32, 0.005),
        new Vector3(FILAMENT_A.x * -s, FILAMENT_A.y, 0),
      ]),
      80,
      r,
      6,
      false,
    );
  const support = new TubeGeometry(
    new CatmullRomCurve3([new Vector3(0, 0.88, 0), new Vector3(0, 1.2, 0), new Vector3(0, 1.48, 0), new Vector3(0, 1.545, 0.02)]),
    40,
    r * 0.8,
    6,
    false,
  );
  return [lead(-1), lead(1), support];
};

class CoilCurve extends Curve<Vector3> {
  constructor(
    private turns: number,
    private radius: number,
  ) {
    super();
  }
  getPoint(t: number, target = new Vector3()) {
    // Axis: a shallow arc between the two lead tips, sagging upward in the middle.
    const ax = FILAMENT_A.x + (FILAMENT_B.x - FILAMENT_A.x) * t;
    const ay = FILAMENT_A.y + Math.sin(t * Math.PI) * 0.06;
    // Tangent of the axis ~ +x; build the coil around it.
    const ang = t * this.turns * Math.PI * 2;
    return target.set(ax, ay + Math.cos(ang) * this.radius, Math.sin(ang) * this.radius);
  }
}

export const buildFilament = () => new TubeGeometry(new CoilCurve(40, 0.02), 1800, 0.0048, 5, false);

/** Distance from p to the filament axis (used to place the glow). */
export const FILAMENT_MID = new Vector3(0, 1.53, 0);
