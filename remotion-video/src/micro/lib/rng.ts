// Deterministic pseudo-random numbers.
//
// Every frame of a Remotion render is drawn by a fresh component mount, so
// nothing may depend on Math.random() or on state carried between frames.
// Scenes seed one of these generators and rebuild their world from scratch
// each frame, which keeps frame N identical no matter when it is rendered.

export type Rng = () => number;

export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const range = (rng: Rng, min: number, max: number) =>
  min + rng() * (max - min);

export const pick = <T,>(rng: Rng, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

/** Random point on the unit sphere, evenly distributed. */
export const onUnitSphere = (rng: Rng): [number, number, number] => {
  const u = rng() * 2 - 1;
  const theta = rng() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - u * u));
  return [r * Math.cos(theta), r * Math.sin(theta), u];
};
