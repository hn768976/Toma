import { track } from "./keyframes";

// 270 frames @ 30 fps. Frame numbers below were read off the reference.

// 0 = compact grooved torus ("pincushion"), 1 = fully bloomed flat flower
const bloom = track([
  [0, 0],
  [6, 0.03],
  [24, 0.42],
  [44, 0.92],
  [56, 1],
  [222, 1],
  [242, 0.6],
  [262, 0.1],
  [269, 0.02],
]);

// open-state shape keys (they keep the bloomed pattern alive in the middle)
const openTwist = track([
  [40, 1.75],
  [90, 1.95],
  [130, 1.8],
  [175, 0.7],
  [205, 0.35],
  [235, 1.35],
  [269, 1.5],
]);
const openHole = track([
  [40, 0.26],
  [80, 0.3],
  [120, 0.42],
  [160, 0.3],
  [200, 0.12],
  [235, 0.26],
  [269, 0.24],
]);
const openReach = track([
  [40, 1.8],
  [120, 1.85],
  [200, 2.0],
  [269, 1.9],
]);
const pinkAmt = track([
  [0, 1],
  [18, 1],
  [32, 0.3],
  [42, 0],
  [234, 0],
  [250, 0.6],
  [260, 1],
  [269, 1],
]);
const rot = track([
  [0, 0],
  [269, 0.55],
]);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type BloomState = {
  rt: number;
  rr: number;
  rz: number;
  twist: number;
  tubeR: number;
  rot: number;
  pinkAmt: number;
  pinkS: number;
  bloom: number;
  phi0: number;
  span: number;
  bodyK: number;
  bodySink: number;
};

export const stateAt = (frame: number): BloomState => {
  const b = bloom(frame);
  // wrapped torus
  const wRt = 0.55;
  const wRr = 0.42;
  const wRz = 0.32;
  const wTw = 0.9;
  // bloomed flower: hole radius = rt - rr, outer reach = rt + rr
  const hole = openHole(frame);
  const reach = openReach(frame);
  const oRr = (reach - hole) / 2;
  const oRt = hole + oRr;
  const oRz = 0.12;
  return {
    rt: lerp(wRt, oRt, b),
    rr: lerp(wRr, oRr, b),
    rz: lerp(wRz, oRz, b),
    twist: lerp(wTw, openTwist(frame), b),
    tubeR: lerp(0.05, 0.062, b),
    rot: rot(frame),
    pinkAmt: pinkAmt(frame),
    pinkS: lerp(0.09, 0.26, Math.min(1, b * 1.6)),
    bloom: b,
    // tube mouths sit on the inner slope when wrapped (the ring of little
    // circles) and retreat to the hole rim once the flower is open
    phi0: lerp((130 * Math.PI) / 180, (178 * Math.PI) / 180, b),
    span: lerp((310 * Math.PI) / 180, (352 * Math.PI) / 180, b),
    bodyK: Math.max(0, 1 - b / 0.7),
    bodySink: 0.25 * Math.min(1, b / 0.7),
  };
};
