// Large-wash compositions: bloom field, corner washes, graded sky, centre
// bloom, edge-bleed frame, salt wash, granulating wash, half-page wash.
import { concentrate } from "../engine/color";
import { bloom, blooms, cauliflower, drop, salt, splatter, streak } from "../engine/effects";
import { band, blob, shuffle, type Pt } from "../engine/shapes";
import type { Layout, LayoutCtx } from "./types";

const fxOf = ({ painter, rng, noise }: LayoutCtx) => ({ painter, rng, noise });

/** Jittered grid of cell centres covering (and overhanging) the sheet. */
const cells = ({ rng, W, H }: LayoutCtx, cols: number, rows: number, overhang = 0.04) => {
  const out: { x: number; y: number }[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      out.push({
        x: W * (-overhang + ((1 + 2 * overhang) * (i + 0.5 + rng.range(-0.3, 0.3))) / cols),
        y: H * (-overhang + ((1 + 2 * overhang) * (j + 0.5 + rng.range(-0.3, 0.3))) / rows),
      });
    }
  return out;
};

export const bloomField: Layout = {
  label: "BloomField",
  edge: 0.55,
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H, density } = ctx;
    const fx = fxOf(ctx);
    const grid = shuffle(rng, cells(ctx, 6, 3, 0.06).map((c, i) => ({ ...c, col: colors[i % colors.length] }))).slice(0, 16);
    // wet-in-wet base: soft, overlapping washes that merge into each other
    for (const col of colors) {
      for (const c of grid.filter((g) => g.col === col)) {
        const r = W * 0.07 * Math.pow(3, rng());
        await painter.wash(blob(rng, noise, c.x, c.y, r, r * rng.range(0.75, 1.05), { irregular: 0.38 }), concentrate(col, 0.9), {
          opacity: rng.range(55, 75),
          bleed: 0.42,
          texture: 0.6,
          border: 0.3,
          // coarse outline: p5.brush feathers it widely, as wet-in-wet spreads
          maxSeg: 120,
        });
      }
    }
    // richer pigment charged into the wet field, straddling the joins
    for (const col of colors) {
      for (let i = 0; i < Math.round(4 * density); i++) {
        await drop(fx, rng.range(0.05, 0.95) * W, rng.range(0.08, 0.92) * H, W * rng.range(0.03, 0.07), concentrate(col, 1.4), {
          opacity: 65,
          bleed: 0.45,
        });
      }
    }
    // blooms: water creeping back into the drying wash
    for (const col of colors) {
      const items = grid
        .filter((g) => g.col === col && rng.chance(0.75))
        .map((c) => ({ x: c.x + rng.gauss(0, W * 0.04), y: c.y + rng.gauss(0, H * 0.05), r: W * rng.range(0.035, 0.075) }));
      await blooms(fx, items, concentrate(col, 0.9), 0.32);
    }
  },
};

export const cornerWashes: Layout = {
  label: "CornerWashes",
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H } = ctx;
    const fx = fxOf(ctx);
    const flip = rng.chance(0.5);
    const corners = flip
      ? [
          { x: 0, y: 0, sx: 1, sy: 1 },
          { x: W, y: H, sx: -1, sy: -1 },
        ]
      : [
          { x: W, y: 0, sx: -1, sy: 1 },
          { x: 0, y: H, sx: 1, sy: -1 },
        ];
    const [a, b, c] = colors;
    const shapes = corners.map((k) => ({
      ...k,
      rx: W * rng.range(0.27, 0.34),
      ry: H * rng.range(0.42, 0.55),
    }));
    // main wash in each corner, wet-on-dry so it dries with a firm edge
    for (const s of shapes) {
      await painter.wash(blob(rng, noise, s.x - s.sx * W * 0.03, s.y - s.sy * H * 0.04, s.rx, s.ry, { irregular: 0.4, freq: 1.4 }), a, {
        opacity: 80,
        bleed: 0.14,
        texture: 0.5,
      });
    }
    // second pigment flooded in while wet
    for (const s of shapes) {
      await painter.wash(blob(rng, noise, s.x + s.sx * s.rx * 0.18, s.y + s.sy * s.ry * 0.15, s.rx * 0.55, s.ry * 0.5, { irregular: 0.4 }), b, {
        opacity: 70,
        bleed: 0.4,
        texture: 0.5,
        border: 0.3,
      });
    }
    // third pigment as drops around the edge of the wet area
    for (const s of shapes) {
      for (let i = 0; i < 3; i++) {
        const t = rng.range(0.15, 0.85) * Math.PI * 0.5;
        await drop(fx, s.x + s.sx * Math.cos(t) * s.rx * 0.72, s.y + s.sy * Math.sin(t) * s.ry * 0.72, W * rng.range(0.025, 0.05), c);
      }
    }
    // deep accent tucked into the very corner
    for (const s of shapes) {
      await drop(fx, s.x + s.sx * W * 0.02, s.y + s.sy * H * 0.03, W * rng.range(0.07, 0.1), concentrate(a, 1.9), { opacity: 75, bleed: 0.35 });
    }
    await blooms(fx, shapes.map((s) => ({ x: s.x + s.sx * s.rx * 0.5, y: s.y + s.sy * s.ry * 0.38, r: W * rng.range(0.035, 0.06) })), a, 0.35);
    // a few flicks trailing towards the clean centre
    for (const s of shapes) {
      await splatter(fx, s.x + s.sx * s.rx * 0.95, s.y + s.sy * s.ry * 0.9, W * 0.025, 24, concentrate(a, 1.2), {
        angle: Math.atan2(s.sy * H, s.sx * W),
        rMax: 12,
      });
    }
  },
};

