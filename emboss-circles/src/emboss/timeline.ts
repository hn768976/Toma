import { track } from "./keyframes";

// The reference is a seamless 3-second (90 frame) loop played three times.
export const LOOP_FRAMES = 90;

const K = 0.33; // walker travel (height units) from lens to hub

const walkO = track([
  [9, 0],
  [12, 0.045],
  [15, 0.072],
  [18, 0.1],
  [24, 0.255],
  [30, 0.312],
  [36, 0.328],
  [40, K],
]);
const walkR = track([
  [2, 0.116],
  [9, 0.116],
  [24, 0.1],
  [64, 0.1],
  [72, 0.093],
  [78, 0.085],
  [81, 0.06],
  [84, 0.03],
  [86, 0],
]);
const lensBlend = track([
  [9, 1],
  [17, 0],
]);
const fill = track([
  [78, 1],
  [89.5, 0],
]);
const beadA = track([
  [57, 0],
  [58, 1],
  [85, 1],
  [89.5, 0],
]);
// distance of a settled walker from its hub before it starts to part
const SETTLED = Math.hypot(0.077, 0.068);
const walkA = track([
  [8, 0],
  [9, 1],
  [80, 1],
  [86, 0],
]);
const lensA = track([
  [-1, 0],
  [4, 1],
]);
const chanA = track([
  [9, 0],
  [11, 1],
  [64, 1],
  [80, 0],
]);
const gamma = track([
  [24, 0],
  [36, 0.27],
  [46, 0.5],
  [56, 0.76],
  [66, 1],
  [76, 1.04],
]);
const ringR = track([
  [38, 0],
  [45, 0.19],
  [58, 0.198],
  [66, 0.235],
  [72, 0.325],
  [74, 0.36],
  [76, 0.4],
  [78, 0.43],
]);
const ringSh = track([
  [40, 0.3],
  [62, 0.35],
  [74, 1],
]);
const edgeA = track([
  [86, 1],
  [89.5, 0],
]);
const ringA = track([
  [38, 0],
  [41, 1],
  [75, 1],
  [78, 0],
]);
const tinyR = track([
  [58, 0],
  [64, 0.022],
  [72, 0.093],
  [78, 0.21],
  [81, 0.255],
  [84, 0.345],
  [87, 0.4],
  [90, 0.43],
]);

export type Uniforms = {
  uLensO: number;
  uLensA: number;
  uWalkO: number;
  uWalkR: number;
  uWalkA: number;
  uChanA: number;
  uGamma: number;
  uSpread: number;
  uRingR: number;
  uRingA: number;
  uTinyR: number;
  uBeadA: number;
  uLensBlend: number;
  uFill: number;
  uLight: [number, number];
  uGlobal: number;
  uRingSh: number;
  uEdgeA: number;
};

export const uniformsAt = (frame: number): Uniforms => {
  const f = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  const r = walkR(f);
  // lens phase: two discs of radius r converge from "just touching" to
  // coincident; their intersection grows from a sliver into a full circle.
  const lensT = Math.min(1, Math.max(0, (f + 0.6) / 8.6));
  const lensEase = Math.pow(lensT, 2.0);
  const inLens = f < 9;

  const ang = -0.35 + (f / LOOP_FRAMES) * 0.7;
  const L = 0.021;

  return {
    uLensO: r * (1 - lensEase),
    uLensA: inLens ? lensA(f) : 0,
    uWalkO: inLens ? 0 : walkO(f),
    uWalkR: r,
    uWalkA: inLens ? 0 : walkA(f),
    uChanA: inLens ? 0 : chanA(f),
    uGamma: gamma(f),
    uSpread: f < 58 ? 1 : Math.max(1, (tinyR(f) + r) / SETTLED),
    uBeadA: beadA(f),
    uLensBlend: inLens ? 1 : lensBlend(f),
    uFill: fill(f),
    uRingR: ringR(f),
    uRingA: ringA(f),
    uTinyR: tinyR(f),
    uLight: [L * Math.cos(0.72 + ang), L * Math.sin(0.72 + ang)],
    uGlobal: 1,
    uRingSh: ringSh(f),
    uEdgeA: edgeA(f),
  };
};
