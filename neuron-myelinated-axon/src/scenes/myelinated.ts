import { Builder, V3, add, growBranch, lerp, lerp3, makeRng, mul, norm, sub, Rng } from "../engine/builder";
import type { SceneDef } from "../engine/NeuronCanvas";
import { FrameState, Look, MAT_DUST, MAT_LIT, MAT_MYELIN, MAT_TISSUE } from "../engine/renderer";

/**
 * Scene: a myelinated neuron drifting in dark space. A veined, spiny cell body, a
 * thicket of bare-tree dendrites, an axon wrapped in dark myelin sheaths with glowing
 * nodes, a terminal tree, a row of sister neurons receding into the blur and fine dust.
 */

const GREY: V3 = [0.36, 0.33, 0.32];
const GREY_WARM: V3 = [0.42, 0.33, 0.3];
const MYELIN: V3 = [0.2, 0.16, 0.14];
const NODE: V3 = [1.0, 0.24, 0.2];

// --- axon centre line: leaves the soma almost level, then climbs toward the terminal ---------
const SOMA_END: V3 = [2.5, 0.12, -0.05];
const AXON_SPAN = 8.0;
const axonCurve = (u: number): V3 => [
  SOMA_END[0] + AXON_SPAN * u,
  SOMA_END[1] + 1.85 * Math.pow(u, 1.7),
  SOMA_END[2] - 0.5 * u + 0.12 * Math.sin(u * 7.0),
];
const CURVE: { p: V3; len: number }[] = [];
{
  let len = 0;
  let prev = axonCurve(0);
  for (let i = 0; i <= 400; i++) {
    const p = axonCurve(i / 400);
    len += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
    CURVE.push({ p, len });
    prev = p;
  }
}
export const AXON_LENGTH = CURVE[CURVE.length - 1].len;
/** point at arc length `l` along the axon (0 = where it leaves the soma) */
const axonAt = (l: number): V3 => {
  const x = Math.min(AXON_LENGTH, Math.max(0, l));
  let i = 1;
  while (i < CURVE.length - 1 && CURVE[i].len < x) i++;
  const a = CURVE[i - 1];
  const b = CURVE[i];
  const t = b.len > a.len ? (x - a.len) / (b.len - a.len) : 0;
  return lerp3(a.p, b.p, t);
};

