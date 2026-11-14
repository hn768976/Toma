import { Builder, V3, add, growBranch, lerp, lerp3, makeRng, mul, norm, sub, Rng } from "../engine/builder";
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

// --- axon centre line (world units): soma -> wavy initial segment -> myelin beads -> fork -----
const A0: V3 = [0.35, 0.1, -0.2];
const A1: V3 = [2.35, 0.7, -2.5]; // first bead
const A2: V3 = [4.3, 2.2, -4.5]; // last bead
const A3: V3 = [4.9, 2.6, -5.0]; // terminal fork
const BEADS = 5;
const dist3 = (a: V3, c: V3) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
const AXON_INITIAL = dist3(A0, A1) * 1.06;
export const AXON_END_S = AXON_INITIAL + dist3(A1, A2) + dist3(A2, A3);
/** hero axon way-points, filled by the build */
const axonPath: V3[] = [];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const buildNeuron = (b: Builder, rng: Rng, pal: Palette) => {
  const style = (r: number, _s: number, _d: number, g: Rng) => {
    const thick = smooth(0.012, 0.06, r);
    const hair = mul(lerp3(pal.hair, pal.hairAlt, g.next()), g.range(0.8, 1.5));
    return {
      col: lerp3(hair, pal.trunk, thick),
      opacity: lerp(0.75, 1.0, Math.min(1, thick * 1.6)),
      mat: MAT_GLOW,
      fire: smooth(0.035, 0.085, r),
    };
  };
  // synapse sparks are tiny dashes, so they read as flecks when sharp and as discs when defocused
  const spark = (p: V3, s: number) => {
    const a = add(p, mul(rng.dir(), 0.03));
    const r = rng.range(0.011, 0.024);
    b.capsule(a, r, add(a, mul(rng.dir(), rng.range(0.02, 0.09))), r, { col: mul(pal.particle, rng.range(1.1, 2.0)), opacity: 0.7, mat: MAT_SYNAPSE }, rng.next(), s, s);
  };
  const onStep = (p: V3, _d: V3, r: number, s: number) => {
    if (r < 0.02 && rng.next() < 0.12) spark(p, s);
  };
  const onTip = (p: V3, s: number) => {
    if (rng.next() < 0.6) spark(p, s);
  };

  // the cell body and dendrites are tilted away from the camera, so the tree is seen obliquely
  b.rot = 0.42;
  b.rotX = 0.38;
  // --- soma: an irregular, elongated cluster of lobes ------------------------------------
  const somaStyle = { col: pal.trunk, opacity: 1, mat: MAT_GLOW, fire: 1, bias: 0.9 };
  b.capsule([-0.12, -0.42, 0], 0.3, [0.1, 0.38, 0], 0.34, somaStyle, rng.next(), -0.2, 0.2);
  for (let i = 0; i < 7; i++) {
    const d = rng.dir();
    const o: V3 = [0, rng.range(-0.35, 0.35), 0];
    b.capsule(add(o, mul(d, rng.range(0.05, 0.2))), rng.range(0.24, 0.32), add(o, mul(d, rng.range(0.3, 0.5))), rng.range(0.16, 0.22), somaStyle, rng.next(), -0.3, 0);
  }

  // --- dendrites: tapering trunks that end in dense feathery tufts ------------------------
  const trunks: V3[] = [
    [-1, 0.25, 0.3],
    [-0.8, -0.6, 0.45],
    [-0.25, -1, 0.35],
    [0.35, -0.95, 0.3],
    [-0.6, 0.8, 0.15],
    [0.15, 1, 0.1],
    [-0.95, -0.15, -0.35],
    [0.6, 0.75, -0.2],
  ];
  trunks.forEach((t, i) => {
    const d = norm(t);
    const r0 = [0.14, 0.13, 0.11, 0.085, 0.1, 0.08, 0.085, 0.07][i];
    growBranch(b, rng, mul(d, 0.35), d, r0, rng.range(1.3, 1.9), 0, -0.5, {
      style,
      sSign: -1,
      wobble: 0.55,
      thickWobble: 0.7,
      thinWobble: 1.2,
      twigForward: 0.9,
      minStep: 0.13,
      twigRate: 8,
      twigBudget: 60,
      twigLen: [0.3, 0.95],
      twigR: 0.008,
      minR: 0.0045,
      maxDepth: 9,
      spread: 0.7,
      childScale: 0.7,
      lenScale: 0.9,
      bias: [-0.2, -0.1, 0.35],
      biasK: 0.08,
      flatten: 0.72,
      onStep,
      onTip,
      budget: { left: 26000 },
    });
  });

  b.rot = 0;
  b.rotX = 0;
  // --- axon ----------------------------------------------------------------------------
  axonPath.push([0, 0, 0], A0);
  const seed = rng.next();
  const axonStyle = { col: pal.trunk, opacity: 1, mat: MAT_GLOW, fire: 1 };
  let s = 0.4;
  // wavy initial segment
  const nInit = 22;
  const dir01 = norm(sub(A1, A0));
  const side: V3 = norm([-dir01[1], dir01[0], 0]);
  let p: V3 = A0;
  for (let i = 1; i <= nInit; i++) {
    const u = i / nInit;
    const wave = Math.sin(u * Math.PI * 2.6) * 0.22 * Math.sin(u * Math.PI);
    const q = add(lerp3(A0, A1, u), mul(side, wave));
    const ra = lerp(0.17, 0.09, Math.sqrt((i - 1) / nInit));
    const rb = lerp(0.17, 0.09, Math.sqrt(u));
    const L = dist3(p, q);
    b.capsule(p, ra, q, rb, axonStyle, seed, s, s + L);
    p = q;
    s += L;
  }
  axonPath.push(A1);
  // glassy myelin beads, zig-zagging slightly; rounded ends just touch, so nothing overlaps
  const R = 0.17;
  for (let i = 1; i <= BEADS; i++) {
    const u = i / BEADS;
    const zig = (i % 2 === 0 ? 1 : -1) * 0.1 * (i < BEADS ? 1 : 0);
    const q = add(lerp3(A1, A2, u), mul(side, zig));
    const d = norm(sub(q, p));
    const L = dist3(p, q);
    b.capsule(add(p, mul(d, R)), R, add(q, mul(d, -R)), R, { col: mul(pal.trunk, 0.15), opacity: 0.8, mat: MAT_GLOW, fire: 1, extra: 1 }, rng.next(), s, s + L);
    p = q;
    s += L;
    axonPath.push(p);
  }
  b.capsule(p, 0.085, A3, 0.11, axonStyle, seed, s, s + dist3(p, A3));
  s += dist3(p, A3);
  axonPath.push(A3);
  const out = norm(sub(A3, A2));
  const fan: V3[] = [
    [0.5, 0.85, 0.1],
    [1, 0.25, -0.2],
    [0.9, -0.45, 0.2],
    [0.35, -0.9, -0.1],
  ];
  for (const f of fan) {
    const cd = norm(add(add(f, mul(out, 0.4)), mul(rng.dir(), 0.25)));
    growBranch(b, rng, A3, cd, 0.09, rng.range(1.0, 1.4), 0, s, {
      style,
      sSign: 1,
      wobble: 0.5,
      thickWobble: 1.3,
      thinWobble: 1.2,
      twigForward: 0.9,
      minStep: 0.13,
      twigRate: 7,
      twigBudget: 60,
      twigLen: [0.25, 0.7],
      twigR: 0.008,
      minR: 0.0045,
      maxDepth: 8,
      spread: 0.7,
      childScale: 0.68,
      lenScale: 0.8,
      bias: cd,
      biasK: 0.15,
      onStep,
      onTip,
      budget: { left: 7000 },
    });
  }
};

