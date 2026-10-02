import { mulberry32 } from "../common/random";

/** Points spread evenly over a unit sphere (Fibonacci lattice), with a little
 * seeded jitter so it reads as particles rather than a grid. Built once. */
export const SPHERE_POINTS: Array<{ x: number; y: number; z: number; size: number; tint: number }> = (() => {
  const rng = mulberry32(2279658788);
  const n = 1500;
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const shell = 1 + (rng() - 0.5) * 0.08;
    return {
      x: Math.cos(th) * r * shell,
      y: y * shell,
      z: Math.sin(th) * r * shell,
      size: 0.6 + rng() * 0.9,
      tint: rng(),
    };
  });
})();
