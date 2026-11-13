import { makeCurve } from "./util";

export const FOV = 35;

export type CameraPath = "reference";

// Keyframes: the camera starts low between the tiles, then cranes up and
// back with a gentle yaw until it looks straight down on the whole field.
//            t     dist  pitch  yaw   targetX targetZ
const KEYS = [
  [0.0, 9.6, 21, 0, 0, 0.0],
  [1.2, 10.6, 30, -9, 0.6, -1.0],
  [2.4, 14.0, 41, 17, 1.5, -2.5],
  [3.8, 21.0, 46, 21, 2.0, -4.0],
  [5.0, 43.0, 46, 10, 1.0, -6.0],
  [6.4, 75.0, 48, 1, 0.0, -8.0],
  [7.6, 129.0, 72, 0, 0.0, -6.0],
  [8.8, 154.0, 87, 0, 0.0, -4.0],
  [10.4, 172.0, 89.4, 0, 0.0, -3.0],
  [12.0, 185.0, 89.6, 0, 0.0, -2.0],
  [14.0, 190.0, 89.7, 0, 0.0, -1.5],
  [16.1, 193.0, 89.8, 0, 0.0, -1.0],
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