export const gradedSky: Layout = {
  label: "GradedSky",
  edge: 0.35,
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H } = ctx;
    const fx = fxOf(ctx);
    const [a, b, c] = colors;
    const layers = 16;
    // Many thin layers of the same pigment, each reaching a little further
    // down: the overlap builds a smooth top-heavy gradient that fades out.
    for (let i = 0; i < layers; i++) {
      const t = (i + 1) / layers;
      const bottom = H * (0.05 + 0.6 * Math.pow(t, 1.5));
      await painter.wash(band(rng, noise, -160, W + 160, -120, bottom, { wobble: 18 + 30 * t, freq: 2.2 }), concentrate(a, 1.25), {
        opacity: 46,
        bleed: 0.5,
        texture: 0.45,
        border: 0.15,
        maxSeg: 400,
      });
    }
    // extra charges of pigment along the very top
    for (let i = 0; i < 7; i++) {
      const bottom = H * (0.05 + 0.2 * (i / 6));
      await painter.wash(band(rng, noise, -160, W + 160, -120, bottom, { wobble: 22, freq: 2.4 }), concentrate(a, 1.6), {
        opacity: 44,
        bleed: 0.5,
        texture: 0.45,
        border: 0.15,
        maxSeg: 400,
      });
    }
    // second pigment glazed into the top, wet into wet
    for (let i = 0; i < 6; i++) {
      const bottom = H * rng.range(0.1, 0.3);
      await painter.wash(band(rng, noise, -160, W + 160, -120, bottom, { wobble: 30, freq: 2.6 }), b, {
        opacity: 34,
        bleed: 0.5,
        texture: 0.5,
        border: 0.1,
        maxSeg: 400,
      });
    }
    // streaks dragged down through the wet gradient
    const tilt = rng.range(-0.12, 0.12);
    for (let i = 0; i < 6; i++) {
      await streak(fx, rng.range(0, W), -60, H * rng.range(0.35, 0.6), W * rng.range(0.06, 0.11), Math.PI / 2 + tilt + rng.gauss(0, 0.03), concentrate(a, 1.3), {
        opacity: 24,
        bleed: 0.5,
        texture: 0.4,
        border: 0.05,
      });
    }
    for (let i = 0; i < 3; i++) {
      await streak(fx, rng.range(0, W), -60, H * rng.range(0.25, 0.4), W * rng.range(0.05, 0.09), Math.PI / 2 + tilt + rng.gauss(0, 0.03), c, {
        opacity: 20,
        bleed: 0.5,
        texture: 0.4,
        border: 0.05,
      });
    }
  },
};

export const centreBloom: Layout = {
  label: "CentreBloom",
  edge: 1.35,
  async paint(ctx) {
    const { painter, rng, colors, W, H } = ctx;
    const fx = fxOf(ctx);
    const [a, b, c] = colors;
    const cx = W * rng.range(0.47, 0.53);
    const cy = H * rng.range(0.47, 0.53);
    const r = H * rng.range(0.3, 0.34);
    // the bloom itself: one large wash with a cauliflower edge
    await painter.wash(cauliflower(fx, cx, cy, r, { lobes: rng.int(7, 11), amp: 0.24, squash: rng.range(0.85, 1) }), a, {
      opacity: 80,
      bleed: 0.09,
      texture: 0.5,
      border: 0.8,
    });
    // second and third pigments charged into the wet centre
    for (let i = 0; i < 3; i++) {
      await drop(fx, cx + rng.gauss(0, r * 0.25), cy + rng.gauss(0, r * 0.22), r * rng.range(0.25, 0.42), b, { opacity: 60, bleed: 0.4 });
    }
    for (let i = 0; i < 2; i++) {
      await drop(fx, cx + rng.gauss(0, r * 0.3), cy + rng.gauss(0, r * 0.3), r * rng.range(0.15, 0.25), c, { opacity: 55, bleed: 0.45 });
    }
    // pigment pooled towards the rim as it dried
    for (let i = 0; i < 5; i++) {
      const t = rng.range(0, Math.PI * 2);
      await drop(fx, cx + Math.cos(t) * r * 0.78, cy + Math.sin(t) * r * 0.7, r * rng.range(0.12, 0.2), concentrate(a, 1.7), {
        opacity: 60,
        bleed: 0.3,
      });
    }
    // water dropped back in pushes the pigment outward into a ring
    await bloom(fx, cx + rng.gauss(0, r * 0.06), cy + rng.gauss(0, r * 0.06), r * rng.range(0.42, 0.52), a, 0.5);
  },
};

