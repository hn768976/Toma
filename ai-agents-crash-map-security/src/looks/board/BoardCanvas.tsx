import React, { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01, easeOutCubic, range } from "../../lib/anim";
import { MONO } from "../../lib/fonts";
import { hash, mulberry32 } from "../../lib/random";
import { landDots, MapDot } from "../../lib/worldmap";
import type { BoardRow } from "../../versions";

// Layout in composition units (3840 × 2160).
export const W = 3840;
export const H = 2160;
export const CENTER = { x: 1920, y: 1080 };

// Map placement: Greenwich at x≈1950, vertically stretched like the reference.
const MAP_LON0_X = 1950;
const MAP_X_PER_DEG = 7.4;
const MAP_Y0 = 220;
const MAP_Y_PER_DEG = 13.0;
const LAT_TOP = 80;
const LAT_BOTTOM = -57;
const CELL = 12.5;
const MAP_COLS = Math.round((360 * MAP_X_PER_DEG) / CELL);
const MAP_ROWS = Math.round(((LAT_TOP - LAT_BOTTOM) * MAP_Y_PER_DEG) / CELL);

type Cell = MapDot & { x: number; y: number; block: number; appear: number; shade: number };

let cellsCache: Cell[] | null = null;
const getCells = (): Cell[] => {
  if (cellsCache) return cellsCache;
  const dots = landDots(MAP_COLS, MAP_ROWS, LAT_TOP, LAT_BOTTOM);
  cellsCache = dots.map((d) => {
    const x = MAP_LON0_X + d.lon * MAP_X_PER_DEG;
    const y = MAP_Y0 + (LAT_TOP - d.lat) * MAP_Y_PER_DEG;
    const bi = Math.floor(d.i / 8);
    const bj = Math.floor(d.j / 6);
    const block = bi * 1000 + bj;
    // glitchy assembly: blocks arrive between frames 30 and 84
    const appear = 30 + Math.floor(hash(block, 17) * 54);
    const blob =
      0.5 +
      0.25 * Math.sin(d.lon * 0.045 + 1.3) * Math.cos(d.lat * 0.06) +
      0.25 * Math.sin(d.lon * 0.11 - d.lat * 0.08);
    const shade = Math.min(1, Math.max(0, blob * 0.75 + hash(d.i, d.j, 3) * 0.3));
    return { ...d, x, y, block, appear, shade };
  });
  return cellsCache;
};

// Binary rain: two depth layers of columns (module-level seeded data).
type RainCol = { x: number; speed: number; offset: number; len: number; alpha: number; size: number };
const makeRain = (seed: number, gapMin: number, gapRnd: number, sizeMin: number, sizeRnd: number, keep: number) => {
  const r = mulberry32(seed);
  const out: RainCol[] = [];
  for (let x = 10; x < W; x += gapMin + Math.floor(r() * gapRnd)) {
    const edge = Math.abs(x - W / 2) / (W / 2);
    if (r() > keep + edge * (1 - keep)) continue;
    out.push({
      x,
      speed: 6 + r() * 12,
      offset: r() * 5000,
      len: 18 + Math.floor(r() * 40),
      alpha: 0.25 + r() * 0.55 * (0.5 + edge),
      size: sizeMin + Math.floor(r() * sizeRnd),
    });
  }
  return out;
};
const RAIN_FAR = makeRain(7331, 12, 12, 16, 7, 0.7);
const RAIN_NEAR = makeRain(9137, 70, 90, 30, 14, 0.4);

// Small square specks (mid) and big soft bokeh squares (foreground).
const SPECKS = (() => {
  const r = mulberry32(5150);
  return Array.from({ length: 150 }, () => ({
    x: r() * W,
    y: r() * H,
    s: 5 + r() * 12,
    a: 0.15 + r() * 0.5,
    p: Math.floor(r() * 90),
    red: r() < 0.08,
  }));
})();
const BOKEH = (() => {
  const r = mulberry32(6262);
  return Array.from({ length: 16 }, () => {
    const left = r() < 0.5;
    return {
      x: left ? r() * 900 : W - r() * 900,
      y: 1300 + r() * 860,
      s: 40 + r() * 70,
      a: 0.18 + r() * 0.3,
      p: Math.floor(r() * 120),
    };
  });
})();
// warm sparkle cluster, bottom centre-left
const SPARKS = (() => {
  const r = mulberry32(8484);
  return Array.from({ length: 40 }, () => ({
    x: 1140 + (r() - 0.5) * 420,
    y: 1500 + r() * 600,
    s: 4 + r() * 8,
    a: 0.3 + r() * 0.6,
    p: Math.floor(r() * 60),
  }));
})();

