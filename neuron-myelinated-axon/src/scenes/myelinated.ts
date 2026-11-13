import { Builder, V3, add, growBranch, lerp, lerp3, makeRng, mul, norm, Rng } from "../engine/builder";
import type { SceneDef } from "../engine/NeuronCanvas";
import { FrameState, Look, MAT_DUST, MAT_LIT, MAT_MYELIN, MAT_TISSUE } from "../engine/renderer";

/**
 * Scene: a myelinated neuron drifting in dark space, with out-of-focus sister
 * neurons behind it, floating dust and a signal hopping along the axon.
 */

const GREY: V3 = [0.6, 0.56, 0.54];
const GREY_WARM: V3 = [0.66, 0.55, 0.5];
const MYELIN: V3 = [0.55, 0.47, 0.4];

/** Polyline of the axon (soma -> terminal) with a gentle kink at every node of Ranvier. */
const AXON_DIR: V3 = norm([1, 0.2, -0.06]);
const SOMA_END: V3 = [1.25, 0.22, -0.02];
const INITIAL_LEN = 1.5;
const SHEATHS = 8;
const SHEATH_LEN = 0.76;
const NODE_GAP = 0.15;
export const AXON_LENGTH = INITIAL_LEN + SHEATHS * (SHEATH_LEN + NODE_GAP) + 0.6;

