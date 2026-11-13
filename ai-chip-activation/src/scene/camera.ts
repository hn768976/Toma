import { makeCurve } from "./util";

export const FOV = 30;
export type CameraPathName = "reference" | "orbit";

// Keyframes: t, yaw (deg, 0 = straight in front), pitch (deg above the
// board), distance, look-at height, roll (deg)
const PATHS: Record<CameraPathName, number[][]> = {
  // Version 1 - like the reference: a slow three-quarter push while the
  // plate descends, a fast swing to the front on impact, then a calm drift.
  reference: [
    [0.0, -34, 27, 14.9, 0.5, 0],
    [1.6, -39, 28, 15.8, 1.5, 0],
    [2.85, -44, 30, 16.2, 1.1, 0],
    [3.4, -13, 41, 12.6, 0.3, -6],
    [3.9, -7, 47, 15.4, 0.2, -5],
    [4.9, -2, 50, 17.3, 0.2, -1],
    [8.1, 0, 52, 19.0, 0.2, 0],
  ],
  // Version 2 - alternative camera: starts high behind the chip and makes a
  // long descending orbit into a low, close hero angle from the front-right.
  orbit: [
    [0.0, 150, 58, 23.0, 0.8, 0],
    [1.6, 112, 44, 20.0, 1.6, 0],
    [2.85, 80, 27, 16.0, 1.2, 4],
    [3.5, 56, 21, 12.4, 0.5, 5],
    [4.6, 38, 22, 11.6, 0.4, 2],
    [8.1, 22, 27, 10.6, 0.35, 0],
  ],
};

export const makeCamera = (name: CameraPathName) => {
  const K = PATHS[name];
  const ts = K.map((k) => k[0]);
  const c = (i: number) =>
    makeCurve(
      ts,
      K.map((k) => k[i]),
    );
  const yawC = c(1);
  const pitchC = c(2);
  const distC = c(3);
  const tyC = c(4);
  const rollC = c(5);
  return (t: number) => {
    const yaw = (yawC(t) * Math.PI) / 180;
    const pitch = (pitchC(t) * Math.PI) / 180;
    const dist = distC(t);
    const ty = tyC(t);
    const h = Math.cos(pitch) * dist;
    return {
      px: Math.sin(yaw) * h,
      py: ty + Math.sin(pitch) * dist,
      pz: Math.cos(yaw) * h,
      ty,
      dist,
      roll: (rollC(t) * Math.PI) / 180,
    };
  };
};
