import { makeCurve } from "./util";

export const FOV = 35;

export type CameraPath = "reference";

// Keyframes: the camera starts low between the tiles, then cranes up and
// back with a gentle yaw until it looks straight down on the whole field.
//            t     dist  pitch  yaw   targetX targetZ
const KEYS = [
  [0.0, 9.6, 19, 0, 0, 0.0],
  [1.2, 11.5, 29, -9, 0.6, -1.0],
  [2.4, 19.0, 40, 15, 1.5, -2.5],
  [3.4, 34.0, 45, 18, 2.0, -4.0],
  [4.4, 62.0, 46, 9, 1.0, -6.0],
  [5.6, 105.0, 53, 2, 0.0, -8.0],
  [6.6, 138.0, 76, 0, 0.0, -7.0],
  [7.6, 172.0, 86.5, 0, 0.0, -6.0],
  [8.8, 215.0, 89, 0, 0.0, -4.0],
  [10.4, 245.0, 89.4, 0, 0.0, -3.0],
  [12.0, 262.0, 89.6, 0, 0.0, -2.0],
  [14.0, 272.0, 89.7, 0, 0.0, -1.5],
  [16.1, 278.0, 89.8, 0, 0.0, -1.0],
];

const col = (i: number) => KEYS.map((k) => k[i]);
const ts = col(0);
const distC = makeCurve(ts, col(1).map((d) => Math.log(d)));
const pitchC = makeCurve(ts, col(2));
const yawC = makeCurve(ts, col(3));
const txC = makeCurve(ts, col(4));
const tzC = makeCurve(ts, col(5));

export const cameraAt = (t: number) => {
  const dist = Math.exp(distC(t));
  const pitch = (pitchC(t) * Math.PI) / 180;
  const yaw = (yawC(t) * Math.PI) / 180;
  const tx = txC(t);
  const tz = tzC(t);
  const ty = 0.45;
  const horiz = Math.cos(pitch) * dist;
  return {
    dist,
    px: tx + Math.sin(yaw) * horiz,
    py: ty + Math.sin(pitch) * dist,
    pz: tz + Math.cos(yaw) * horiz,
    tx,
    ty,
    tz,
    roll: 0,
  };
};