const cache = new Map<string, Float32Array>();
const makeBuild = (key: string, pal: Palette) => () => {
  const hit = cache.get(key);
  if (hit) return hit;
  axonPath.length = 0;
  const b = new Builder();
  buildNeuron(b, makeRng(8807), pal);

  // a few floating specks for depth
  const rng = makeRng(99);
  for (let i = 0; i < 70; i++) {
    const p: V3 = [rng.range(-9, 11), rng.range(-6, 7), rng.range(-8, 5)];
    b.point(p, rng.range(0.006, 0.014), { col: mul(pal.hairAlt, 0.8), opacity: 0, mat: MAT_DUST }, rng.next());
  }
  const out = b.toArray();
  cache.set(key, out);
  return out;
};

const makeLook = (pal: Palette): Look => ({
  background: pal.background,
  fog: pal.fog,
  tissueBase: pal.trunk,
  tissueA: pal.trunk,
  tissueB: pal.fire,
  fireColor: pal.fire,
  pulseColor: pal.fire,
  light: [-0.3, 0.7, 0.65],
  bloomStrength: 0.3,
  bloomRadius: 0.4,
  bloomThreshold: 0.72,
  maxCoc: 0.021,
  sway: 0.07,
  vignette: 0.5,
  grain: 0.018,
  saturation: 1.3,
  contrast: 0.3,
});

