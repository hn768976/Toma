// Mark-making compositions: splatter and drips, loose dots, brush swatches,
// pour and drip, confetti dabs.
import { concentrate } from "../engine/color";
import { blooms, drip, drop, splatter, swatch } from "../engine/effects";
import { band, blob, shuffle } from "../engine/shapes";
import type { Layout, LayoutCtx } from "./types";

const fxOf = ({ painter, rng, noise }: LayoutCtx) => ({ painter, rng, noise });

export const splatterDrips: Layout = {
  label: "SplatterDrips",
  edge: 1.0,
  async paint(ctx) {
    const { rng, colors, W, H, density } = ctx;
    const fx = fxOf(ctx);
    const [a, b, c] = colors;
    const main = concentrate(a, 1.15);
    // flicked from a loaded brush: two or three clusters, each in one sweep
    const clusters = [
      { x: W * rng.range(0.2, 0.4), y: H * rng.range(0.25, 0.45), col: main, n: 170 },
      { x: W * rng.range(0.6, 0.82), y: H * rng.range(0.5, 0.72), col: main, n: 130 },
      { x: W * rng.range(0.45, 0.7), y: H * rng.range(0.18, 0.35), col: b, n: 90 },
      { x: W * rng.range(0.15, 0.35), y: H * rng.range(0.62, 0.8), col: c, n: 70 },
    ];
    for (const col of [main, b, c]) {
      for (const k of clusters.filter((q) => q.col === col)) {
        await splatter(fx, k.x, k.y, W * rng.range(0.05, 0.08), Math.round(k.n * density), k.col, {
          angle: rng.range(-0.6, 0.6) + (rng.chance(0.5) ? Math.PI : 0),
          flick: rng.range(0.4, 0.8),
          rMax: rng.range(20, 34),
        });
      }
      // runs: a heavy drop that slid down the tilted sheet
      const runs = col === main ? 3 : 1;
      for (let i = 0; i < runs; i++) {
        await drip(fx, W * rng.range(0.1, 0.9), H * rng.range(0.05, 0.35), H * rng.range(0.25, 0.55), rng.range(24, 42), col, {
          opacity: 115,
        });
      }
    }
  },
};

export const looseDots: Layout = {
  label: "LooseDots",
  edge: 1.1,
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H } = ctx;
    const fx = fxOf(ctx);
    const cols = rng.int(9, 11);
    const rows = 5;
    const sx = W / (cols + 0.4);
    const sy = H / (rows + 0.35);
    type Dot = { x: number; y: number; r: number; col: string; k: number };
    const dots: Dot[] = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        if (rng.chance(0.08)) continue;
        dots.push({
          x: sx * (i + 0.7 + rng.range(-0.16, 0.16)) + (j % 2) * sx * rng.range(0, 0.2),
          y: sy * (j + 0.68 + rng.range(-0.16, 0.16)),
          r: sx * rng.range(0.17, 0.33),
          col: rng.pick(colors),
          k: rng.pick([0.8, 1.1, 1.45]),
        });
      }
    // grouped by colour and strength: each distinct colour is one blend pass
    for (const key of [...new Set(dots.map((d) => `${d.col}/${d.k}`))]) {
      for (const d of dots.filter((q) => `${q.col}/${q.k}` === key)) {
        await painter.wash(blob(rng, noise, d.x, d.y, d.r, d.r * rng.range(0.85, 1.05), { n: 90, irregular: rng.range(0.1, 0.2), freq: 1.3 }), concentrate(d.col, d.k), {
          opacity: rng.range(80, 105),
          bleed: rng.range(0.07, 0.16),
          texture: 0.35,
          border: 0.7,
        });
      }
    }
    // some dots get a second touch of pigment while still wet
    const touched = shuffle(rng, [...dots]).slice(0, Math.round(dots.length * 0.3)).map((d) => ({ d, other: rng.pick(colors) }));
    for (const other of colors) {
      for (const { d } of touched.filter((q) => q.other === other)) {
        await drop(fx, d.x + rng.gauss(0, d.r * 0.25), d.y + rng.gauss(0, d.r * 0.25), d.r * rng.range(0.35, 0.55), concentrate(other, 1.2), {
          opacity: 60,
          bleed: 0.25,
        });
      }
    }
  },
};

