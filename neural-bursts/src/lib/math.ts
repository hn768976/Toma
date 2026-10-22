// Deterministic helpers shared by every scene. Nothing here may depend on
// wall-clock time or Math.random(), so each frame renders identically no
// matter which Remotion worker / tab draws it.

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = () => number;

export const range = (rng: Rng, min: number, max: number) =>
  min + (max - min) * rng();

export const gaussian = (rng: Rng) => {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export const randomUnitVector = (rng: Rng): [number, number, number] => {
  const z = rng() * 2 - 1;
  const phi = rng() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(phi), r * Math.sin(phi), z];
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInCubic = (t: number) => Math.pow(clamp01(t), 3);
export const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeInOutSine = (t: number) =>
  -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;

/**
 * Piecewise keyframe track. Each segment is eased with `easeInOutSine`
 * unless a custom easing is supplied for the segment that *ends* at a key.
 */
export type Key = { t: number; v: number; ease?: (x: number) => number };

export const track = (keys: Key[], t: number) => {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (t <= k.t) {
      const p = keys[i - 1];
      const e = k.ease ?? easeInOutSine;
      return lerp(p.v, k.v, e((t - p.t) / (k.t - p.t)));
    }
  }
  return keys[keys.length - 1].v;
};

export type RGB = [number, number, number];

export const hex = (h: string): RGB => {
  const n = parseInt(h.replace("#", ""), 16);
  // Convert sRGB hex to linear so additive blending happens in linear light.
  const toLin = (c: number) => Math.pow(c / 255, 2.2);
  return [toLin((n >> 16) & 255), toLin((n >> 8) & 255), toLin(n & 255)];
};

export const pickWeighted = <T,>(rng: Rng, items: [T, number][]): T => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r <= 0) return item;
  }
  return items[items.length - 1][0];
};
