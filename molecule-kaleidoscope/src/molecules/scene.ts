/**
 * Scene description + animation for the molecule kaleidoscope.
 *
 * Units: the screen is 1.0 high (y in [-0.5, 0.5], y grows downwards) and
 * `aspect` wide. z points towards the (top-down) camera. Only the right half
 * of the image is modelled – the shader mirrors it across x = 0.
 *
 * Like the reference, one 5 s loop cycles through three poses:
 *   A  the opening layout (six molecules spread across the frame)
 *   B  two separated compact clusters, one per side, hollow in the middle
 *   C  a pale-dominant pose (pale atoms around red cores)
 * Each move is a ~30-frame liquid morph: molecules glide to the next pose
 * while turning in 3D, fuse into each other mid-move and recolour.
 */

export type AtomKind = "red" | "pale" | "yellow";
type Vec3 = [number, number, number];
type Mat3 = number[]; // row-major 3x3
type Pose = 0 | 1 | 2;

type MoleculeDef = {
  /** Molecule centre in each pose (A, B, C). */
  centres: [[number, number], [number, number], [number, number]];
  /** Atom positions (local) and colour in each pose (A, B, C). */
  atoms: { pos: Vec3; kinds: [AtomKind, AtomKind, AtomKind] }[];
  bonds: [number, number][];
  /** One world-space rotation per move (3 per loop, composing to identity). */
  steps: { axis: Vec3; angle: number }[];
};

export const LOOP_FRAMES = 150; // the reference repeats every 5 s
/**
 * [start, end] frame of the three moves A→B, B→C, C→A, matched to the
 * reference's ~30-frame morphs and ~20-frame holds.
 */
export const TRANSITIONS: [number, number][] = [
  [2, 32],
  [52, 82],
  [103, 133],
];

export const ATOM_RADIUS: Record<AtomKind, number> = {
  red: 0.064,
  pale: 0.058,
  yellow: 0.058,
};
export const BOND_RADIUS = 0.024;
export const BASE_BLEND = 0.02;
/** Extra smooth-union radius at the peak of a move: the liquid fusing. */
const MOVE_BLEND = 0.024;
/**
 * Depth is flattened while molecules turn, so atoms passing over each other
 * stay within reach of the smooth union and fuse instead of occluding.
 */
const DEPTH_SQUASH = 0.45;

const PI = Math.PI;
const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
const Z: Vec3 = [0, 0, 1];

/** Molecules in the right half. Pose A follows the reference's first frame. */
const MOLECULES: MoleculeDef[] = [
  // inner, upper
  {
    centres: [
      [0.195, -0.183],
      [0.335, -0.125],
      [0.16, -0.165],
    ],
    atoms: [
      { pos: [0.115, -0.077, 0.02], kinds: ["red", "red", "pale"] },
      { pos: [-0.052, -0.085, -0.025], kinds: ["pale", "yellow", "pale"] },
      { pos: [-0.105, 0.073, 0.02], kinds: ["red", "red", "red"] },
      { pos: [0.041, 0.088, -0.02], kinds: ["yellow", "pale", "yellow"] },
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
  },
  // inner, lower (vertical mirror of the upper one, different choreography)
  {
    centres: [
      [0.195, 0.183],
      [0.335, 0.125],
      [0.16, 0.165],
    ],
    atoms: [
      { pos: [0.115, 0.077, 0.02], kinds: ["red", "red", "pale"] },
      { pos: [-0.052, 0.085, -0.025], kinds: ["pale", "pale", "red"] },
      { pos: [-0.105, -0.073, 0.02], kinds: ["red", "yellow", "pale"] },
      { pos: [0.041, -0.088, -0.02], kinds: ["yellow", "yellow", "pale"] },
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
  },
  // outer ring
  {
    centres: [
      [0.49, 0.0],
      [0.535, 0.0],
      [0.475, 0.0],
    ],
    atoms: [
      { pos: [0.1045, 0, 0.0], kinds: ["pale", "pale", "pale"] },
      { pos: [-0.0935, 0, 0.0], kinds: ["yellow", "pale", "pale"] },
      { pos: [-0.005, -0.138, 0.035], kinds: ["red", "red", "red"] },
      { pos: [-0.005, 0.138, -0.035], kinds: ["red", "red", "red"] },
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

/** Mostly steady speed with soft starts and stops (the reference morphs
 *  at a near-constant rate rather than with a sharp ease peak). */
const ease = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  const sine = 0.5 - 0.5 * Math.cos(Math.PI * c);
  return 0.45 * c + 0.55 * sine;
};

export type SceneFrame = {
  /** xyz + radius, per ball. */
  balls: Float32Array;
  /** colour weights per ball: [red, pale, yellow] (sum to 1). */
  colourWeights: Float32Array;
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
  const colourWeights = new Float32Array(16 * 3);
  const bonds = new Float32Array(16 * 4);
  let nb = 0;
  let ns = 0;
  let activity = 0;

  // which pose we are in / moving between, and how far along
  let from: Pose = 0;
  let to: Pose = 0;
  let p = 0;
  TRANSITIONS.forEach(([a, b], i) => {
    if (f >= a) {
      from = i as Pose;
      to = ((i + 1) % 3) as Pose;
      p = ease((f - a) / (b - a));
      if (f < b) activity = Math.max(activity, Math.sin(PI * ((f - a) / (b - a))));
    }
  });
  if (f < TRANSITIONS[0][0]) {
    // still holding pose A from the end of the previous loop
    from = 0;
    to = 0;
    p = 0;
  }

  for (const m of MOLECULES) {
    let orient = IDENTITY;
    TRANSITIONS.forEach(([a, b], i) => {
      const s = m.steps[i];
      orient = mul(rot(s.axis, s.angle * ease((f - a) / (b - a))), orient);
    });
    const cA = m.centres[from];
    const cB = m.centres[to];
    const cx = cA[0] + (cB[0] - cA[0]) * p;
    const cy = cA[1] + (cB[1] - cA[1]) * p;

    const base = nb;
    m.atoms.forEach((atom) => {
      const q = apply(orient, atom.pos);
      // flatten depth while turning so overlapping atoms fuse
      const z = q[2] * (1 - (1 - DEPTH_SQUASH) * activity);
      const kFrom = atom.kinds[from];
      const kTo = atom.kinds[to];
      const radius =
        (ATOM_RADIUS[kFrom] * (1 - p) + ATOM_RADIUS[kTo] * p) * (1 + 0.9 * z) * (1 + 0.05 * activity);
      balls.set([cx + q[0], cy + q[1], z, radius], nb * 4);
      // colours cross-fade through the middle of the move
      const cp = Math.min(1, Math.max(0, (p - 0.4) / 0.2));
      colourWeights[nb * 3 + KIND_INDEX[kFrom]] += 1 - cp;
      colourWeights[nb * 3 + KIND_INDEX[kTo]] += cp;
      nb++;
    });
    for (const [a, b] of m.bonds) {
      bonds.set([base + a, base + b, BOND_RADIUS * (1 + 0.3 * activity), 0], ns * 4);
      ns++;
    }
  }

  return {
    balls,
    colourWeights,
    bonds,
    ballCount: nb,
    bondCount: ns,
    blend: BASE_BLEND + MOVE_BLEND * activity,
  };
};