/** way-points of the hero axon (soma -> terminal fork), filled in by build() */
const axonPath: V3[] = [];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const buildNeuron = (b: Builder, rng: Rng, detail: number) => {
  const mkBudget = (n: number) => ({ left: Math.floor(n * detail) });
  const hairBoost = detail < 1 ? 3.0 : 1; // low-detail copies get fewer but fatter hairs
  const style = (r: number, _s: number, _d: number, g: Rng) => {
    if (r > 0.022) {
      return {
        col: lerp3(GREY, GREY_WARM, g.next()),
        opacity: 1,
        mat: MAT_TISSUE,
        fire: 0.35,
        extra: 1 - smooth(0.022, 0.055, r),
      };
    }
    const k = g.range(0.6, 1.0);
    return { col: mul(lerp3(GREY, GREY_WARM, g.next()), k), opacity: 0.88, mat: MAT_LIT };
  };
  const spine = (p: V3, d: V3, r: number, s: number) => {
    if (detail < 1 || r < 0.055 || rng.next() > 0.55) return;
    const out = norm(add(rng.dir(), mul(d, -0.2 * (d[0] * 0 + 1))));
    const L = rng.range(0.12, 0.3);
    const base = add(p, mul(out, r * 0.8));
    const tip = add(base, mul(out, L));
    b.capsule(base, 0.007, tip, 0.005, { col: [0.75, 0.7, 0.7], opacity: 1, mat: MAT_LIT }, rng.next(), s, s);
    const red = rng.next() < 0.45;
    b.point(
      tip,
      rng.range(0.012, 0.02),
      { col: red ? [1.0, 0.25, 0.16] : [0.92, 0.9, 0.95], opacity: 1, mat: MAT_LIT, glow: red ? 0.9 : 0.25 },
      rng.next(),
      s,
    );
  };

  // --- soma -------------------------------------------------------------
  const tissue = { col: GREY, opacity: 1, mat: MAT_TISSUE, fire: 0.35, extra: 0 };
  b.capsule([-0.4, -0.03, 0], 0.42, [0.3, 0.06, 0], 0.44, tissue, rng.next(), -0.3, 0.4);
  b.capsule([0.3, 0.06, 0], 0.44, SOMA_END, 0.14, tissue, rng.next(), 0.4, 1.2);
  b.capsule([-0.2, 0.14, 0.14], 0.4, [0.3, -0.16, -0.12], 0.36, tissue, rng.next(), 0, 0.3);

  // --- dendrites ----------------------------------------------------------
  const trunks: V3[] = [
    [-1, 0.3, 0.3],
    [-0.8, -0.8, 0.35],
    [-0.7, 0.9, 0.05],
    [-0.2, -1, 0.1],
    [-1, -0.25, -0.4],
    [-0.25, 1, -0.4],
    [-0.75, -0.2, 0.8],
  ];
  for (const t of trunks) {
    const d = norm(t);
    growBranch(b, rng, mul(d, 0.3), d, rng.range(0.19, 0.25), rng.range(1.3, 1.8), 0, -0.2, {
      style,
      sSign: -1,
      wobble: 0.55,
      twigRate: 2.6 * (detail < 1 ? 0.5 : 1),
      twigLen: [0.5, 1.5],
      twigR: 0.011 * hairBoost,
      minR: 0.0048 * hairBoost,
      maxDepth: 9,
      spread: 0.8,
      childScale: 0.72,
      lenScale: 0.84,
      bias: [-0.5, -0.15, 0.1],
      biasK: 0.3,
      onStep: spine,
      budget: mkBudget(9500),
    });
  }

  // --- axon ---------------------------------------------------------------
  let p: V3 = SOMA_END;
  let d: V3 = AXON_DIR;
  const hero = detail === 1;
  if (hero) axonPath.push([0, 0, 0], p);
  let s = 1.2;
  const seed = rng.next();
  // initial segment
  const nInit = 6;
  for (let i = 0; i < nInit; i++) {
    d = norm(add(d, mul(rng.dir(), 0.09)));
    const q = add(p, mul(d, INITIAL_LEN / nInit));
    const ra = lerp(0.125, 0.085, i / nInit);
    const rb = lerp(0.125, 0.085, (i + 1) / nInit);
    b.capsule(p, ra, q, rb, tissue, seed, s, s + INITIAL_LEN / nInit);
    for (let k = 0; k < 5; k++) spine(lerp3(p, q, rng.next()), d, 0.1, s);
    p = q;
    s += INITIAL_LEN / nInit;
    if (hero) axonPath.push(p);
  }
  for (let i = 0; i < SHEATHS; i++) {
    // kink at the node, pulled back toward the overall axon direction
    d = norm(add(add(d, mul(rng.dir(), 0.2)), mul(AXON_DIR, 0.35)));
    const q = add(p, mul(d, SHEATH_LEN));
    b.capsule(p, 0.06, q, 0.06, tissue, seed, s, s + SHEATH_LEN); // axon core
    const a0 = add(p, mul(d, 0.12));
    const a1 = add(q, mul(d, -0.12));
    b.capsule(a0, 0.17, a1, 0.17, { col: MYELIN, opacity: 1, mat: MAT_MYELIN, fire: 1, glow: i % 3 === 1 ? 0.3 : 0.05 }, rng.next(), s, s + SHEATH_LEN);
    s += SHEATH_LEN;
    const n = add(q, mul(d, NODE_GAP));
    b.capsule(q, 0.06, n, 0.06, { ...tissue, fire: 1 }, seed, s, s + NODE_GAP);
    // node of Ranvier: small warm glow
    b.point(lerp3(q, n, 0.5), 0.075, { col: [1.0, 0.3, 0.18], opacity: 0.6, mat: MAT_LIT, glow: 0.7 }, rng.next(), s);
    p = n;
    s += NODE_GAP;
    if (hero) axonPath.push(p);
  }
  // terminal arbor
  const q = add(p, mul(d, 0.5));
  b.capsule(p, 0.07, q, 0.085, tissue, seed, s, s + 0.5);
  s += 0.5;
  if (hero) axonPath.push(q, add(q, mul(d, 1.0)));
  for (let k = 0; k < 4; k++) {
    const cd = norm(add(d, mul(rng.dir(), 0.95)));
    growBranch(b, rng, q, cd, 0.085, rng.range(1.1, 1.6), 0, s, {
      style,
      sSign: 1,
      wobble: 0.6,
      twigRate: 2.6 * (detail < 1 ? 0.5 : 1),
      twigLen: [0.3, 0.7],
      twigR: 0.009 * hairBoost,
      minR: 0.0048 * hairBoost,
      maxDepth: 7,
      spread: 0.8,
      childScale: 0.72,
      lenScale: 0.8,
      bias: d,
      biasK: 0.25,
      onStep: spine,
      budget: mkBudget(4500),
    });
  }
};