// Background: teal-navy haze in the upper half fading to near-black below.
// Computed in float with TPDF dither (no banding).
const bgCache = new Map<string, HTMLCanvasElement>();
const getBackground = (row: BoardRow, pw: number, ph: number, lift: number) => {
  const key = `${row.id}-${pw}x${ph}`;
  const hit = bgCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = pw;
  c.height = ph;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(pw, ph);
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const dark = hex(row.bgTop);
  const light = hex(row.bgBottom);
  const haze = [12, 60, 104];
  const r = mulberry32(pw * 7 + ph);
  for (let y = 0; y < ph; y++) {
    const v = y / (ph - 1);
    for (let x = 0; x < pw; x++) {
      const u = x / (pw - 1);
      const dx = (u - 0.5) * 1.5;
      const dy = (v - 0.32) * 1.2;
      const hz = Math.exp(-(dx * dx + dy * dy) * 2.4); // haze centred upper-middle
      const k = Math.min(1, Math.max(0, 1.15 - v * 1.25)); // lighter at the top
      const bottom = Math.pow(Math.max(0, v - 0.55) / 0.45, 1.4); // fade to black
      const side = Math.pow(Math.abs(u - 0.5) * 2, 3) * 0.35;
      const i = (y * pw + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        let val = dark[ch] * (1 - k) + light[ch] * k;
        val = (val * (1 - 0.75 * bottom) * (1 - side) + haze[ch] * hz * 0.45) * 0.62;
        val = val - lift + (r() + r() - 1);
        img.data[i + ch] = Math.max(0, Math.min(255, Math.round(val)));
      }
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bgCache.set(key, c);
  return c;
};

// Soft glow sprite with baked dither (used behind the chip and as a flare).
const glowCache = new Map<string, HTMLCanvasElement>();
const getGlow = (w: number, h: number, rgb: [number, number, number]) => {
  w = Math.max(2, Math.round(w));
  h = Math.max(2, Math.round(h));
  const key = `${w}x${h}-${rgb.join()}`;
  const hit = glowCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const r = mulberry32(w * 13 + h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x / (w - 1) - 0.5) * 2;
      const dy = (y / (h - 1) - 0.5) * 2;
      const d2 = dx * dx + dy * dy;
      const g = Math.exp(-d2 * 4.5) * (1 - Math.min(1, d2));
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++)
        img.data[i + ch] = Math.max(0, Math.min(255, Math.round(rgb[ch] * g + (r() + r() - 1))));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  glowCache.set(key, c);
  return c;
};

const drawRain = (ctx: CanvasRenderingContext2D, cols: RainCol[], frame: number, rainIn: number, seed: number) => {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let ci = 0; ci < cols.length; ci++) {
    const col = cols[ci];
    const step = col.size * 1.2;
    ctx.font = `500 ${col.size}px ${MONO}`;
    const span = H + col.len * step + 200;
    const head = (col.offset + frame * col.speed) % span;
    for (let k = 0; k < col.len; k++) {
      const y = head - k * step;
      if (y < -40 || y > H + 40) continue;
      const slot = Math.floor(y / step);
      // brighter toward the bottom of the frame, like the reference
      const lower = 0.55 + 0.6 * (y / H);
      const ch = hash(seed, ci, slot, Math.floor(frame / 5) + k) < 0.5 ? "0" : "1";
      const fade = k === 0 ? 1 : Math.pow(1 - k / col.len, 1.2) * 0.85;
      ctx.fillStyle = k === 0 ? "#D2F4FF" : k < 4 ? "#86DCFF" : "#56B4E6";
      ctx.globalAlpha = clamp01(col.alpha * fade * rainIn * lower);
      ctx.fillText(ch, col.x, slot * step + step / 2);
    }
  }
  ctx.globalAlpha = 1;
};

const prep = (c: HTMLCanvasElement, pw: number, ph: number) => {
  if (c.width !== pw) c.width = pw;
  if (c.height !== ph) c.height = ph;
  const ctx = c.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, pw, ph);
  ctx.setTransform(pw / W, 0, 0, pw / W, 0, 0);
  return ctx;
};

const layerStyle = (blurPx: number): React.CSSProperties => ({
  position: "absolute",
  left: 0,
  top: 0,
  width: W,
  height: H,
  filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
});

