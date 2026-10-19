import type p5 from "p5";
import type * as BrushNS from "p5.brush";
import { hashString, mulberry32, range, type Rng } from "../lib/random";

type Brush = typeof BrushNS;
type Pt = [number, number];

/**
 * Watercolour layers painted ONCE with p5.brush (fixed seeds) and saved as
 * grayscale PNGs in public/layers: white = bare paper, darker = more
 * pigment. The paint is neutral black, so a colourway is just a tint
 * applied in the shader (see palettes.ts) — painted layers never need
 * repainting to add a colourway.
 */
export type PaintLayer = {
  id: string;
  width: number;
  height: number;
  paint: (p: p5, brush: Brush, rng: Rng) => void;
};

// Wobbly closed outline: radius modulated by a few seeded harmonics.
export const blob = (rng: Rng, cx: number, cy: number, r: number, wobble = 0.18, n = 64, sx = 1, sy = 1): Pt[] => {
  const harm = Array.from({ length: 5 }, (_, k) => ({
    a: (wobble / (k + 1)) * range(rng, 0.4, 1),
    f: k + 2,
    ph: rng() * Math.PI * 2,
  }));
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let rr = 1;
    for (const h of harm) rr += h.a * Math.sin(h.f * t + h.ph);
    pts.push([cx + Math.cos(t) * r * rr * sx, cy + Math.sin(t) * r * rr * sy]);
  }
  return pts;
};

const wash = (brush: Brush, pts: Pt[], opacity: number, bleed: number, texture: number, border: number) => {
  brush.noStroke();
  brush.noHatch();
  brush.fill("#000000", opacity);
  brush.fillBleed(bleed, "out");
  brush.fillTexture(texture, border);
  brush.polygon(pts);
};

// An ink drop hitting paper: a core blot, a tail thrown in the direction of
// travel, and a spray of fine satellite droplets fanning the same way.
const splat = (brush: Brush, rng: Rng, x: number, y: number, r: number, opacity: number) => {
  const dir = rng() * Math.PI * 2;
  const ux = Math.cos(dir);
  const uy = Math.sin(dir);
  wash(brush, blob(rng, x, y, r, 0.32, 28, range(rng, 0.8, 1.2), range(rng, 0.8, 1.2)), opacity, 0.12, 0.25, 0.25);
  if (r > 14 && rng() < 0.7) {
    // tail: a few shrinking drops strung out behind the blot
    const L = r * range(rng, 1.5, 3.5);
    for (let k = 1; k <= 4; k++) {
      const t = k / 4;
      wash(brush, blob(rng, x + ux * L * t, y + uy * L * t, r * (0.5 - 0.1 * k) * range(rng, 0.8, 1.1), 0.25, 16), opacity, 0.06, 0.2, 0.25);
    }
  }
  const n = Math.floor(range(rng, 3, 14));
  for (let i = 0; i < n; i++) {
    const a = dir + range(rng, -0.7, 0.7);
    const d = r * range(rng, 1.3, 5.5);
    wash(brush, blob(rng, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(2, r * range(rng, 0.04, 0.2)), 0.2, 12), opacity, 0.04, 0.15, 0.2);
  }
};

const BLOOM_SPRITE = 1600;
// A bloom sprite: one large wash plus wet-in-wet blots. Its outer edge sits
// at ~0.8 of the half-size; the shader reveals it from the centre outwards.
const bloomLayer = (i: number): PaintLayer => ({
  id: `bloom_${i}`,
  width: BLOOM_SPRITE,
  height: BLOOM_SPRITE,
  paint: (_p, brush, rng) => {
    const c = BLOOM_SPRITE / 2;
    const R = BLOOM_SPRITE * 0.36;
    wash(brush, blob(rng, c, c, R, 0.16, 72), 175, 0.22, 0.55, 0.75);
    wash(brush, blob(rng, c + range(rng, -80, 80), c + range(rng, -80, 80), R * 0.82, 0.22, 64), 110, 0.3, 0.5, 0.6);
    for (let k = 0; k < 3; k++) {
      const a = rng() * Math.PI * 2;
      const d = R * range(rng, 0.1, 0.5);
      wash(brush, blob(rng, c + Math.cos(a) * d, c + Math.sin(a) * d, R * range(rng, 0.2, 0.42), 0.3, 48), 100, 0.35, 0.6, 0.8);
    }
  },
});

