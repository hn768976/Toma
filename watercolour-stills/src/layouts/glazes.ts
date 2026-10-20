// Banded and glazed compositions: horizontal bands, layered glazes, marbled
// wet blend, abstract horizon, diagonal sweep.
import { concentrate } from "../engine/color";
import { bloom, drop, streak } from "../engine/effects";
import { band, blob, flowPath, ribbon, shuffle, wander } from "../engine/shapes";
import type { Layout, LayoutCtx } from "./types";

const fxOf = ({ painter, rng, noise }: LayoutCtx) => ({ painter, rng, noise });

export const horizontalBands: Layout = {
  label: "HorizontalBands",
  edge: 0.8,
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H } = ctx;
    const fx = fxOf(ctx);
    const n = colors.length > 3 ? 4 : rng.int(3, 5);
    // with more pigments than bands, keep a spread of the palette in order
    const cols = colors.length > n ? Array.from({ length: n }, (_, i) => colors[Math.round((i * (colors.length - 1)) / (n - 1))]) : colors.slice(0, n).concat(n > colors.length ? [concentrate(colors[0], 1.6)] : []);
    const top = H * rng.range(0.08, 0.14);
    const bottom = H * rng.range(0.86, 0.92);
    const gapTotal = (bottom - top) * rng.range(0.12, 0.22);
    const thick = (bottom - top - gapTotal) / n;
    let y = top;
    const bands: { y0: number; y1: number; col: string }[] = [];
    for (let i = 0; i < n; i++) {
      const t = thick * rng.range(0.82, 1.18);
      bands.push({ y0: y, y1: y + t, col: cols[i] });
      // some neighbours touch and bleed into each other, others leave a paper gap
      y += t + (rng.chance(0.35) ? -t * 0.06 : (gapTotal / Math.max(1, n - 1)) * rng.range(0.6, 1.4));
    }
    for (const b of bands) {
      await painter.wash(band(rng, noise, -180, W + 180, b.y0, b.y1, { wobble: rng.range(22, 40), freq: rng.range(2.5, 4.5) }), b.col, {
        opacity: rng.range(70, 85),
        bleed: rng.range(0.22, 0.32),
        texture: 0.5,
        border: 0.4,
      });
      // pigment variation along the band, still wet
      for (let i = 0; i < 4; i++) {
        await drop(fx, rng.range(0, W), rng.range(b.y0, b.y1), (b.y1 - b.y0) * rng.range(0.35, 0.6), concentrate(b.col, 1.4), {
          opacity: 55,
          bleed: 0.45,
        });
      }
    }
  },
};

export const layeredGlazes: Layout = {
  label: "LayeredGlazes",
  edge: 1.2,
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H, density } = ctx;
    // transparent shapes laid in two rounds, each dried before the next, so
    // every overlap shows the glazes multiplying
    const rounds = 2;
    const perColour = Math.max(2, Math.round(2 * density));
    for (let r = 0; r < rounds; r++) {
      for (const col of shuffle(rng, [...colors])) {
        for (let i = 0; i < perColour; i++) {
          const rx = W * rng.range(0.07, 0.15);
          await painter.wash(
            blob(rng, noise, W * rng.range(0.16, 0.84), H * rng.range(0.2, 0.8), rx, rx * rng.range(0.6, 1.0), { irregular: 0.32, freq: 1.4 }),
            col,
            { opacity: rng.range(55, 70), bleed: rng.range(0.08, 0.13), texture: 0.35, border: 0.6 },
          );
        }
      }
    }
  },
};

export const marbledBlend: Layout = {
  label: "MarbledBlend",
  edge: 0.55,
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H, density } = ctx;
    const fx = fxOf(ctx);
    const cols = colors.slice(0, 3);
    const base = rng.range(-0.4, 0.4);
    const scale = rng.range(700, 1000);
    // swirled ribbons following one flow field, colours alternating, all wet
    // so they feather into each other where they meet
    const ribbons = Math.round(20 * density);
    for (let round = 0; round < 2; round++) {
      for (let ci = 0; ci < cols.length; ci++) {
        for (let i = 0; i < Math.ceil(ribbons / (cols.length * 2)); i++) {
          const path = flowPath(noise, rng.range(-0.1, 0.9) * W, rng.range(0.05, 0.95) * H, W * rng.range(0.6, 1.2), 22, { angle: base, swirl: 2.6, scale });
          const w = H * rng.range(0.11, 0.2);
          const o = rng.range(0, 50);
          await painter.wash(ribbon(path, (t) => w * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.03))) * (0.75 + 0.25 * noise.n2(o + t * 4, 3))), concentrate(cols[ci], round === 0 ? 0.95 : 1.3), {
            opacity: rng.range(55, 72),
            bleed: 0.42,
            texture: 0.45,
            border: 0.25,
          });
        }
      }
    }
    // a few drops and a bloom where the wet colours collided
    for (const col of cols) {
      await drop(fx, rng.range(0.1, 0.9) * W, rng.range(0.15, 0.85) * H, W * rng.range(0.03, 0.06), concentrate(col, 1.4), { opacity: 55 });
    }
    await bloom(fx, rng.range(0.2, 0.8) * W, rng.range(0.2, 0.8) * H, W * 0.04, cols[0], 0.45);
  },
};