// Back layer: background, far rain (soft), glow behind the chip.
// Mid layer: dotted map + specks (slightly soft).  Front layer: near rain, bokeh (blurred).
export const BoardCanvas: React.FC<{ row: BoardRow; lift: number }> = ({ row, lift }) => {
  const frame = useCurrentFrame();
  const backRef = useRef<HTMLCanvasElement>(null);
  const midRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const { width } = useVideoConfig();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  const pw = Math.round(width * dpr);
  const ph = Math.round((width * dpr * H) / W);

  useLayoutEffect(() => {
    const rainIn = range(frame, 20, 80);

    // ---- back
    {
      const c = backRef.current!;
      if (c.width !== pw) c.width = pw;
      if (c.height !== ph) c.height = ph;
      const ctx = c.getContext("2d")!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.drawImage(getBackground(row, pw, ph, lift), 0, 0);
      ctx.setTransform(pw / W, 0, 0, pw / W, 0, 0);
      if (rainIn > 0) drawRain(ctx, RAIN_FAR, frame, rainIn, 1);
      const glowIn = easeOutCubic(range(frame, 92, 125));
      if (glowIn > 0) {
        const s = pw / W;
        ctx.globalCompositeOperation = "lighter";
        const pulse = 0.9 + 0.1 * Math.sin((frame / 60) * Math.PI * 2);
        ctx.globalAlpha = clamp01(glowIn * 0.55 * pulse);
        ctx.drawImage(getGlow(2400 * s, 2000 * s, [20, 150, 200]), CENTER.x - 1200, CENTER.y - 1000, 2400, 2000);
        ctx.globalAlpha = clamp01(glowIn * 0.85 * pulse);
        ctx.drawImage(getGlow(1500 * s, 90 * s, [70, 220, 255]), CENTER.x - 750, CENTER.y + 160 - 45, 1500, 90);
        ctx.drawImage(getGlow(560 * s, 34 * s, [200, 250, 255]), CENTER.x - 280, CENTER.y + 160 - 17, 560, 34);
        ctx.drawImage(getGlow(500 * s, 260 * s, [60, 200, 255]), CENTER.x - 250, CENTER.y + 90, 500, 260);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
    }

    // ---- mid: dotted map assembling as glitchy digital blocks (1s–3s)
    {
      const ctx = prep(midRef.current!, pw, ph);
      const cells = getCells();
      for (const cell of cells) {
        const t = frame - cell.appear;
        if (t < 0) continue;
        let ox = 0;
        let alpha = 1;
        let flash = 0;
        if (t < 8) {
          const g = hash(cell.block, frame, 9);
          ox = (g - 0.5) * 70 * (1 - t / 8);
          alpha = g < 0.3 ? 0.15 : 0.95;
          flash = 1 - t / 8;
        }
        const tw = 0.88 + 0.12 * Math.sin(frame * 0.07 + cell.i * 0.4 + cell.j * 0.7);
        // fade the lower map into the rain, like the reference
        const low = 1 - 0.45 * clamp01((cell.y - 1350) / 600);
        const a = (0.6 + 0.5 * cell.shade) * alpha * tw * low;
        ctx.globalAlpha = Math.min(1, a + flash * 0.5);
        ctx.fillStyle = flash > 0.3 ? "#9FE6FF" : cell.shade > 0.78 ? "#7FA9C8" : row.map;
        ctx.fillRect(cell.x - 4.5 + ox, cell.y - 4.5, 9, 9);
      }
      for (let i = 0; i < SPECKS.length; i++) {
        const sp = SPECKS[i];
        const tw = 0.5 + 0.5 * Math.sin(((frame + sp.p) / 90) * Math.PI * 2);
        ctx.globalAlpha = sp.a * tw * range(frame, 25, 70);
        ctx.fillStyle = sp.red ? "#FF5A4A" : "#7FD4FF";
        ctx.fillRect(sp.x, sp.y, sp.s, sp.s);
      }
      for (let i = 0; i < SPARKS.length; i++) {
        const sp = SPARKS[i];
        const tw = 0.5 + 0.5 * Math.sin(((frame + sp.p) / 60) * Math.PI * 2);
        ctx.globalAlpha = sp.a * tw * range(frame, 60, 100);
        ctx.fillStyle = i % 3 ? "#FF8A3A" : "#FF4A3A";
        ctx.fillRect(sp.x, sp.y, sp.s, sp.s);
      }
      ctx.globalAlpha = 1;
    }

    // ---- front: near rain and big bokeh squares (blurred by the layer)
    {
      const ctx = prep(frontRef.current!, pw, ph);
      if (rainIn > 0) drawRain(ctx, RAIN_NEAR, frame, rainIn * 0.8, 2);
      for (let i = 0; i < BOKEH.length; i++) {
        const b = BOKEH[i];
        const tw = 0.6 + 0.4 * Math.sin(((frame + b.p) / 120) * Math.PI * 2);
        ctx.globalAlpha = b.a * tw * range(frame, 25, 80);
        ctx.fillStyle = "#4FA8E0";
        ctx.fillRect(b.x, b.y, b.s, b.s);
      }
      ctx.globalAlpha = 1;
    }
  }, [frame, pw, ph, row, lift]);

  return (
    <>
      <canvas ref={backRef} style={layerStyle(2)} />
      <canvas ref={midRef} style={layerStyle(2.5)} />
      <canvas ref={frontRef} style={layerStyle(9)} />
    </>
  );
};
