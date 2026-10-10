import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { loopFrame, TAU } from "../lib/loop";
import { mulberry32 } from "../lib/random";

export const candleSchema = z.object({
  bgTop: z.string(),
  bgBottom: z.string(),
  candle: z.string(),
  candleHi: z.string(),
  band: z.string(),
  glint: z.string(),
});
export type CandleProps = z.infer<typeof candleSchema>;

// Everything is laid out in 4K design pixels and scaled by k = canvasH / 2160.
const ANGLE = (25 * Math.PI) / 180; // chart slope (rises to the right)
const SLOPE = Math.tan(ANGLE);

type LayerDef = {
  seed: number;
  period: number; // design px along x for one period; the layer scrolls exactly one period per loop
  spacing: number;
  width: number;
  blur: number;
  glow: number;
  opacity: number;
  noise: number; // random-walk wobble in design px
  offsetY: number; // vertical offset of this layer's trend line at the frame centre
};

const LAYERS: Record<"far" | "main" | "near", LayerDef> = {
  far: { seed: 11, period: 1600, spacing: 80, width: 48, blur: 10, glow: 0, opacity: 0.4, noise: 190, offsetY: -520 },
  main: { seed: 23, period: 3200, spacing: 64, width: 36, blur: 0, glow: 10, opacity: 0.9, noise: 150, offsetY: 160 },
  near: { seed: 37, period: 5120, spacing: 160, width: 100, blur: 4, glow: 0, opacity: 0.38, noise: 420, offsetY: 900 },
};

type Candle = { x: number; open: number; close: number; high: number; low: number };

// One period of candles. The walk is constrained so the period rises exactly
// period * SLOPE, which makes the tiles join seamlessly.
const buildCandles = (L: LayerDef): Candle[] => {
  const rng = mulberry32(L.seed * 7919 + 1);
  const n = Math.round(L.period / L.spacing);
  const rise = L.period * SLOPE;
  let ar = 0;
  const noise: number[] = [];
  for (let i = 0; i < n; i++) {
    ar = ar * 0.15 + (rng() - 0.5) * 2;
    noise.push(ar);
  }
  const mean = noise.reduce((a, b) => a + b, 0) / n;
  const inc = noise.map((v) => rise / n + (v - mean) * L.noise * 0.6);
  const out: Candle[] = [];
  let level = 0;
  for (let i = 0; i < n; i++) {
    const open = level;
    level += inc[i];
    const close = level;
    const top = Math.max(open, close);
    const bot = Math.min(open, close);
    out.push({
      x: (i + 0.5) * (L.period / n),
      open,
      close,
      high: top + 6 + rng() * L.noise * 0.9,
      low: bot - 6 - rng() * L.noise * 0.9,
    });
  }
  return out;
};

type Tile = { canvas: HTMLCanvasElement; ox: number; oy: number; candles: Candle[] };

// Pre-render one period (blur and glow baked in) into an offscreen canvas.
// ox/oy is where the period's origin (x = 0, level = 0) sits inside the tile.
const buildTile = (L: LayerDef, k: number, colour: string, hi: string): Tile => {
  const candles = buildCandles(L);
  const rise = L.period * SLOPE;
  const lo = Math.min(...candles.map((c) => c.low));
  const hiV = Math.max(...candles.map((c) => c.high));
  const margin = 40 + L.blur * 4 + L.glow * 4 + L.width;
  const w = Math.ceil((L.period + margin * 2) * k);
  const h = Math.ceil((hiV - Math.min(lo, 0) + margin * 2) * k);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const ox = margin;
  const oy = hiV + margin; // y (design, down) of level 0
  const draw = (c: CanvasRenderingContext2D) => {
    for (const cd of candles) {
      const x = ox + cd.x;
      const yTop = oy - Math.max(cd.open, cd.close);
      const yBot = oy - Math.min(cd.open, cd.close);
      const bodyH = Math.max(yBot - yTop, 4);
      const up = cd.close >= cd.open;
      c.strokeStyle = hi;
      c.lineWidth = Math.max(2, L.width * 0.09) * k;
      c.beginPath();
      c.moveTo(x * k, (oy - cd.high) * k);
      c.lineTo(x * k, yTop * k);
      c.moveTo(x * k, (yTop + bodyH) * k);
      c.lineTo(x * k, (oy - cd.low) * k);
      c.stroke();
      const bx = (x - L.width / 2) * k;
      if (up) {
        c.fillStyle = colour;
        c.globalAlpha = 0.55;
        c.fillRect(bx, yTop * k, L.width * k, bodyH * k);
        c.globalAlpha = 1;
        c.lineWidth = Math.max(2.2, L.width * 0.1) * k;
        c.strokeRect(bx, yTop * k, L.width * k, bodyH * k);
      } else {
        c.fillStyle = colour;
        c.globalAlpha = 0.9;
        c.fillRect(bx, yTop * k, L.width * k, bodyH * k);
        c.globalAlpha = 1;
      }
    }
  };
  if (L.glow > 0) {
    ctx.filter = `blur(${L.glow * k}px)`;
    ctx.globalAlpha = 0.9;
    draw(ctx);
    ctx.globalAlpha = 1;
  }
  ctx.filter = L.blur > 0 ? `blur(${L.blur * k}px)` : "none";
  draw(ctx);
  ctx.filter = "none";
  void rise;
  return { canvas, ox: ox * k, oy: oy * k, candles };
};