const INITIAL_LEN = 3.0;
const SHEATHS = 6;
const SHEATH_LEN = 0.74;
const NODE_GAP = 0.13;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const buildNeuron = (b: Builder, rng: Rng, detail: number) => {
  const hero = detail === 1;
  const mkBudget = (n: number) => ({ left: Math.floor(n * detail) });
  const hairBoost = hero ? 1 : 3.0; // low-detail copies get fewer but fatter twigs
  const style = (r: number, _s: number, _d: number, g: Rng) => {
    if (r > 0.03) {
      return {
        col: mul(lerp3(GREY, GREY_WARM, g.next()), 1.5),
        opacity: 1,
        mat: MAT_TISSUE,
        fire: 0,
        extra: 1 - smooth(0.03, 0.075, r),
      };
    }
    const k = g.range(0.55, 1.15);
    return { col: mul(lerp3(GREY, GREY_WARM, g.next()), k), opacity: 0.96, mat: MAT_LIT };
  };
  const spine = (p: V3, d: V3, r: number, s: number, chance = 0.5) => {
    if (!hero || r < 0.06 || rng.next() > chance) return;
    const out = norm(add(rng.dir(), mul(d, -0.15)));
    const L = rng.range(0.22, 0.6);
    const base = add(p, mul(out, r * 0.8));
    const tip = add(base, mul(out, L));
    b.capsule(base, 0.011, tip, 0.007, { col: [0.82, 0.74, 0.74], opacity: 1, mat: MAT_LIT }, rng.next(), s, s);
    const red = rng.next() < 0.5;
    b.point(
      tip,
      rng.range(0.02, 0.034),
      { col: red ? [1.0, 0.3, 0.22] : [0.95, 0.9, 0.95], opacity: 1, mat: MAT_LIT, glow: red ? 0.9 : 0.3 },
      rng.next(),
      s,
    );
  };

  // --- soma: an elongated, slightly lumpy spindle (one seed keeps its veins continuous) -----
  const tissue = { col: GREY, opacity: 1, mat: MAT_TISSUE, fire: 1, extra: 0 };
  const somaTissue = { ...tissue, bias: 0.5 };
  const somaSeed = rng.next();
  const spinePts: [V3, V3, number][] = [
    [[-1.2, -0.1, 0.02], [0.0, 0.0, 0], 0.4],
    [[0.0, 0.0, 0], [0.9, 0.05, 0], 0.6],
    [[0.9, 0.05, 0], [1.7, 0.09, 0], 0.56],
    [[1.7, 0.09, 0], SOMA_END, 0.4],
  ];
  const somaR = [0.34, 0.6, 0.56, 0.4, 0.22];
  spinePts.forEach(([a, c], i) => b.capsule(a, somaR[i], c, somaR[i + 1], somaTissue, somaSeed, a[0], c[0]));
  if (hero) {
    for (let i = 0; i < 110; i++) {
      const x = rng.range(-1.0, 2.5);
      spine([x, lerp(0, 0.12, (x + 1) / 3.5), 0], [1, 0, 0], lerp(0.55, 0.25, smooth(1.2, 2.5, x)), x, 1);
    }
  }

  // --- dendrites: thick veined trunks that fork into bare-tree thickets --------------------
  const trunks: V3[] = [
    [-1, -0.5, 0.2],
    [-0.45, -1, 0.25],
    [-1, 0.2, -0.2],
    [-0.75, 0.8, 0.1],
    [0.1, -1, -0.25],
    [-0.9, -0.2, 0.6],
    [-0.2, 1, -0.35],
    [-0.75, -0.8, -0.3],
  ];
  for (const t of trunks) {
    const d = norm(t);
    growBranch(b, rng, add([-0.5, -0.03, 0], mul(d, 0.35)), d, rng.range(0.22, 0.3), rng.range(2.1, 2.9), 0, -0.2, {
      style,
      sSign: -1,
      wobble: 0.5,
      thickWobble: 1.0,
      thinWobble: 1.3,
      twigForward: 0.75,
      minStep: 0.13,
      twigRate: 7 * (hero ? 1 : 0.4),
      twigBudget: 70,
      twigLen: [0.35, 1.1],
      twigR: 0.0095 * hairBoost,
      minR: 0.0042 * hairBoost,
      maxDepth: 10,
      spread: 0.9,
      childScale: 0.64,
      lenScale: 0.86,
      bias: [-0.4, -0.5, 0.0],
      biasK: 0.06,
      onStep: (p, dd, r, s) => spine(p, dd, r, s, 0.35),
      budget: mkBudget(26000),
    });
  }

  // --- axon ------------------------------------------------------------------------------
  if (hero) axonPath.push([0, 0, 0], SOMA_END);
  const seed = rng.next();
  let l = 0;
  const S0 = 2.5; // path distance of the axon start (for the travelling pulse)
  const pieces = 12;
  for (let i = 0; i < pieces; i++) {
    const p = axonAt(l);
    const q = axonAt(l + INITIAL_LEN / pieces);
    const ra = lerp(0.22, 0.12, Math.sqrt(i / pieces));
    const rb = lerp(0.22, 0.12, Math.sqrt((i + 1) / pieces));
    b.capsule(p, ra, q, rb, tissue, seed, S0 + l, S0 + l + INITIAL_LEN / pieces);
    const d = norm(sub(q, p));
    for (let k = 0; k < 11; k++) spine(lerp3(p, q, rng.next()), d, ra, S0 + l, 0.9);
    l += INITIAL_LEN / pieces;
    if (hero) axonPath.push(q);
  }
  for (let i = 0; i < SHEATHS; i++) {
    const p = axonAt(l);
    const q = axonAt(l + SHEATH_LEN);
    // sheaths are flat-ended cylinders that butt against the node pieces, so nothing overlaps
    b.capsule(p, 0.215, q, 0.215, { col: MYELIN, opacity: 1, mat: MAT_MYELIN, fire: 1, glow: i % 2 === 1 ? 0.16 : 0.02 }, rng.next(), S0 + l, S0 + l + SHEATH_LEN);
    l += SHEATH_LEN;
    const n = axonAt(l + NODE_GAP);
    b.capsule(q, 0.1, n, 0.1, { col: mul(NODE, 0.5), opacity: 1, mat: MAT_MYELIN, fire: 1, glow: 0.4 }, rng.next(), S0 + l, S0 + l + NODE_GAP);
    l += NODE_GAP;
    if (hero) axonPath.push(n);
  }
  // terminal tree
  const p = axonAt(l);
  const q = axonAt(AXON_LENGTH);
  const d = norm(sub(q, p));
  b.capsule(p, 0.1, q, 0.2, tissue, seed, S0 + l, S0 + AXON_LENGTH);
  if (hero) axonPath.push(q, add(q, mul(d, 1.2)));
  const fan: V3[] = [
    [0.45, 0.9, 0.15],
    [0.95, 0.3, -0.25],
    [0.85, -0.5, 0.25],
    [0.35, -0.95, -0.15],
  ];
  for (const f of fan) {
    const cd = norm(add(f, mul(rng.dir(), 0.3)));
    growBranch(b, rng, q, cd, 0.16, rng.range(1.45, 1.9), 0, S0 + AXON_LENGTH, {
      style,
      sSign: 1,
      wobble: 0.5,
      thickWobble: 1.4,
      thinWobble: 1.2,
      twigForward: 0.75,
      minStep: 0.13,
      twigRate: 7 * (hero ? 1 : 0.4),
      twigBudget: 70,
      twigLen: [0.3, 0.9],
      twigR: 0.009 * hairBoost,
      minR: 0.0042 * hairBoost,
      maxDepth: 9,
      spread: 0.75,
      childScale: 0.64,
      lenScale: 0.82,
      bias: cd,
      biasK: 0.15,
      onStep: (pp, dd, r, s) => spine(pp, dd, r, s, 0.3),
      budget: mkBudget(15000),
    });
  }
};