export const edgeFrame: Layout = {
  label: "EdgeBleedFrame",
  edge: 0.9,
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H, density } = ctx;
    const fx = fxOf(ctx);
    // points around the perimeter, slightly outside the sheet, denser at corners
    const pts: { x: number; y: number; col: string; r: number }[] = [];
    const per = Math.round(9 * density);
    const edgePoint = (side: number, t: number) => {
      const out = rng.range(0.0, 0.05);
      if (side === 0) return { x: t * W, y: -out * H };
      if (side === 1) return { x: W + out * W * 0.6, y: t * H };
      if (side === 2) return { x: (1 - t) * W, y: H + out * H };
      return { x: -out * W * 0.6, y: (1 - t) * H };
    };
    for (let side = 0; side < 4; side++) {
      const count = side % 2 === 0 ? per : Math.round(per * 0.6);
      for (let i = 0; i < count; i++) {
        const t = (i + rng.range(0.1, 0.9)) / count;
        const p = edgePoint(side, t);
        pts.push({ ...p, col: colors[(i + side) % colors.length], r: H * rng.range(0.13, 0.2) });
      }
    }
    for (const [x, y] of [
      [0, 0],
      [W, 0],
      [W, H],
      [0, H],
    ]) {
      pts.push({ x, y, col: rng.pick(colors), r: H * rng.range(0.24, 0.3) });
    }
    for (const col of colors) {
      for (const p of pts.filter((q) => q.col === col)) {
        await painter.wash(blob(rng, noise, p.x, p.y, p.r * rng.range(1, 1.5), p.r, { irregular: 0.35, rot: rng.range(0, 6.3) }), col, {
          opacity: rng.range(60, 80),
          bleed: 0.4,
          texture: 0.55,
          border: 0.3,
        });
      }
    }
    // deeper pigment right at the edges, bleeding inward
    for (const col of colors.slice(0, 2)) {
      for (let i = 0; i < Math.round(6 * density); i++) {
        const p = edgePoint(rng.int(0, 4), rng());
        await drop(fx, p.x, p.y, H * rng.range(0.06, 0.11), concentrate(col, 1.6), { opacity: 65, bleed: 0.42 });
      }
    }
    for (const col of colors) {
      const items = [0, 1].map(() => {
        const p = edgePoint(rng.int(0, 4), rng.range(0.1, 0.9));
        return { x: p.x + (W / 2 - p.x) * 0.12, y: p.y + (H / 2 - p.y) * 0.12, r: H * rng.range(0.04, 0.07) };
      });
      await blooms(fx, items, col, 0.35);
    }
  },
};

export const saltTexture: Layout = {
  label: "SaltTexture",
  edge: 0.8,
  granulationBoost: 1.3,
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H, density } = ctx;
    const fx = fxOf(ctx);
    const [a, b, c] = colors;
    const deepA = concentrate(a, 1.2);
    // the deep wash: most of the sheet, ragged edge leaving paper on one side
    const right = rng.chance(0.5);
    const edgeX = right ? W * rng.range(0.76, 0.84) : W * rng.range(0.16, 0.24);
    const pts: Pt[] = [];
    const o = rng.range(0, 100);
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const y = -80 + ((H + 160) * i) / steps;
      pts.push([edgeX + 120 * noise.fbm(o + i * 0.08, 1, 3) * 2, y]);
    }
    const far = right ? -150 : W + 150;
    const poly: Pt[] = right ? [[far, H + 80], [far, -80], ...pts] : [...pts, [far, H + 80], [far, -80]];
    await painter.wash(poly, deepA, { opacity: 100, bleed: 0.18, texture: 0.5 });
    // second and third pigments flooded in
    for (let i = 0; i < 5; i++) {
      const x = right ? rng.range(0.05, 0.65) * W : rng.range(0.35, 0.95) * W;
      await drop(fx, x, rng.range(0.1, 0.9) * H, W * rng.range(0.06, 0.12), concentrate(b, 1.15), { opacity: 70, bleed: 0.45 });
    }
    for (let i = 0; i < 3; i++) {
      const x = right ? rng.range(0.05, 0.65) * W : rng.range(0.35, 0.95) * W;
      await drop(fx, x, rng.range(0.1, 0.9) * H, W * rng.range(0.05, 0.09), concentrate(c, 1.15), { opacity: 70, bleed: 0.45 });
    }
    // salt sprinkled in patches while the wash was damp
    const patches = Math.round(5 * density);
    for (let i = 0; i < patches; i++) {
      const x = right ? rng.range(0.08, 0.66) * W : rng.range(0.34, 0.92) * W;
      await salt(fx, x, rng.range(0.15, 0.85) * H, W * rng.range(0.035, 0.07), rng.int(35, 70), deepA, {
        rMin: 8,
        rMax: 46,
        paleness: 0.3,
        inside: (sx) => (right ? sx < edgeX - 160 : sx > edgeX + 160),
      });
    }
  },
};