const ease = (t: number) => t * t * (3 - 2 * t);
const depthOf = (cam: V3, target: V3, p: V3) => {
  const f = norm([target[0] - cam[0], target[1] - cam[1], target[2] - cam[2]]);
  return (p[0] - cam[0]) * f[0] + (p[1] - cam[1]) * f[1] + (p[2] - cam[2]) * f[2];
};

/**
 * Firing timeline, measured from the reference clip (frame numbers at 30 fps).
 * Every cycle is: hard reset to calm -> ~12 calm frames -> the soma flashes on in one frame ->
 * synapse particles build up (with two late surges) -> hard reset.
 */
const RESETS = [-15, 18, 51, 83, 116, 149, 182, 215, 250, 286, 320];
const FLASHES = [-3, 30, 63, 95, 128, 161, 194, 227, 262, 298, 332];
const firing = (frame: number) => {
  let i = 0;
  while (i < RESETS.length - 2 && frame >= RESETS[i + 1]) i++;
  const flash = FLASHES[i];
  const next = RESETS[i + 1];
  if (frame < flash) {
    // right after a reset the particles die away over three frames
    const since = frame - RESETS[i];
    return { burst: since < 3 ? [0.42, 0.24, 0.1][since] : 0, fire: 0, front: 0 };
  }
  const u = (frame - flash) / (next - flash); // 0 at the flash, 1 at the reset
  let burst = 0.2 + 0.42 * u;
  if (frame >= next - 5) burst += 0.19;
  if (frame >= next - 2) burst += 0.19;
  const fire = frame === flash ? 0.8 : 1;
  // the hot front sits on the soma and slides a little way out along the axon
  const front = lerp(-0.2, AXON_END_S * 0.45, smooth(0.5, 1.0, u));
  return { burst, fire, front };
};

const makeState = () => (frame: number, fps: number, dur: number): FrameState => {
  const t = frame / (dur - 1);
  const time = frame / fps;
  const e = ease(t);
  const target: V3 = [lerp(0.05, -0.05, e), lerp(0.37, 0.9, e), 0];
  const dist = lerp(13.0, 12.2, e);
  const yaw = lerp(-0.09, 0.09, t);
  const pitch = lerp(0.02, 0.05, e);
  const camPos: V3 = [
    target[0] + Math.sin(yaw) * Math.cos(pitch) * dist,
    target[1] + Math.sin(pitch) * dist,
    target[2] + Math.cos(yaw) * Math.cos(pitch) * dist,
  ];
  // rack focus: cell body -> far axon terminal
  const rack = ease(Math.min(1, Math.max(0, (frame - 55) / 165)));
  const nearF = depthOf(camPos, target, [0, 0, 0.9]);
  const farF = depthOf(camPos, target, axonPath[axonPath.length - 1] ?? A3) + 0.4;
  const f = firing(frame);
  return {
    camPos,
    camTarget: target,
    camUp: [0.03, 1, 0],
    fovDeg: 32,
    focusDist: lerp(nearF, farF, rack),
    aperture: lerp(0.042, 0.058, rack),
    time,
    pulse: f.front,
    pulseWidth: 3.3,
    fire: f.fire,
    burst: f.burst,
    exposure: 1.22,
  };
};

/** Version 1 - the reference palette: electric blue cell, orange / amber firing. */
export const BLUE_AMBER: Palette = {
  trunk: [0.04, 0.42, 1.0],
  hair: [0.03, 0.3, 1.0],
  hairAlt: [0.12, 0.58, 1.0],
  particle: [1.0, 0.3, 0.02],
  fire: [1.0, 0.42, 0.06],
  background: [0.0, 0.0001, 0.0005],
  fog: [0.0, 0.0006, 0.003],
};

/** Version 2 - alternative palette: violet / magenta cell, mint-cyan firing. */
export const VIOLET_MINT: Palette = {
  trunk: [0.58, 0.1, 1.0],
  hair: [0.42, 0.06, 0.95],
  hairAlt: [0.85, 0.16, 0.9],
  particle: [0.1, 1.0, 0.62],
  fire: [0.25, 1.0, 0.75],
  background: [0.0003, 0.0, 0.0005],
  fog: [0.002, 0.0, 0.003],
};

export const firingV1: SceneDef = { build: makeBuild("v1", BLUE_AMBER), look: makeLook(BLUE_AMBER), state: makeState() };
export const firingV2: SceneDef = { build: makeBuild("v2", VIOLET_MINT), look: makeLook(VIOLET_MINT), state: makeState() };