/** way-points of the hero axon (soma -> terminal fork), filled in by build() */
const axonPath: V3[] = [];

let cache: Float32Array | null = null;
const build = () => {
  if (cache) return cache;
  axonPath.length = 0;
  const b = new Builder();
  buildNeuron(b, makeRng(20241), 1);

  // a row of sister neurons receding up and to the left, increasingly out of focus
  const rowStep: V3 = [-5.4, 3.5, -7.5];
  const seeds = [77, 913, 4242, 1337, 606];
  seeds.forEach((sd, i) => {
    const k = i + 1;
    const jr = makeRng(sd + 5);
    b.offset = add(mul(rowStep, k), [jr.range(-0.8, 0.8), jr.range(-0.5, 0.5), jr.range(-1, 1)]);
    b.rot = jr.range(-0.08, 0.08);
    b.rotX = jr.range(-0.1, 0.1);
    b.scale = 1.05;
    b.tint = 0.47;
    b.fade = 0.9;
    buildNeuron(b, makeRng(sd), 0.07);
  });
  b.offset = [0, 0, 0];
  b.rot = 0;
  b.rotX = 0;
  b.scale = 1;
  b.tint = 1;
  b.fade = 1;

  // dust: lots of tiny white specks and a few soft red motes
  const rng = makeRng(555);
  for (let i = 0; i < 3200; i++) {
    const red = rng.next() < 0.08;
    const p: V3 = [rng.range(-18, 24), rng.range(-11, 13), rng.range(-1, 1) * rng.range(0.3, red ? 7 : 4.5) - 0.3];
    b.point(
      p,
      red ? rng.range(0.012, 0.026) : rng.range(0.004, 0.01),
      { col: red ? [1.6, 0.1, 0.07] : [1.5, 1.5, 1.6], opacity: 0, mat: MAT_DUST },
      rng.next(),
    );
  }
  cache = b.toArray();
  return cache;
};

