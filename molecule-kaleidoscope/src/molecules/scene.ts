/**
 * Scene description + animation for the molecule kaleidoscope.
 *
 * Units: the screen is 1.0 high (y in [-0.5, 0.5], y grows downwards) and
 * `aspect` wide. z points towards the (top-down) camera. Only the right half
 * of the image is modelled – the shader mirrors it across x = 0.
 */

export type AtomKind = "red" | "pale" | "yellow";
type Vec3 = [number, number, number];
type Mat3 = number[]; // row-major 3x3

type MoleculeDef = {
  centre: [number, number];
  atoms: { kind: AtomKind; pos: Vec3 }[];
  bonds: [number, number][];
  /** One world-space rotation per transition (3 per loop, composing to identity). */
  steps: { axis: Vec3; angle: number }[];
  /** Direction the molecule lunges towards while it is turning. */
  lunge: [number, number];
};

export const LOOP_FRAMES = 150; // the reference repeats every 5 s
/** Start/end frame of the three transitions inside one loop. */
export const TRANSITIONS: [number, number][] = [
  [8, 29],
  [53, 74],
  [100, 125],
];

export const ATOM_RADIUS: Record<AtomKind, number> = {
  red: 0.06,
  pale: 0.055,
  yellow: 0.055,
};
export const BOND_RADIUS = 0.023;
export const BASE_BLEND = 0.028;

const PI = Math.PI;
const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
const Z: Vec3 = [0, 0, 1];

/** Molecules in the right half, laid out after the reference's first frame. */
const MOLECULES: MoleculeDef[] = [
  // inner, upper
  {
    centre: [0.195, -0.183],
    atoms: [
      { kind: "red", pos: [0.115, -0.077, 0.02] },
      { kind: "pale", pos: [-0.052, -0.085, -0.025] },
      { kind: "red", pos: [-0.105, 0.073, 0.02] },
      { kind: "yellow", pos: [0.041, 0.088, -0.02] },
    ],
    bonds: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
    steps: [
      { axis: Y, angle: PI },
      { axis: X, angle: PI },
      { axis: Z, angle: PI },
    ],
    lunge: [-0.07, 0.045],
  },
  // inner, lower (vertical mirror of the upper one, different choreography)
  {
    centre: [0.195, 0.183],
    atoms: [
      { kind: "red", pos: [0.115, 0.077, 0.02] },
      { kind: "pale", pos: [-0.052, 0.085, -0.025] },
      { kind: "red", pos: [-0.105, -0.073, 0.02] },
      { kind: "yellow", pos: [0.041, -0.088, -0.02] },
    ],
    bonds: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
    steps: [
      { axis: X, angle: -PI },
      { axis: Z, angle: -PI },
      { axis: Y, angle: -PI },
    ],
    lunge: [-0.06, -0.05],
  },
  // outer ring
  {
    centre: [0.49, 0.0],
    atoms: [
      { kind: "pale", pos: [0.1045, 0, 0.0] },
      { kind: "yellow", pos: [-0.0935, 0, 0.0] },
      { kind: "red", pos: [-0.005, -0.138, 0.035] },
      { kind: "red", pos: [-0.005, 0.138, -0.035] },
    ],
    bonds: [
      [2, 0],
      [2, 1],
      [3, 0],
      [3, 1],
    ],
    steps: [
      { axis: Z, angle: PI / 2 },
      { axis: X, angle: PI },
      // half-turn about the xy-diagonal: Rd(PI)·Rx(PI)·Rz(PI/2) = identity
      { axis: [Math.SQRT1_2, -Math.SQRT1_2, 0], angle: PI },
    ],
    lunge: [-0.075, 0.0],
  },
];

const rot = (axis: Vec3, a: number): Mat3 => {
  const [x, y, z] = axis;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const t = 1 - c;
  return [
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
  ];
};
const mul = (a: Mat3, b: Mat3): Mat3 => {
  const r: number[] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
  return r;
};
const apply = (m: Mat3, v: Vec3): Vec3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Snappy ease – slow out of the hold, fast through the middle, soft settle. */
const ease = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};

export type SceneFrame = {
  /** xyz + radius, per ball. */
  balls: Float32Array;
  /** atom kind index per ball (0 red, 1 pale, 2 yellow). */
  kinds: Int32Array;
  /** index a, index b, radius, unused per bond. */
  bonds: Float32Array;
  ballCount: number;
  bondCount: number;
  /** Smooth-union radius (grows while the molecules are moving = gooey). */
  blend: number;
};

const KIND_INDEX: Record<AtomKind, number> = { red: 0, pale: 1, yellow: 2 };

export const computeScene = (frame: number): SceneFrame => {
  const f = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;

  const balls = new Float32Array(16 * 4);
  const kinds = new Int32Array(16);
  const bonds = new Float32Array(16 * 4);
  let nb = 0;
  let ns = 0;
  let activity = 0;

  for (const m of MOLECULES) {
    let orient = IDENTITY;
    let lunge = 0;
    TRANSITIONS.forEach(([a, b], i) => {
      const p = ease((f - a) / (b - a));
      const step = m.steps[i];
      orient = mul(rot(step.axis, step.angle * p), orient);
      if (f > a && f < b) {
        const s = Math.sin(PI * ((f - a) / (b - a)));
        lunge = Math.max(lunge, s);
        activity = Math.max(activity, s);
      }
    });

    const base = nb;
    for (const atom of m.atoms) {
      const p = apply(orient, atom.pos);
      const cx = m.centre[0] + m.lunge[0] * lunge * 0.55;
      const cy = m.centre[1] + m.lunge[1] * lunge * 0.55;
      // a touch of perspective: atoms swinging towards the camera grow
      const r = ATOM_RADIUS[atom.kind] * (1 + 0.9 * p[2]) * (1 + 0.06 * lunge);
      balls.set([cx + p[0], cy + p[1], p[2], r], nb * 4);
      kinds[nb] = KIND_INDEX[atom.kind];
      nb++;
    }
    for (const [a, b] of m.bonds) {
      bonds.set([base + a, base + b, BOND_RADIUS * (1 + 0.25 * lunge), 0], ns * 4);
      ns++;
    }
  }

  return {
    balls,
    kinds,
    bonds,
    ballCount: nb,
    bondCount: ns,
    blend: BASE_BLEND + 0.016 * activity,
  };
};
