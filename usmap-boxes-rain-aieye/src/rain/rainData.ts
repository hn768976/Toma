import { mulberry32 } from "../lib/random";

// Rain-stage layout, in 4K logical pixels. Built once at module load from a fixed seed.
export const W = 3840;
export const H = 2160;
export const LOOP = 600;
export const POOL = { cx: 1920, cy: 0.82 * H, rx: 0.375 * W, ry: 120 };
export const RAIN_COUNT = 55000;
export const SPARKLE_COUNT = 15000;
export const SPILL_COUNT = 1800;
export const FLOOR_GLINTS = 380;

export interface Band { x: number; w: number; s: number }

const rng = mulberry32(0x7a1e5);

// 9 soft vertical bands, brighter centre-left.
export const BANDS: Band[] = (() => {
  const bands: Band[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const x = W * (0.1 + (0.8 * (i + 0.2 + 0.6 * rng())) / n);
    const w = 55 + 110 * rng();
    const bias = Math.exp(-Math.pow((x - W * 0.5) / (W * 0.26), 2));
    const s = (0.5 + 0.5 * rng()) * (0.45 + 0.8 * bias);
    bands.push({ x, w, s });
  }
  return bands;
})();

export const density = (x: number) => {
  let d = 0.45 * Math.exp(-Math.pow((x - W * 0.5) / (W * 0.32), 2)) + 0.12;
  for (const b of BANDS) d += b.s * Math.exp(-Math.pow((x - b.x) / b.w, 2) / 2);
  return d;
};

const maxDensity = (() => {
  let m = 0;
  for (let x = 0; x < W; x += 2) m = Math.max(m, density(x));
  return m;
})();

// Top edge of the pool ellipse at x (or the floor line outside it).
export const poolTop = (x: number) => {
  const u = (x - POOL.cx) / POOL.rx;
  return Math.abs(u) < 1 ? POOL.cy - POOL.ry * Math.sqrt(1 - u * u) : POOL.cy;
};
const poolHalf = (x: number) => {
  const u = (x - POOL.cx) / POOL.rx;
  return Math.abs(u) < 1 ? POOL.ry * Math.sqrt(1 - u * u) : 20;
};

export interface Drop {
  x: number; y0: number; land: number; len: number; falls: number; phase: number;
  alpha: number; mix: number;
}

export const DROPS: Drop[] = (() => {
  const out: Drop[] = [];
  while (out.length < RAIN_COUNT) {
    const x = rng() * W;
    if (rng() * maxDensity > density(x)) continue;
    const land = poolTop(x) + 2 * poolHalf(x) * Math.pow(rng(), 1.4);
    const falls = 2 + Math.floor(rng() * 5); // 2..6 whole falls per loop
    const bandness = density(x) / maxDensity;
    out.push({
      x,
      y0: -80,
      land,
      len: 6 + 20 * Math.pow(rng(), 1.5) * (0.5 + 0.1 * falls),
      falls,
      phase: rng(),
      alpha: Math.min(1, (0.2 + 0.55 * Math.pow(rng(), 1.8)) * (0.45 + 0.7 * bandness)),
      mix: rng(),
    });
  }
  return out;
})();

export interface Sparkle {
  x: number; y: number; size: number; alpha: number; k: number; phase: number; glint: boolean; mix: number;
}

export const SPARKLES: Sparkle[] = (() => {
  const out: Sparkle[] = [];
  const total = SPARKLE_COUNT + SPILL_COUNT + FLOOR_GLINTS;
  for (let i = 0; i < total; i++) {
    if (i >= SPARKLE_COUNT + SPILL_COUNT) {
      // Sparse, larger star glints scattered over the floor in front of the pool.
      out.push({
        x: W * (0.06 + 0.88 * rng()), y: POOL.cy + POOL.ry * 0.7 + Math.pow(rng(), 1.6) * (H * 0.93 - POOL.cy - POOL.ry * 0.7),
        size: 26 + 30 * rng(), alpha: 0.6 + 0.4 * rng(), k: 2 + Math.floor(rng() * 6),
        phase: rng(), glint: true, mix: rng(),
      });
      continue;
    }
    const spill = i >= SPARKLE_COUNT;
    const th = rng() * Math.PI * 2;
    // Denser in the centre.
    const r = spill ? 1 + 0.45 * Math.pow(rng(), 0.7) : Math.pow(rng(), 0.6);
    const x = POOL.cx + POOL.rx * r * Math.cos(th);
    const y = POOL.cy + POOL.ry * 1.25 * r * Math.sin(th) + (spill ? 60 * rng() : 0);
    const glint = !spill && rng() < 0.025;
    out.push({
      x, y,
      size: glint ? 22 + 26 * rng() : 3 + 7 * Math.pow(rng(), 2.2),
      alpha: (spill ? 0.35 : 0.4 + 0.4 * rng()) * (0.5 + 0.4 * (1 - Math.min(1, r))),
      k: 2 + Math.floor(rng() * 9), // whole twinkle cycles per loop
      phase: rng(),
      glint,
      mix: rng(),
    });
  }
  return out;
})();
