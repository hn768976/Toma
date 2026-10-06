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
export const CENTER = { x: 1920, y: 1060 };

// Map placement: Greenwich at x≈2016, vertically stretched like the reference.
const MAP_LON0_X = 1950;
const MAP_X_PER_DEG = 7.4;
const MAP_Y0 = 150;
const MAP_Y_PER_DEG = 13.2;
const LAT_TOP = 82;
const LAT_BOTTOM = -57;
const CELL = 15;
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
    const bi = Math.floor(d.i / 7);
    const bj = Math.floor(d.j / 5);
    const block = bi * 1000 + bj;
    // glitchy assembly: blocks arrive between frames 30 and 84
    const appear = 30 + Math.floor(hash(block, 17) * 54);
    // brightness field: slow blobs, brighter toward Eurasia like the reference
    const blob =
      0.5 +
      0.25 * Math.sin(d.lon * 0.045 + 1.3) * Math.cos(d.lat * 0.06) +
      0.25 * Math.sin(d.lon * 0.11 - d.lat * 0.08);
    const shade = Math.min(1, Math.max(0, blob * 0.8 + hash(d.i, d.j, 3) * 0.35));
    return { ...d, x, y, block, appear, shade };
  });
  return cellsCache;
};

// Binary rain columns (module-level seeded data).
type RainCol = { x: number; speed: number; offset: number; len: number; alpha: number; size: number };
const RAIN: RainCol[] = (() => {
  const r = mulberry32(7331);
  const out: RainCol[] = [];
  for (let x = 14; x < W; x += 22 + Math.floor(r() * 20)) {
    // denser and brighter toward the left and right edges, like the reference
    const edge = Math.abs(x - W / 2) / (W / 2);
    if (r() > 0.45 + edge * 0.55) continue;
    out.push({
      x,
      speed: 5 + r() * 9,
      offset: r() * 4000,
      len: 14 + Math.floor(r() * 34),
      alpha: 0.28 + r() * 0.6 * (0.45 + edge),
      size: 19 + Math.floor(r() * 9),
    });
  }
  return out;
})();

// Floating square specks.
const SPECKS = (() => {
  const r = mulberry32(5150);
  return Array.from({ length: 140 }, () => ({
    x: r() * W,
    y: r() * H,
    s: 5 + r() * 14,
    a: 0.15 + r() * 0.5,
    p: Math.floor(r() * 90),
    red: r() < 0.12,
  }));
})();

// Background gradient, computed in float with TPDF dither (no banding).
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
  const top = hex(row.bgTop);
  const bot = hex(row.bgBottom);
  const r = mulberry32(pw * 7 + ph);
  for (let y = 0; y < ph; y++) {
    const v = y / (ph - 1);
    for (let x = 0; x < pw; x++) {
      const u = x / (pw - 1);
      const dx = (u - 0.5) * 1.6;
      const dy = v - 0.48;
      const rad = Math.sqrt(dx * dx + dy * dy);
      const center = Math.exp(-rad * rad * 4.5);
      const vig = 1 - 0.55 * Math.min(1, Math.pow(rad, 2.2));
      const k = (1 - v) * 0.55 + v * 0.75;
      const i = (y * pw + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const base = top[ch] * (1 - k) + bot[ch] * k;
        const val = (base * (0.5 + 0.45 * center)) * vig - lift + (r() + r() - 1);
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

export const BoardCanvas: React.FC<{ row: BoardRow; lift: number }> = ({ row, lift }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const { width } = useVideoConfig();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  const pw = Math.round(width * dpr);
  const ph = Math.round((width * dpr * H) / W);

  useLayoutEffect(() => {
    const c = ref.current!;
    if (c.width !== pw) c.width = pw;
    if (c.height !== ph) c.height = ph;
    const ctx = c.getContext("2d")!;
    const s = pw / W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(getBackground(row, pw, ph, lift), 0, 0);
    ctx.setTransform(s, 0, 0, s, 0, 0);

    // ---- binary rain (fades in with the map, falls the whole time)
    const rainIn = range(frame, 20, 80);
    if (rainIn > 0) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let ci = 0; ci < RAIN.length; ci++) {
        const col = RAIN[ci];
        const step = col.size * 1.25;
        ctx.font = `500 ${col.size}px ${MONO}`;
        const span = H + col.len * step + 200;
        const head = (col.offset + frame * col.speed) % span;
        for (let k = 0; k < col.len; k++) {
          const y = head - k * step;
          if (y < -40 || y > H + 40) continue;
          const slot = Math.floor(y / step);
          const ch = hash(ci, slot, Math.floor(frame / 5) + k) < 0.5 ? "0" : "1";
          const fade = k === 0 ? 1 : Math.pow(1 - k / col.len, 1.4) * 0.8;
          ctx.fillStyle = k === 0 ? "rgba(210,245,255,1)" : k < 4 ? "rgba(120,215,255,1)" : "rgba(70,170,230,1)";
          ctx.globalAlpha = col.alpha * fade * rainIn;
          ctx.fillText(ch, col.x, slot * step + step / 2);
        }
      }
      ctx.globalAlpha = 1;
    }

    // ---- dotted map: blocks assemble with a digital glitch between 1s and 3s
    const cells = getCells();
    const mapRGB = row.map;
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
      const tw = 0.85 + 0.15 * Math.sin(frame * 0.07 + cell.i * 0.4 + cell.j * 0.7);
      const a = (0.42 + 0.5 * cell.shade) * alpha * tw;
      ctx.globalAlpha = Math.min(1, a + flash * 0.5);
      ctx.fillStyle = flash > 0.3 ? "#9FE6FF" : cell.shade > 0.8 ? "#4F9FC0" : mapRGB;
      ctx.fillRect(cell.x - 6 + ox, cell.y - 6, 12, 12);
    }
    ctx.globalAlpha = 1;

    // ---- specks
    for (let i = 0; i < SPECKS.length; i++) {
      const sp = SPECKS[i];
      const tw = 0.5 + 0.5 * Math.sin(((frame + sp.p) / 90) * Math.PI * 2);
      ctx.globalAlpha = sp.a * tw * range(frame, 25, 70);
      ctx.fillStyle = sp.red ? "#FF5A4A" : "#7FD4FF";
      ctx.fillRect(sp.x, sp.y, sp.s, sp.s);
    }
    ctx.globalAlpha = 1;

    // ---- glow and lens flare behind the chip (appear with the chip)
    const glowIn = easeOutCubic(range(frame, 92, 125));
    if (glowIn > 0) {
      ctx.globalCompositeOperation = "lighter";
      const pulse = 0.9 + 0.1 * Math.sin((frame / 60) * Math.PI * 2);
      ctx.globalAlpha = clamp01(glowIn * 0.38 * pulse);
      const g = getGlow(2600 * s, 2600 * s, [30, 120, 240]);
      ctx.drawImage(g, CENTER.x - 1300, CENTER.y - 1300, 2600, 2600);
      ctx.globalAlpha = clamp01(glowIn * 0.9 * pulse);
      const fl = getGlow(1800 * s, 80 * s, [90, 220, 255]);
      ctx.drawImage(fl, CENTER.x - 900, CENTER.y + 150 - 40, 1800, 80);
      const core = getGlow(660 * s, 28 * s, [200, 245, 255]);
      ctx.drawImage(core, CENTER.x - 330, CENTER.y + 150 - 14, 660, 28);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
  }, [frame, pw, ph, row, lift]);

  return <canvas ref={ref} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />;
};
