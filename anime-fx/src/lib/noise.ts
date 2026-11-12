import { createNoise2D, createNoise3D, createNoise4D } from "simplex-noise";
import { mulberry32, seedOf } from "./rng";

export const makeNoise = (...keys: (string | number)[]) => {
  const s = seedOf(...keys);
  return {
    n2: createNoise2D(mulberry32(s ^ 0x1111)),
    n3: createNoise3D(mulberry32(s ^ 0x2222)),
    n4: createNoise4D(mulberry32(s ^ 0x3333)),
  };
};

// A point on the "time circle": the loop position p in [0,1) mapped to a
// circle of radius r, so noise sampled at (x, y, cx, cy) is periodic in p.
export const timeCircle = (p: number, r: number): [number, number] => {
  const a = p * Math.PI * 2;
  return [Math.cos(a) * r, Math.sin(a) * r];
};
