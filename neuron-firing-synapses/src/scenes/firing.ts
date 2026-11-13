import { Builder, V3, add, growBranch, lerp, lerp3, makeRng, mul, norm, Rng } from "../engine/builder";
import type { SceneDef } from "../engine/NeuronCanvas";
import { FrameState, Look, MAT_DUST, MAT_GLOW, MAT_SYNAPSE } from "../engine/renderer";

/**
 * Scene: a luminous neuron that fires rhythmically. Synapse particles spark up
 * across the dendrites, the soma flashes hot, the signal runs out along the
 * axon, then everything snaps back to calm - while the lens racks focus from
 * the cell body to the far axon terminal.
 */

export type Palette = {
  trunk: V3; // thick fibres
  hair: V3; // fine dendrite fuzz
  hairAlt: V3;
  particle: V3; // synapse sparks
  fire: V3; // hot firing colour
  background: V3;
  fog: V3;
};

const AXON_DIR: V3 = norm([6.2, 3.0, -4.6]);
const AXON_INITIAL = 4.2;
const BEADS = 5;
const BEAD_LEN = 0.5;
const BEAD_GAP = 0.08;
export const AXON_END_S = AXON_INITIAL + BEADS * (BEAD_LEN + BEAD_GAP) + 1.4;
/** hero axon way-points, filled by the build */
const axonPath: V3[] = [];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const buildNeuron = (b: Builder, rng: Rng, detail: number, pal: Palette, hero: boolean) => {
  const mkBudget = (n: number) => ({ left: Math.floor(n * detail) });
  const hairBoost = detail < 1 ? 3.0 : 1;
  const style = (r: number, _s: number, _d: number, g: Rng) => {
    const thick = smooth(0.012, 0.07, r);
    const hair = mul(lerp3(pal.hair, pal.hairAlt, g.next()), g.range(0.55, 1.1));
    return {
      col: lerp3(hair, pal.trunk, thick),
      opacity: lerp(0.5, 1.0, Math.min(1, thick * 1.6)),
      mat: MAT_GLOW,
      fire: smooth(0.03, 0.09, r),
    };
  };
  const spark = (p: V3, s: number) => {
    b.point(
      add(p, mul(rng.dir(), 0.03)),
      rng.range(0.018, 0.04) * (hero ? 1 : 1.8),
      { col: mul(pal.particle, rng.range(0.75, 1.2)), opacity: 0.55, mat: MAT_SYNAPSE },
      rng.next(),
      s,
    );
  };
  const sparkRate = hero ? 0.085 : 0.2;
  const onStep = (p: V3, _d: V3, r: number, s: number) => {
    if (r < 0.02 && rng.next() < sparkRate) spark(p, s);
  };
  const onTip = (p: V3, s: number) => {
    if (rng.next() < 0.5) spark(p, s);
  };

  // --- soma: a lumpy cluster of lobes --------------------------------------
  const somaStyle = { col: pal.trunk, opacity: 1, mat: MAT_GLOW, fire: 1 };
  b.capsule([-0.3, -0.05, 0], 0.55, [0.3, 0.1, 0], 0.52, somaStyle, rng.next(), -0.2, 0.2);
  for (let i = 0; i < 7; i++) {
    const d = rng.dir();
    b.capsule(mul(d, 0.2), 0.45, mul(d, 0.62), 0.26, somaStyle, rng.next(), -0.3, 0);
  }

  // --- dendrites -------------------------------------------------------------
  const trunks: V3[] = [
    [-1, 0.1, 0.35],
    [-0.75, -0.65, 0.6],
    [-0.1, -1, 0.35],
    [0.55, -0.85, 0.3],
    [-0.65, 0.8, 0.1],
    [0.1, 0.95, 0.45],
    [-0.9, -0.2, -0.5],
    [0.9, -0.15, 0.55],
    [-0.2, 0.5, -0.9],
  ];
  for (const t of trunks) {
    const d = norm(t);
    growBranch(b, rng, mul(d, 0.5), d, rng.range(0.13, 0.18), rng.range(1.5, 2.2), 0, -0.5, {
      style,
      sSign: -1,
      wobble: 0.6,
      thickWobble: 0.9,
      twigRate: 3.6 * (detail < 1 ? 0.5 : 1),
      twigLen: [0.3, 1.0],
      twigR: 0.011 * hairBoost,
      minR: 0.0048 * hairBoost,
      maxDepth: 9,
      spread: 0.85,
      childScale: 0.72,
      lenScale: 0.84,
      bias: [-0.25, -0.1, 0.25],
      biasK: 0.2,
      onStep,
      onTip,
      budget: mkBudget(8500),
    });
  }

  // --- axon: wavy initial segment, glassy myelin beads, terminal arbor -----
  let p: V3 = mul(AXON_DIR, 0.45);
  let d: V3 = AXON_DIR;
  let s = 0.45;
  const seed = rng.next();
  if (hero) axonPath.push([0, 0, 0], p);
  const axonStyle = { col: pal.trunk, opacity: 0.85, mat: MAT_GLOW, fire: 1 };
  const nInit = 26;
  const side: V3 = norm([-AXON_DIR[1], AXON_DIR[0], 0]);
  for (let i = 0; i < nInit; i++) {
    const wave = Math.cos((i / nInit) * Math.PI * 3.2 + 0.6) * 0.5;
    d = norm(add(add(AXON_DIR, mul(side, wave)), mul(rng.dir(), 0.08)));
    const q = add(p, mul(d, AXON_INITIAL / nInit));
    const ra = lerp(0.24, 0.13, Math.sqrt(i / nInit));
    const rb = lerp(0.24, 0.13, Math.sqrt((i + 1) / nInit));
    b.capsule(p, ra, q, rb, axonStyle, seed, s, s + AXON_INITIAL / nInit);
    p = q;
    s += AXON_INITIAL / nInit;
  }
  if (hero) axonPath.push(p);
  for (let i = 0; i < BEADS; i++) {
    const wave = Math.sin((i / BEADS) * Math.PI * 1.6 + 0.4) * 0.75;
    d = norm(add(add(AXON_DIR, mul(side, wave)), mul(rng.dir(), 0.1)));
    const q = add(p, mul(d, BEAD_LEN));
    b.capsule(p, 0.08, q, 0.08, axonStyle, seed, s, s + BEAD_LEN);
    // translucent sheath, permanently tinted with the firing colour
    b.capsule(add(p, mul(d, 0.13)), 0.2, add(q, mul(d, -0.13)), 0.2, { col: mul(pal.trunk, 0.22), opacity: 0.6, mat: MAT_GLOW, fire: 1, extra: 1 }, rng.next(), s, s + BEAD_LEN);
    s += BEAD_LEN;
    const n = add(q, mul(d, BEAD_GAP));
    b.capsule(q, 0.08, n, 0.08, axonStyle, seed, s, s + BEAD_GAP);
    p = n;
    s += BEAD_GAP;
    if (hero) axonPath.push(p);
  }
  const q = add(p, mul(AXON_DIR, 0.6));
  b.capsule(p, 0.09, q, 0.11, axonStyle, seed, s, s + 0.6);
  s += 0.6;
  if (hero) axonPath.push(q);
  for (let k = 0; k < 4; k++) {
    const cd = norm(add(AXON_DIR, mul(rng.dir(), 1.0)));
    growBranch(b, rng, q, cd, 0.1, rng.range(1.1, 1.7), 0, s, {
      style,
      sSign: 1,
      wobble: 0.55,
      twigRate: 2.2 * (detail < 1 ? 0.5 : 1),
      twigLen: [0.3, 0.8],
      twigR: 0.009 * hairBoost,
      minR: 0.0048 * hairBoost,
      maxDepth: 7,
      spread: 0.8,
      childScale: 0.72,
      lenScale: 0.8,
      bias: AXON_DIR,
      biasK: 0.2,
      onStep,
      onTip,
      budget: mkBudget(3200),
    });
  }
};