// Fixed noise tiles (seeded): dither +-1/255 and grain, offset by frame % 600.
const NOISE = 256;
const buildNoise = () => {
  const rng = mulberry32(0xd17e);
  const dither = new Float32Array(NOISE * NOISE);
  const grain = new Float32Array(NOISE * NOISE);
  for (let i = 0; i < dither.length; i++) {
    dither[i] = rng() * 2 - 1;
    grain[i] = rng() + rng() - 1;
  }
  return { dither, grain };
};

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgba = (h: string, a: number) => {
  const [r, g, b] = hex(h);
  return `rgba(${r},${g},${b},${a})`;
};

const BANDS = (() => {
  const rng = mulberry32(0xba4d);
  return Array.from({ length: 6 }, (_, i) => ({
    offset: -1500 + i * 600 + (rng() - 0.5) * 300, // perpendicular offset from the frame centre
    along: (rng() - 0.5) * 2400,
    length: 2600 + rng() * 2400,
    width: 160 + rng() * 380,
    alpha: 0.08 + rng() * 0.07,
    sway: 80 + rng() * 140,
    ph: rng(),
  }));
})();

const STREAKS = (() => {
  const rng = mulberry32(0x57ea);
  return Array.from({ length: 12 }, () => ({
    offset: -1500 + Math.pow(rng(), 1.6) * 2600,
    length: 500 + rng() * 1300,
    trips: 1 + Math.floor(rng() * 2),
    ph: rng(),
    alpha: 0.25 + rng() * 0.45,
    width: 2 + rng() * 2.5,
  }));
})();

const GLINTS = (() => {
  const rng = mulberry32(0x6117);
  return Array.from({ length: 40 }, () => ({
    candle: Math.floor(rng() * Math.round(LAYERS.main.period / LAYERS.main.spacing)),
    cycles: 1 + Math.floor(rng() * 3),
    ph: rng(),
    size: 0.6 + rng() * 0.8,
  }));
})();