export const brushSwatches: Layout = {
  label: "BrushSwatches",
  edge: 1.05,
  async paint(ctx) {
    const { rng, colors, W, H } = ctx;
    const fx = fxOf(ctx);
    // paint samples in loose rows: each pigment at full strength, as a tint
    // and as a deep accent, the way a painter tests a palette
    const variants = colors.flatMap((c) => [concentrate(c, 1.0), concentrate(c, 0.55), concentrate(c, 1.75)]);
    shuffle(rng, variants);
    const rows = 3;
    const perRow = 3;
    const items: { x: number; y: number; len: number; w: number; a: number; col: string }[] = [];
    let v = 0;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < perRow; i++) {
        if (v >= variants.length) break;
        const len = W * rng.range(0.2, 0.27);
        items.push({
          x: W * (0.06 + i * 0.31 + rng.range(-0.015, 0.025)),
          y: H * (0.2 + j * 0.3 + rng.range(-0.03, 0.03)),
          len,
          w: H * rng.range(0.11, 0.15),
          a: rng.gauss(0, 0.04),
          col: variants[v++],
        });
      }
    }
    for (const col of variants) {
      for (const it of items.filter((q) => q.col === col)) {
        await swatch(fx, it.x, it.y, it.len, it.w, it.a, it.col, { dry: rng.range(0.4, 0.9) });
      }
    }
  },
};

export const pourDrip: Layout = {
  label: "PourDrip",
  edge: 1.0,
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H, density } = ctx;
    const fx = fxOf(ctx);
    const [a, b, c] = colors;
    // the pour: heavy pigment pooled along the top, colours running together
    await painter.wash(band(rng, noise, -150, W + 150, -120, H * 0.16, { wobble: 45, freq: 4 }), a, { opacity: 100, bleed: 0.18, texture: 0.5 });
    for (const col of [b, c]) {
      for (let i = 0; i < 4; i++) {
        await drop(fx, rng.range(0, W), H * rng.range(0.02, 0.12), W * rng.range(0.05, 0.09), col, { opacity: 75, bleed: 0.4 });
      }
    }
    await painter.wash(band(rng, noise, -150, W + 150, -120, H * 0.07, { wobble: 30, freq: 5 }), concentrate(a, 1.6), { opacity: 70, bleed: 0.35, texture: 0.5 });
    // streams running from the pooled edge down the tilted sheet
    const streams = Math.round(rng.int(10, 15) * density);
    const xs = Array.from({ length: streams }, (_, i) => W * ((i + 0.5 + rng.range(-0.35, 0.35)) / streams));
    const colorOf = (i: number) => (i % 3 === 0 ? b : i % 4 === 1 ? c : a);
    for (const col of [a, b, c]) {
      for (let i = 0; i < streams; i++) {
        if (colorOf(i) !== col) continue;
        await drip(fx, xs[i], H * rng.range(0.1, 0.16), H * rng.range(0.25, 0.78), rng.range(28, 58), col, { opacity: 110, pool: false });
      }
    }
  },
};

export const confettiDabs: Layout = {
  label: "ConfettiDabs",
  edge: 1.1,
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H, density } = ctx;
    const count = Math.round(130 * density);
    type Dab = { x: number; y: number; r: number; col: string };
    const dabs: Dab[] = [];
    let guard = 0;
    while (dabs.length < count && guard++ < 20000) {
      const r = 9 * Math.pow(45 / 9, rng());
      const x = rng.range(0.02, 0.98) * W;
      const y = rng.range(0.03, 0.97) * H;
      if (dabs.some((d) => Math.hypot(d.x - x, d.y - y) < (d.r + r) * 1.9)) continue;
      dabs.push({ x, y, r, col: concentrate(rng.pick(colors), rng.pick([1.0, 1.45])) });
    }
    // grouped by colour: each distinct colour costs p5.brush one blend pass
    for (const col of [...new Set(dabs.map((d) => d.col))]) {
      for (const d of dabs.filter((q) => q.col === col)) {
        // a single touch of a round brush: an uneven oval
        await painter.wash(
          blob(rng, noise, d.x, d.y, d.r * rng.range(1.0, 1.45), d.r, { n: 48, irregular: 0.2, freq: 1.4 }),
          col,
          { opacity: rng.range(85, 115), bleed: rng.range(0.05, 0.12), texture: 0.15, border: 0.7 },
        );
      }
    }
    // a few dabs touched while wet bloom slightly
    const fx = fxOf(ctx);
    const touched = shuffle(rng, [...dabs]).slice(0, 6);
    for (const col of [...new Set(touched.map((d) => d.col))]) {
      await blooms(fx, touched.filter((d) => d.col === col).map((d) => ({ x: d.x, y: d.y, r: d.r * 0.5 })), col, 0.45);
    }
  },
};