// Ink reveal: four irregular strips bleeding in from the frame edges,
// darker near the edge. The clean centre is kept >= 55% of the width.
const edgeWash: PaintLayer = {
  id: "edge_wash",
  width: 3840,
  height: 2160,
  paint: (_p, brush, rng) => {
    const W = 3840;
    const H = 2160;
    const strip = (side: number, depth: number, op: number, bleed: number, border: number) => {
      const pts: Pt[] = [];
      const len = side % 2 === 0 ? W : H;
      const n = 150;
      const fingers = Array.from({ length: 6 }, (_, k) => ({
        f: range(rng, 1.2, 3) * (k + 1),
        ph: rng() * 7,
        a: range(rng, 0.08, 0.2) / (k + 1),
      }));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        let d = 1;
        for (const g of fingers) d += g.a * Math.sin(g.f * t * Math.PI * 2 + g.ph);
        const s = -200 + t * (len + 400);
        const dd = depth * Math.max(0.25, d);
        if (side === 0) pts.push([s, dd]);
        if (side === 1) pts.push([W - dd, s]);
        if (side === 2) pts.push([W - s, H - dd]);
        if (side === 3) pts.push([dd, H - s]);
      }
      const back = -260;
      if (side === 0) pts.push([W + 200, back], [-200, back]);
      if (side === 1) pts.push([W - back, H + 200], [W - back, -200]);
      if (side === 2) pts.push([-200, H - back], [W + 200, H - back]);
      if (side === 3) pts.push([back, -200], [back, H + 200]);
      wash(brush, pts, op, bleed, 0.6, border);
    };
    for (let side = 0; side < 4; side++) strip(side, side % 2 === 0 ? 400 : 560, 130, 0.25, 0.45);
    for (let side = 0; side < 4; side++) strip(side, side % 2 === 0 ? 200 : 290, 110, 0.3, 0.25);
    // pools and blots along the edges break up the bands
    for (let k = 0; k < 18; k++) {
      const side = k % 4;
      const t = range(rng, 0.05, 0.95);
      const inset = range(rng, 40, 260);
      const x = side === 0 ? t * W : side === 1 ? W - inset : side === 2 ? t * W : inset;
      const y = side === 0 ? inset : side === 1 ? t * H : side === 2 ? H - inset : t * H;
      wash(brush, blob(rng, x, y, range(rng, 150, 330), 0.28, 48), 100, 0.3, 0.6, 0.75);
    }
    for (const [x, y] of [[0, 0], [W, 0], [W, H], [0, H]] as Pt[])
      wash(brush, blob(rng, x, y, range(rng, 380, 520), 0.25), 120, 0.3, 0.6, 0.8);
  },
};

const splatters = (id: string, count: number, maxR: number, inset: number): PaintLayer => ({
  id,
  width: 3840,
  height: 2160,
  paint: (_p, brush, rng) => {
    const W = 3840;
    const H = 2160;
    let placed = 0;
    while (placed < count) {
      const x = range(rng, 20, W - 20);
      const y = range(rng, 20, H - 20);
      // keep splatters in the border band
      const edge = Math.min(x / W, 1 - x / W, (y / H) * (H / W), (1 - y / H) * (H / W));
      if (edge > inset) continue;
      const r = maxR * Math.pow(rng(), 2.2) + 4;
      splat(brush, rng, x, y, r, range(rng, 90, 160));
      placed++;
    }
  },
});

const cornerWash: PaintLayer = {
  id: "corner_wash",
  width: 3840,
  height: 2160,
  paint: (_p, brush, rng) => {
    const corners: Pt[] = [[0, 0], [3840, 0], [3840, 2160], [0, 2160]];
    for (const [x, y] of corners) {
      wash(brush, blob(rng, x, y, range(rng, 950, 1150), 0.2, 72, 1.15, 0.95), 130, 0.25, 0.55, 0.75);
      wash(brush, blob(rng, x, y, range(rng, 600, 760), 0.24, 64), 110, 0.3, 0.6, 0.8);
      wash(brush, blob(rng, x + (x ? -1 : 1) * range(rng, 300, 600), y + (y ? -1 : 1) * range(rng, 100, 300), range(rng, 160, 260), 0.3, 40), 110, 0.3, 0.6, 0.9);
    }
  },
};

export const STRIPE_CENTRES = [190, 470, 760, 1060, 1360, 1660, 1960];
const stripes: PaintLayer = {
  id: "stripes",
  width: 3840,
  height: 2160,
  paint: (_p, brush, rng) => {
    for (const cy of STRIPE_CENTRES) {
      const top: Pt[] = [];
      const bot: Pt[] = [];
      const half = range(rng, 95, 125);
      const ph = rng() * 9;
      for (let i = 0; i <= 40; i++) {
        const x = -150 + (i / 40) * 4140;
        const w = Math.sin(x * 0.0021 + ph) * 22 + Math.sin(x * 0.0057 + ph * 2) * 10;
        top.push([x, cy - half + w + range(rng, -6, 6)]);
        bot.unshift([x, cy + half + w * 0.7 + range(rng, -6, 6)]);
      }
      wash(brush, [...top, ...bot], 150, 0.18, 0.55, 0.8);
    }
  },
};

const seaWash: PaintLayer = {
  id: "sea_wash",
  width: 4096,
  height: 2048,
  paint: (_p, brush, rng) => {
    for (let k = 0; k < 14; k++) {
      const x = range(rng, 0, 4096);
      const y = range(rng, 0, 2048);
      wash(brush, blob(rng, x, y, range(rng, 600, 1100), 0.2, 56, 1.4, 0.9), 70, 0.3, 0.6, 0.55);
    }
    wash(brush, [[-300, -300], [4396, -300], [4396, 2348], [-300, 2348]], 90, 0.15, 0.5, 0.2);
  },
};

export const PAINT_LAYERS: PaintLayer[] = [
  ...Array.from({ length: 8 }, (_, i) => bloomLayer(i)),
  edgeWash,
  splatters("ink_splatter", 45, 40, 0.17),
  cornerWash,
  splatters("splatter_frame", 70, 70, 0.13),
  stripes,
  seaWash,
];

export const seedFor = (id: string) => hashString(`paint:${id}`);
export const rngFor = (id: string) => mulberry32(seedFor(id));