export const CandleChart: React.FC<{ look: CandleProps; loopCheck?: boolean }> = ({ look }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const cw = Math.round(width * dpr);
  const ch = Math.round(height * dpr);
  const k = ch / 2160;
  const [handle] = useState(() => delayRender("Building candle tiles"));

  const tiles = useMemo(
    () => ({
      far: buildTile(LAYERS.far, k, look.candle, look.candle),
      main: buildTile(LAYERS.main, k, look.candle, look.candleHi),
      near: buildTile(LAYERS.near, k, look.candle, look.candleHi),
    }),
    [k, look.candle, look.candleHi],
  );
  const noise = useMemo(buildNoise, []);

  useLayoutEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const f = loopFrame(frame);
    const t = f / 600;
    const W = 3840;
    const H = 2160;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    const g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, look.bgTop);
    g.addColorStop(1, look.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);

    // Diagonal bands: soft rotated rectangles, swaying across their axis.
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-ANGLE);
    for (const b of BANDS) {
      const off = b.offset + b.sway * Math.sin(TAU * (t + b.ph));
      const grad = ctx.createLinearGradient(0, off - b.width / 2, 0, off + b.width / 2);
      grad.addColorStop(0, rgba(look.band, 0));
      grad.addColorStop(0.03, rgba(look.band, b.alpha));
      grad.addColorStop(0.97, rgba(look.band, b.alpha));
      grad.addColorStop(1, rgba(look.band, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(b.along - b.length / 2, off - b.width / 2, b.length, b.width);
    }
    ctx.restore();

    // Candle layers, each tiled along the diagonal and scrolled exactly one
    // period per loop (up and to the right).
    const drawLayer = (L: LayerDef, tile: Tile) => {
      const rise = L.period * SLOPE;
      // Trend line passes the frame centre at offsetY; origin of copy 0:
      const s = t; // exactly one period per loop
      const x0 = W / 2 - L.period * 0.5 + s * L.period;
      const y0 = H / 2 + L.offsetY + rise * 0.5 - s * rise;
      ctx.globalAlpha = L.opacity;
      for (let c = -4; c <= 4; c++) {
        const x = (x0 + c * L.period) * k - tile.ox;
        const y = (y0 - c * rise) * k - tile.oy;
        if (x > cw || x + tile.canvas.width < 0 || y > ch || y + tile.canvas.height < 0) continue;
        ctx.drawImage(tile.canvas, Math.round(x * 4) / 4, Math.round(y * 4) / 4);
      }
      ctx.globalAlpha = 1;
      return { x0, y0, rise };
    };
    drawLayer(LAYERS.far, tiles.far);
    const main = drawLayer(LAYERS.main, tiles.main);

    // Streak lines gliding along the slope (whole trips).
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-ANGLE);
    ctx.globalCompositeOperation = "lighter";
    const trip = 6400;
    for (const st of STREAKS) {
      const pos = -trip / 2 + ((st.ph + st.trips * t) % 1) * trip;
      const grad = ctx.createLinearGradient(pos - st.length / 2, 0, pos + st.length / 2, 0);
      grad.addColorStop(0, rgba(look.candleHi, 0));
      grad.addColorStop(0.5, rgba(look.candle, st.alpha));
      grad.addColorStop(1, rgba(look.candleHi, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(pos - st.length / 2, st.offset - st.width / 2, st.length, st.width);
    }
    ctx.restore();

    drawLayer(LAYERS.near, tiles.near);

    // Glints on main-layer candle tops: same schedule in every period copy.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const gl of GLINTS) {
      const cd = tiles.main.candles[gl.candle];
      const x = (gl.ph * 0 + (t * gl.cycles + gl.ph)) % 1;
      const env = Math.pow(Math.max(0, Math.sin((Math.PI * x) / 0.2)), 2) * (x < 0.2 ? 1 : 0);
      if (env <= 0.001) continue;
      for (let c = -4; c <= 4; c++) {
        const px = (main.x0 + c * LAYERS.main.period + cd.x) * k;
        const py = (main.y0 - c * main.rise - cd.high) * k;
        if (px < -200 * k || px > cw + 200 * k || py < -200 * k || py > ch + 200 * k) continue;
        const r = 45 * gl.size * k;
        const rg = ctx.createRadialGradient(px, py, 0, px, py, r);
        rg.addColorStop(0, rgba(look.glint, 0.6 * env));
        rg.addColorStop(0.15, rgba(look.glint, 0.3 * env));
        rg.addColorStop(1, rgba(look.glint, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(px - r, py - r, 2 * r, 2 * r);
        const arm = 110 * gl.size * k;
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const lg = ctx.createLinearGradient(px - dx * arm, py - dy * arm, px + dx * arm, py + dy * arm);
          lg.addColorStop(0, rgba(look.glint, 0));
          lg.addColorStop(0.5, rgba(look.glint, 0.35 * env));
          lg.addColorStop(1, rgba(look.glint, 0));
          ctx.fillStyle = lg;
          const th = Math.max(1, 3 * k);
          if (dx) ctx.fillRect(px - arm, py - th / 2, 2 * arm, th);
          else ctx.fillRect(px - th / 2, py - arm, th, 2 * arm);
        }
      }
    }
    ctx.restore();

    // Final: fixed noise tiles offset by frame % 600 -> +-1/255 dither + grain.
    const img = ctx.getImageData(0, 0, cw, ch);
    const d = img.data;
    const ox = (f * 73) % NOISE;
    const oy = (f * 151) % NOISE;
    const gx = (f * 199 + 17) % NOISE;
    const gy = (f * 29 + 101) % NOISE;
    const grainAmp = 0.02 * 255;
    for (let y = 0; y < ch; y++) {
      const ry = ((y + oy) & (NOISE - 1)) * NOISE;
      const gry = ((y + gy) & (NOISE - 1)) * NOISE;
      let i = y * cw * 4;
      for (let x = 0; x < cw; x++, i += 4) {
        const n = noise.dither[ry + ((x + ox) & (NOISE - 1))] + noise.grain[gry + ((x + gx) & (NOISE - 1))] * grainAmp;
        d[i] += n;
        d[i + 1] += n;
        d[i + 2] += n;
      }
    }
    ctx.putImageData(img, 0, 0);
    continueRender(handle);
  }, [frame, tiles, noise, look, cw, ch, k, handle]);

  return <canvas ref={ref} width={cw} height={ch} style={{ width, height, display: "block" }} />;
};