const look: Look = {
  background: [0.00003, 0.00003, 0.00006],
  fog: [0.0002, 0.00015, 0.00025],
  tissueBase: [0.6, 0.3, 0.28],
  tissueA: [0.08, 0.6, 1.0],
  tissueB: [1.0, 0.15, 0.09],
  fireColor: [1.0, 0.3, 0.1],
  pulseColor: [1.0, 0.14, 0.08],
  light: [-0.3, 0.8, 0.55],
  bloomStrength: 0.3,
  bloomRadius: 0.55,
  bloomThreshold: 0.7,
  maxCoc: 0.045,
  sway: 0.03,
  vignette: 0.5,
  grain: 0.014,
  saturation: 1.3,
};

const ease = (t: number) => t * t * (3 - 2 * t);
/** point at fraction u (0 = soma, 1 = terminal) along the hero axon */
const alongAxon = (u: number): V3 => {
  build();
  const x = Math.min(0.9999, Math.max(0, u)) * (axonPath.length - 1);
  const i = Math.floor(x);
  return lerp3(axonPath[i], axonPath[i + 1], x - i);
};
/** distance along the view axis from the camera to a world point (what the lens focuses on) */
const depthOf = (cam: V3, target: V3, p: V3) => {
  const f = norm([target[0] - cam[0], target[1] - cam[1], target[2] - cam[2]]);
  return (p[0] - cam[0]) * f[0] + (p[1] - cam[1]) * f[1] + (p[2] - cam[2]) * f[2];
};
// the pulse starts well before the soma and ends well past the terminal, so it never pops in or out
const pulseAt = (time: number) => ((time * 2.6 + 4.0) % (AXON_LENGTH + 16)) - 5;

/** Version 1 - matches the reference: slow push-in, focus held on the cell while the background softens. */
const stateV1 = (frame: number, fps: number, dur: number): FrameState => {
  const t = frame / (dur - 1);
  const time = frame / fps;
  const e = lerp(t, ease(t), 0.35);
  const target: V3 = [lerp(3.55, 3.7, e), lerp(0.05, 0.75, e), 0];
  const dist = lerp(27.0, 21.3, e);
  const yaw = lerp(0.06, 0.0, e);
  const pitch = lerp(0.1, 0.05, e);
  const camPos: V3 = [
    target[0] + Math.sin(yaw) * Math.cos(pitch) * dist,
    target[1] + Math.sin(pitch) * dist,
    target[2] + Math.cos(yaw) * Math.cos(pitch) * dist,
  ];
  return {
    camPos,
    camTarget: target,
    camUp: [Math.sin(lerp(0.0, 0.03, e)), 1, 0],
    fovDeg: 30,
    focusDist: depthOf(camPos, target, [5, 0.6, -0.25]),
    aperture: lerp(0.062, 0.1, e),
    time,
    pulse: pulseAt(time),
    pulseWidth: 0.75,
    fire: 1,
    burst: 0,
    exposure: 1.0,
  };
};

/**
 * Version 2 - alternative camera: a low, close tracking shot that starts on the
 * axon terminal and travels down the myelinated axon to the soma while racking focus.
 */
const stateV2 = (frame: number, fps: number, dur: number): FrameState => {
  const t = frame / (dur - 1);
  const time = frame / fps;
  const e = ease(t);
  const target = alongAxon(lerp(0.95, 0.08, e));
  const dist = lerp(8.2, 10.5, e);
  const yaw = lerp(0.95, 0.4, e);
  const pitch = lerp(-0.16, -0.24, e);
  const camPos: V3 = [
    target[0] + Math.sin(yaw) * Math.cos(pitch) * dist,
    target[1] + Math.sin(pitch) * dist,
    target[2] + Math.cos(yaw) * Math.cos(pitch) * dist,
  ];
  return {
    camPos,
    camTarget: target,
    camUp: [Math.sin(lerp(0.1, -0.04, e)), 1, 0],
    fovDeg: 36,
    focusDist: depthOf(camPos, target, target),
    aperture: 0.055,
    time,
    pulse: pulseAt(time),
    pulseWidth: 0.75,
    fire: 1,
    burst: 0,
    exposure: 1.0,
  };
};

export const myelinatedV1: SceneDef = { build, look, state: stateV1 };
export const myelinatedV2: SceneDef = { build, look, state: stateV2 };