export const granulatingWash: Layout = {
  label: "GranulatingWash",
  granulationBoost: 2.4,
  edge: 0.9,
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H } = ctx;
    const fx = fxOf(ctx);
    const [a, b] = colors;
    // a heavy wash pooled across the sheet, its edge drying in a hard line
    const cx = W * rng.range(0.42, 0.58);
    const cy = H * rng.range(0.42, 0.58);
    await painter.wash(blob(rng, noise, cx, cy, W * 0.42, H * 0.48, { irregular: 0.3, freq: 1.2 }), concentrate(a, 1.1), {
      opacity: 105,
      bleed: 0.12,
      texture: 0.6,
    });
    await painter.wash(blob(rng, noise, cx + rng.gauss(0, W * 0.05), cy + rng.gauss(0, H * 0.05), W * 0.26, H * 0.3, { irregular: 0.4 }), concentrate(a, 1.3), {
      opacity: 70,
      bleed: 0.42,
      texture: 0.6,
      border: 0.3,
    });
    for (let i = 0; i < 4; i++) {
      await drop(fx, cx + rng.gauss(0, W * 0.09), cy + rng.gauss(0, H * 0.1), W * rng.range(0.04, 0.07), concentrate(b, 1.3), { opacity: 65, bleed: 0.4 });
    }
    await bloom(fx, cx + rng.gauss(0, W * 0.15), cy + rng.gauss(0, H * 0.15), W * rng.range(0.04, 0.06), concentrate(a, 1.35), 0.5);
  },
};

export const halfPage: Layout = {
  label: "HalfPageWash",
  edge: 0.9,
  async paint(ctx) {
    const { painter, rng, noise, colors, W, H } = ctx;
    const fx = fxOf(ctx);
    const [a, b, c] = colors;
    const edgeAt = (frac: number, wob: number) => {
      const o = rng.range(0, 100);
      const pts: Pt[] = [];
      const steps = 70;
      for (let i = 0; i <= steps; i++) {
        const y = -100 + ((H + 200) * i) / steps;
        pts.push([W * frac + wob * noise.fbm(o + i * 0.07, 2, 3) * 2, y]);
      }
      return [[-200, H + 100] as Pt, [-200, -100] as Pt, ...pts];
    };
    // the main wash covers the left 40% and bleeds into the paper
    await painter.wash(edgeAt(0.36, 110), b, { opacity: 80, bleed: 0.32, texture: 0.55, border: 0.4 });
    await painter.wash(edgeAt(0.26, 90), a, { opacity: 75, bleed: 0.38, texture: 0.55, border: 0.3 });
    // feathering past the edge: wet pigment creeping into clean paper
    for (let i = 0; i < 7; i++) {
      await drop(fx, W * rng.range(0.34, 0.42), rng.range(0.03, 0.97) * H, W * rng.range(0.02, 0.045), concentrate(b, 0.8), { opacity: 55, bleed: 0.5 });
    }
    for (let i = 0; i < 4; i++) {
      await drop(fx, W * rng.range(0.02, 0.22), rng.range(0.05, 0.95) * H, W * rng.range(0.04, 0.08), concentrate(a, 1.7), { opacity: 65, bleed: 0.42 });
    }
    for (let i = 0; i < 3; i++) {
      await drop(fx, W * rng.range(0.1, 0.3), rng.range(0.1, 0.9) * H, W * rng.range(0.03, 0.06), c, { opacity: 60, bleed: 0.45 });
    }
    await blooms(fx, [0, 1].map(() => ({ x: W * rng.range(0.12, 0.3), y: rng.range(0.15, 0.85) * H, r: W * rng.range(0.03, 0.05) })), b, 0.4);
  },
};