export const abstractHorizon: Layout = {
  label: "AbstractHorizon",
  edge: 0.7,
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H } = ctx;
    const fx = fxOf(ctx);
    const [a, b, c] = colors;
    // pale sky, graded so the top of the sheet stays almost clean
    for (let i = 0; i < 6; i++) {
      const y0 = H * (0.42 - i * 0.05) - 40;
      await painter.wash(band(rng, noise, -160, W + 160, y0, H * 0.62, { wobble: 30, freq: 2 }), concentrate(c, 0.45), {
        opacity: 30,
        bleed: 0.5,
        texture: 0.4,
        border: 0.1,
      });
    }
    // receding bands: paler and cooler behind, deeper in front
    const layers = [
      { y: 0.5, k: 0.55, col: b, wob: 55, bleed: 0.4 },
      { y: 0.6, k: 0.85, col: a, wob: 45, bleed: 0.3 },
      { y: 0.71, k: 1.15, col: b, wob: 35, bleed: 0.18 },
      { y: 0.82, k: 1.55, col: a, wob: 30, bleed: 0.14 },
    ];
    for (const l of layers) {
      const y = H * (l.y + rng.range(-0.025, 0.025));
      await painter.wash(band(rng, noise, -180, W + 180, y, H + 120, { wobble: l.wob, freq: rng.range(1.4, 2.6), n: 40 }), concentrate(l.col, l.k), {
        opacity: 62,
        bleed: l.bleed,
        texture: 0.5,
        border: 0.45,
      });
    }
    // a soft glow of the third pigment where sky meets land
    for (let i = 0; i < 3; i++) {
      await drop(fx, rng.range(0.1, 0.9) * W, H * rng.range(0.47, 0.55), W * rng.range(0.06, 0.1), concentrate(c, 0.9), { opacity: 40, bleed: 0.5 });
    }
  },
};

export const diagonalSweep: Layout = {
  label: "DiagonalSweep",
  edge: 0.95,
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H } = ctx;
    const fx = fxOf(ctx);
    const [a, b] = colors;
    const up = rng.chance(0.5);
    const x0 = -W * 0.08;
    const y0 = up ? H * rng.range(0.85, 1.0) : H * rng.range(0.0, 0.15);
    const x1 = W * 1.08;
    const y1 = up ? H * rng.range(0.0, 0.15) : H * rng.range(0.85, 1.0);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const path = wander(rng, noise, x0, y0, ang, len, 40, 0.12);
    const w = H * rng.range(0.3, 0.36);
    const o = rng.range(0, 100);
    // one broad pass of a loaded flat brush
    await painter.wash(ribbon(path, (t) => w * 0.5 * (0.85 + 0.25 * noise.fbm(o + t * 5, 1, 3) * 2)), a, { opacity: 85, bleed: 0.16, texture: 0.55 });
    // second pigment worked in wet along one side, deep accent along the other
    await painter.wash(ribbon(path.map(([x, y]) => [x - Math.sin(ang) * w * 0.15, y + Math.cos(ang) * w * 0.15]), (t) => w * 0.22 * (0.7 + 0.3 * noise.n2(o + t * 7, 4))), b, {
      opacity: 60,
      bleed: 0.4,
      texture: 0.5,
      border: 0.3,
    });
    // ragged, broken edges: the brush skipping over the tooth along both sides
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const t = rng.range(0.02, 0.98);
        const idx = Math.floor(t * (path.length - 1));
        const [px, py] = path[idx];
        const off = side * w * rng.range(0.42, 0.56);
        await streak(fx, px - Math.sin(ang) * off - Math.cos(ang) * 60, py + Math.cos(ang) * off - Math.sin(ang) * 60, W * rng.range(0.05, 0.1), w * rng.range(0.07, 0.13), ang + rng.gauss(0, 0.03), a, {
          opacity: 70,
          bleed: 0.14,
          texture: 0.2,
          border: 0.5,
        });
      }
    }
    for (let i = 0; i < 4; i++) {
      const t = rng.range(0.1, 0.9);
      const [px, py] = path[Math.floor(t * (path.length - 1))];
      await drop(fx, px + Math.sin(ang) * w * 0.25, py - Math.cos(ang) * w * 0.25, w * rng.range(0.15, 0.25), concentrate(a, 1.7), { opacity: 60, bleed: 0.35 });
    }
    // a few stray marks off the brush
    await blobScatter(ctx, path, ang, w, a);
  },
};

const blobScatter = async (ctx: LayoutCtx, path: [number, number][], ang: number, w: number, col: string) => {
  const { painter, rng, noise } = ctx;
  for (let i = 0; i < 10; i++) {
    const [px, py] = path[Math.floor(rng.range(0.05, 0.95) * (path.length - 1))];
    const off = (rng.chance(0.5) ? 1 : -1) * w * rng.range(0.6, 0.9);
    const r = rng.range(3, 12);
    await painter.wash(blob(rng, noise, px - Math.sin(ang) * off, py + Math.cos(ang) * off, r * 1.4, r, { n: 20, irregular: 0.1, rot: ang }), col, {
      opacity: 100,
      bleed: 0.05,
      texture: 0,
    });
  }
};
