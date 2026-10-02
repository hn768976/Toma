import { mulberry32 } from "../../lib/random";

/**
 * Honeycomb layout and every tile's timing, computed once at module level in
 * composition units (3840x2160). Rendering is then a pure lookup per frame.
 */
export const W = 3840;
export const H = 2160;
export const DURATION = 240;
export const ACROSS = 110;

export const PITCH = W / ACROSS; // centre-to-centre horizontally
export const RADIUS = PITCH / Math.sqrt(3); // pointy-top circumradius
export const ROW = RADIUS * 1.5;
export const TILE_SCALE = 0.86; // leaves a small gap

export const POP_FRAMES = 8;
export const VANISH_FRAMES = 9;
// Appear front: frames 6..92 (+8 pop) -> full at 100. Clear front: 130..210 (+9) -> black by 219.
const A0 = 6;
const A1 = 92;
const D0 = 130;
const D1 = 210;
const A_POW = 1.6;
const D_POW = 1.25;
const JITTER = 260;
const NOISE = 0.17;

export type Tile = {
  x: number;
  y: number;
  shade: number; // 0..1 between dark and light colour
  bright: number; // per-tile brightness multiplier
  tA: number; // first frame of pop-in
  tD: number; // first frame of vanish
  shimmerPhase: number;
  sparkles: number[]; // frames where the tile glints while settled
  early: number; // pre-front twinkle frame, or -1
  popFlash: number; // flash strength while popping in
  clearFlash: number; // flash strength while vanishing
};

const rand = mulberry32(0x4e3a11);

/** Organic front: sum of seeded harmonics in angle, roughly in [-1, 1]. */
const makeAngleNoise = () => {
  const ph = [0, 1, 2, 3, 4, 5].map(() => rand() * Math.PI * 2);
  const amp = [0, 0.55, 0.35, 0.3, 0.22, 0.15];
  return (theta: number) => {
    let s = 0;
    for (let k = 1; k <= 5; k++) s += amp[k] * Math.sin(k * theta + ph[k]);
    return s / 1.2;
  };
};
export const appearNoise = makeAngleNoise();
export const clearNoise = makeAngleNoise();

const raw: Array<{ x: number; y: number; dA: number; dD: number; base: Omit<Tile, "tA" | "tD"> }> = [];
const cols = ACROSS + 2;
const rows = Math.ceil(H / ROW) + 2;
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const x = (c - 0.5) * PITCH + (r % 2 ? PITCH / 2 : 0);
    const y = (r - 0.5) * ROW;
    const dx = x - W / 2;
    const dy = y - H / 2;
    const d = Math.hypot(dx, dy);
    const th = Math.atan2(dy, dx);
    const dA = d * (1 + NOISE * appearNoise(th)) + rand() * JITTER;
    const dD = d * (1 + NOISE * clearNoise(th)) + rand() * JITTER;
    const sparkles: number[] = [];
    for (let i = 0; i < 3; i++) if (rand() < 0.06) sparkles.push(60 + rand() * 120);
    raw.push({
      x,
      y,
      dA,
      dD,
      base: {
        x,
        y,
        shade: Math.pow(rand(), 1.3),
        bright: rand() < 0.08 ? 0.45 + rand() * 0.25 : 0.82 + rand() * 0.22,
        shimmerPhase: rand() * Math.PI * 2,
        sparkles,
        early: d < 300 && rand() < 0.1 ? 5 + rand() * 13 : -1,
        popFlash: 0.15 + 0.85 * Math.pow(rand(), 2.2),
        clearFlash: 0.35 + 0.65 * Math.pow(rand(), 1.2),
      },
    });
  }
}
export const MAX_DA = Math.max(...raw.map((t) => t.dA));
export const MAX_DD = Math.max(...raw.map((t) => t.dD));

export const TILES: Tile[] = raw.map((t) => ({
  ...t.base,
  tA: A0 + (A1 - A0) * Math.pow(t.dA / MAX_DA, 1 / A_POW),
  tD: D0 + (D1 - D0) * Math.pow(t.dD / MAX_DD, 1 / D_POW),
}));

/** Distance from centre of the appear / clear front at a given angle and frame. */
export const appearFront = (theta: number, frame: number) =>
  (MAX_DA * Math.pow(Math.min(1, Math.max(0, (frame - A0) / (A1 - A0))), A_POW) - JITTER / 2) /
  (1 + NOISE * appearNoise(theta));
export const clearFront = (theta: number, frame: number) =>
  (MAX_DD * Math.pow(Math.min(1, Math.max(0, (frame - D0) / (D1 - D0))), D_POW) - JITTER / 2) /
  (1 + NOISE * clearNoise(theta));

export type Particle = {
  phase: "appear" | "clear";
  birth: number;
  life: number;
  theta: number;
  offset: number;
  drift: number;
  size: number;
  bright: number;
};

export const PARTICLES: Particle[] = [];
for (let i = 0; i < 1100; i++) {
  const phase = i % 2 === 0 ? "appear" : "clear";
  const life = 10 + rand() * 14;
  const birth = phase === "appear" ? 10 + rand() * (96 - life - 10) : 132 + rand() * (216 - life - 132);
  PARTICLES.push({
    phase,
    birth,
    life,
    theta: rand() * Math.PI * 2,
    offset: (rand() - 0.35) * 150,
    drift: 0.6 + rand() * 2.8,
    size: 2 + Math.pow(rand(), 3) * 6,
    bright: 0.5 + rand() * 0.5,
  });
}