let cache: Float32Array | null = null;
const build = () => {
  if (cache) return cache;
  const b = new Builder();
  buildNeuron(b, makeRng(20241), 1);

  // out-of-focus sister neurons behind the hero
  const copies: { off: V3; rot: number; rotX: number; seed: number; scale: number }[] = [
    { off: [-3.4, 4.2, -9], rot: 0.1, rotX: 0.1, seed: 77, scale: 1.1 },
    { off: [1.5, 7.8, -18], rot: -0.08, rotX: -0.05, seed: 913, scale: 1.2 },
    { off: [-13.5, 1.2, -3.5], rot: 0.25, rotX: 0.2, seed: 4242, scale: 1.1 },
  ];
  for (const c of copies) {
    b.offset = c.off;
    b.rot = c.rot;
    b.rotX = c.rotX;
    b.scale = c.scale;
    b.tint = 0.62;
    b.fade = 0.8;
    buildNeuron(b, makeRng(c.seed), 0.05);
  }
  b.offset = [0, 0, 0];
  b.rot = 0;
  b.rotX = 0;
  b.scale = 1;
  b.tint = 1;
  b.fade = 1;

  // dust
  const rng = makeRng(555);
  for (let i = 0; i < 1100; i++) {
    const p: V3 = [rng.range(-16, 22), rng.range(-10, 12), rng.range(-1, 1) * rng.range(1, 7) - 0.5];
    const red = rng.next() < 0.28;
    b.point(
      p,
      rng.range(0.008, 0.02) * (red ? 1.9 : 1),
      { col: red ? [1.5, 0.12, 0.08] : [0.9, 0.9, 0.95], opacity: 0, mat: MAT_DUST },
      rng.next(),
    );
  }
  cache = b.toArray();
  return cache;
};

const look: Look = {
  background: [0.0004, 0.0004, 0.0006],
  fog: [0.0015, 0.001, 0.0012],
  tissueA: [0.08, 0.42, 1.0],
  tissueB: [1.0, 0.17, 0.07],
  fireColor: [1.0, 0.3, 0.1],
  pulseColor: [1.0, 0.16, 0.08],
  light: [-0.35, 0.75, 0.6],
  bloomStrength: 0.38,
  bloomRadius: 0.55,
  bloomThreshold: 0.72,
  maxCoc: 0.045,
  sway: 0.035,
  vignette: 0.55,
  grain: 0.022,
  saturation: 1.12,
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
const pulseAt = (time: number) => ((time * 2.6 + 3.0) % (AXON_LENGTH + 5)) - 1.5;

/** Version 1 - matches the reference: slow push-in with a slight orbit, focus held on the cell. */
const stateV1 = (frame: number, fps: number, dur: number): FrameState => {
  const t = frame / (dur - 1);
  const time = frame / fps;
  const e = lerp(t, ease(t), 0.35);
  const target: V3 = [lerp(3.5, 3.9, e), lerp(1.3, 1.0, e), 0];
  const dist = lerp(30.5, 20.7, e);
  const yaw = lerp(0.07, 0.0, e);
  const pitch = lerp(0.1, 0.05, e);
  const camPos: V3 = [
    target[0] + Math.sin(yaw) * Math.cos(pitch) * dist,
    target[1] + Math.sin(pitch) * dist,
    target[2] + Math.cos(yaw) * Math.cos(pitch) * dist,
  ];
  return {
    camPos,
    camTarget: target,
    camUp: [Math.sin(lerp(-0.035, -0.07, e)), 1, 0],
    fovDeg: 30,
    focusDist: depthOf(camPos, target, [5, 1.1, -0.25]),
    aperture: 0.075,
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
  const target = alongAxon(lerp(0.97, 0.1, e));
  const dist = lerp(6.6, 8.6, e);
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
    aperture: 0.075,
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