const cache = new Map<string, Float32Array>();
const makeBuild = (key: string, pal: Palette) => () => {
  const hit = cache.get(key);
  if (hit) return hit;
  axonPath.length = 0;
  const b = new Builder();
  buildNeuron(b, makeRng(8807), 1, pal, true);

  // distant, out-of-focus neighbours
  const copies: { off: V3; rot: number; rotX: number; seed: number }[] = [
    { off: [13, 6.5, -13], rot: 1.3, rotX: 0.3, seed: 31 },
    { off: [-13, 7.5, -12], rot: -0.7, rotX: -0.2, seed: 977 },
    { off: [-9.5, -4.2, 3.4], rot: 2.4, rotX: 0.5, seed: 2203 },
  ];
  for (const c of copies) {
    b.offset = c.off;
    b.rot = c.rot;
    b.rotX = c.rotX;
    b.tint = 0.75;
    buildNeuron(b, makeRng(c.seed), 0.05, pal, false);
  }
  b.offset = [0, 0, 0];
  b.rot = 0;
  b.rotX = 0;
  b.tint = 1;

  // a little floating dust for depth
  const rng = makeRng(99);
  for (let i = 0; i < 260; i++) {
    const p: V3 = [rng.range(-9, 11), rng.range(-6, 7), rng.range(-8, 5)];
    b.point(p, rng.range(0.008, 0.018), { col: mul(pal.hairAlt, 2.2), opacity: 0, mat: MAT_DUST }, rng.next());
  }
  const out = b.toArray();
  cache.set(key, out);
  return out;
};

