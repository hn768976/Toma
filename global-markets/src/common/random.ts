// Deterministic randomness only. Never Math.random().

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

// Integer hash of (x, y, z) -> [0, 1). Same formula as the GLSL grain (pcg3d).
export const hash3 = (x: number, y: number, z: number) => {
  let vx = (x * 1664525 + 1013904223) >>> 0;
  let vy = (y * 1664525 + 1013904223) >>> 0;
  let vz = (z * 1664525 + 1013904223) >>> 0;
  vx = (vx + Math.imul(vy, vz)) >>> 0;
  vy = (vy + Math.imul(vz, vx)) >>> 0;
  vz = (vz + Math.imul(vx, vy)) >>> 0;
  vx ^= vx >>> 16;
  vy ^= vy >>> 16;
  vz ^= vz >>> 16;
  vx = (vx + Math.imul(vy, vz)) >>> 0;
  return vx / 4294967296;
};

/**
 * A periodic random series of length n (index wraps), smooth-ish random walk
 * with its drift removed so element n-1 flows back into element 0.
 */
export const periodicSeries = (rand: () => number, n: number, roughness = 1) => {
  const steps: number[] = [];
  for (let i = 0; i < n; i++) steps.push((rand() - 0.5) * 2);
  const mean = steps.reduce((a, b) => a + b, 0) / n;
  const out: number[] = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    out.push(v);
    v += (steps[i] - mean) * roughness;
  }
  // add a couple of smooth integer harmonics for larger swings
  const p1 = rand() * Math.PI * 2;
  const p2 = rand() * Math.PI * 2;
  const amp = Math.sqrt(n) * 0.6;
  for (let i = 0; i < n; i++) {
    out[i] += amp * Math.sin((2 * Math.PI * i) / n + p1) + amp * 0.5 * Math.sin((4 * Math.PI * i) / n + p2);
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of out) {
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  return out.map((x) => (x - lo) / (hi - lo || 1)); // normalised 0..1
};

export const at = <T,>(arr: T[], i: number): T => arr[((i % arr.length) + arr.length) % arr.length];