const makeLook = (pal: Palette): Look => ({
  background: pal.background,
  fog: pal.fog,
  tissueA: pal.trunk,
  tissueB: pal.fire,
  fireColor: pal.fire,
  pulseColor: pal.fire,
  light: [-0.3, 0.7, 0.65],
  bloomStrength: 0.55,
  bloomRadius: 0.55,
  bloomThreshold: 0.7,
  maxCoc: 0.03,
  sway: 0.03,
  vignette: 0.5,
  grain: 0.018,
  saturation: 1.1,
});

const ease = (t: number) => t * t * (3 - 2 * t);
const depthOf = (cam: V3, target: V3, p: V3) => {
  const f = norm([target[0] - cam[0], target[1] - cam[1], target[2] - cam[2]]);
  return (p[0] - cam[0]) * f[0] + (p[1] - cam[1]) * f[1] + (p[2] - cam[2]) * f[2];
};

/** One firing cycle lasts 33.75 frames (1.125 s); the hard reset lands on frame 15 + n * 33.75. */
const CYCLE = 33.75;
const firing = (frame: number) => {
  const ph = (((frame - 16.5) / CYCLE) % 1 + 1) % 1; // 0 = just reset
  const tail = Math.max(0, 1 - ph / 0.045); // 1.5-frame fade-out right after the reset
  const rise = smooth(0.22, 1.0, ph);
  const burst = Math.max(Math.pow(rise, 1.25), tail * 0.6);
  const fire = Math.max(smooth(0.2, 0.42, ph), tail * 0.5);
  // the front starts out in the dendrites (negative s), crosses the soma and runs down the axon
  const front = ph < 0.045 ? AXON_END_S * 0.62 : lerp(-0.8, AXON_END_S * 0.62, smooth(0.3, 1.0, ph));
  return { burst, fire, front };
};

const makeState = () => (frame: number, fps: number, dur: number): FrameState => {
  const t = frame / (dur - 1);
  const time = frame / fps;
  const e = ease(t);
  const target: V3 = [lerp(0.4, 0.1, e), lerp(0.65, 0.8, e), 0];
  const dist = lerp(13.4, 12.0, e);
  const yaw = lerp(-0.05, 0.05, e);
  const pitch = lerp(0.02, 0.05, e);
  const camPos: V3 = [
    target[0] + Math.sin(yaw) * Math.cos(pitch) * dist,
    target[1] + Math.sin(pitch) * dist,
    target[2] + Math.cos(yaw) * Math.cos(pitch) * dist,
  ];
  // rack focus: cell body -> far axon terminal
  const rack = ease(Math.min(1, Math.max(0, (frame - 55) / 165)));
  const nearF = depthOf(camPos, target, [0, 0, 0.6]);
  const farF = depthOf(camPos, target, axonPath[axonPath.length - 1] ?? [6.2, 3, -4.6]) + 0.4;
  const f = firing(frame);
  return {
    camPos,
    camTarget: target,
    camUp: [0.03, 1, 0],
    fovDeg: 32,
    focusDist: lerp(nearF, farF, rack),
    aperture: lerp(0.07, 0.085, rack),
    time,
    pulse: f.front,
    pulseWidth: 3.6,
    fire: f.fire,
    burst: f.burst,
    exposure: 1.0,
  };
};

/** Version 1 - the reference palette: electric blue cell, orange / amber firing. */
export const BLUE_AMBER: Palette = {
  trunk: [0.06, 0.32, 0.95],
  hair: [0.02, 0.16, 0.7],
  hairAlt: [0.05, 0.32, 0.8],
  particle: [1.0, 0.36, 0.03],
  fire: [1.0, 0.55, 0.12],
  background: [0.0002, 0.0006, 0.002],
  fog: [0.0, 0.002, 0.008],
};

/** Version 2 - alternative palette: violet / magenta cell, mint-cyan firing. */
export const VIOLET_MINT: Palette = {
  trunk: [0.5, 0.1, 0.95],
  hair: [0.26, 0.03, 0.66],
  hairAlt: [0.6, 0.06, 0.55],
  particle: [0.1, 1.0, 0.62],
  fire: [0.25, 1.0, 0.75],
  background: [0.0012, 0.0002, 0.002],
  fog: [0.006, 0.0, 0.008],
};

export const firingV1: SceneDef = { build: makeBuild("v1", BLUE_AMBER), look: makeLook(BLUE_AMBER), state: makeState() };
export const firingV2: SceneDef = { build: makeBuild("v2", VIOLET_MINT), look: makeLook(VIOLET_MINT), state: makeState() };
