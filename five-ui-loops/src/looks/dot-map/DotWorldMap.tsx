// Look 4 — Dot World Map. 2D, 20 s loop, drawn on one <canvas>.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { DotMapVersion } from "../../versions";
import { COLS, LandDots, ROWS, loadLandDots } from "./landMask";
import { hash2, mulberry32 } from "../../lib/random";
import { hexToRgb } from "../../lib/color";
import { grainAt } from "../../lib/Grain";

export const MAP_LOOP = 600;
const TAU = Math.PI * 2;
const MAX_DOTS = COLS * ROWS;

// Per-dot flicker: whole number of cycles per 600 frames, seeded phase, and a
// per-dot threshold around cos(0.3π) so ~30% are bright at any moment.
const rng = mulberry32(0x4d4150);
const CYCLES = new Float32Array(MAX_DOTS);
const PHASE = new Float32Array(MAX_DOTS);
const THRESH = new Float32Array(MAX_DOTS);
const PEAK = new Float32Array(MAX_DOTS);
for (let i = 0; i < MAX_DOTS; i++) {
  CYCLES[i] = 4 + Math.floor(rng() * 25); // 4..28 cycles / 20 s
  PHASE[i] = rng() * TAU;
  THRESH[i] = 0.588 + (rng() - 0.5) * 0.18;
  PEAK[i] = 0.75 + rng() * 0.25;
}

// Scan lines: seeded x, length, alpha; each falls exactly one repeat per loop.
const SCAN_COUNT = 120;
const scanRng = mulberry32(0x5343414e);
const SCAN = Array.from({ length: SCAN_COUNT }, () => ({
  x: scanRng(),
  len: 0.15 + scanRng() * 0.55, // fraction of frame height
  alpha: 0.035 + scanRng() * 0.07,
  offset: scanRng(),
  width: scanRng() < 0.75 ? 1 : 2,
}));
// Static hairlines give the faint vertical texture behind everything.
const HAIR_COUNT = 260;
const hairRng = mulberry32(0x48414952);
const HAIR = Array.from({ length: HAIR_COUNT }, () => ({ x: hairRng(), alpha: 0.012 + hairRng() * 0.02 }));

const makeGlowSprite = (size: number, rgb: [number, number, number]) => {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  const col = (a: number) => `rgba(${rgb.map((v) => Math.round(v * 255)).join(",")},${a})`;
  grad.addColorStop(0, col(0.55));
  grad.addColorStop(0.25, col(0.22));
  grad.addColorStop(0.6, col(0.05));
  grad.addColorStop(1, col(0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
};

export const DotWorldMap: React.FC<{ version: DotMapVersion }> = ({ version }) => {
  const frame = useCurrentFrame();
  const f = frame % MAP_LOOP;
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLCanvasElement | null>(null);
  const [dots, setDots] = useState<LandDots | null>(null);
  const [handle] = useState(() => delayRender("Loading Natural Earth land mask"));

  useEffect(() => {
    loadLandDots().then((d) => {
      setDots(d);
      continueRender(handle);
    });
  }, [handle]);

  useLayoutEffect(() => {
    if (!dots) return;
    const canvas = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(width * dpr);
    const H = Math.round(height * dpr);
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    if (!layerRef.current) layerRef.current = document.createElement("canvas");
    const layer = layerRef.current;
    if (layer.width !== W) layer.width = W;
    if (layer.height !== H) layer.height = H;

    const bright = hexToRgb(version.bright);
    const dim = hexToRgb(version.dim);
    const scan = hexToRgb(version.scan);

    // Geometry
    const mapW = W * 0.94;
    const step = mapW / COLS;
    const mapH = step * ROWS;
    const x0 = (W - mapW) / 2;
    const y0 = (H - mapH) / 2 + H * 0.01;
    const dotSize = Math.max(1, Math.round(step * 0.6));

    // ── Dot layer (black background, additive) ──
    const g = layer.getContext("2d")!;
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    const levels = new Float32Array(dots.length);
    for (let i = 0; i < dots.length; i++) {
      const s = Math.sin((TAU * CYCLES[i] * f) / MAP_LOOP + PHASE[i]);
      const t = (s - (THRESH[i] - 0.1)) / 0.2;
      const k = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
      levels[i] = k * PEAK[i];
    }
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const k = levels[i];
      const r = dim[0] + (bright[0] - dim[0]) * k;
      const gg = dim[1] + (bright[1] - dim[1]) * k;
      const b = dim[2] + (bright[2] - dim[2]) * k;
      g.fillStyle = `rgb(${Math.round(r * 255)},${Math.round(gg * 255)},${Math.round(b * 255)})`;
      const cx = Math.round(x0 + (d.col + 0.5) * step - dotSize / 2);
      const cy = Math.round(y0 + (d.row + 0.5) * step - dotSize / 2);
      g.fillRect(cx, cy, dotSize, dotSize);
    }
    // Soft glow on bright dots
    const spriteSize = Math.max(4, Math.round(step * 4.2));
    const sprite = makeGlowSprite(spriteSize, bright);
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < dots.length; i++) {
      const k = levels[i];
      if (k < 0.02) continue;
      const d = dots[i];
      g.globalAlpha = k * 0.6;
      const cx = x0 + (d.col + 0.5) * step;
      const cy = y0 + (d.row + 0.5) * step;
      g.drawImage(sprite, Math.round(cx - spriteSize / 2), Math.round(cy - spriteSize / 2));
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    // ~2% grain on the map only: modulate non-black pixels, black stays black.
    const img = g.getImageData(0, 0, W, H);
    const px = img.data;
    for (let y = 0, i = 0; y < H; y++) {
      for (let x = 0; x < W; x++, i += 4) {
        if (px[i] === 0 && px[i + 1] === 0 && px[i + 2] === 0) continue;
        const n = (grainAt(x, y, f) + grainAt(x + 7919, y + 104729, f) - 1) * 0.02;
        const m = 1 + n * 2.2;
        px[i] = px[i] * m + 0.5;
        px[i + 1] = px[i + 1] * m + 0.5;
        px[i + 2] = px[i + 2] * m + 0.5;
      }
    }
    g.putImageData(img, 0, 0);

    // ── Main canvas: pure black, scan lines, then the dot layer added ──
    const ctx = canvas.getContext("2d")!;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const sc = (a: number) => `rgba(${scan.map((v) => Math.round(v * 255)).join(",")},${a})`;
    for (const h of HAIR) {
      ctx.fillStyle = sc(h.alpha);
      ctx.fillRect(Math.round(h.x * W), 0, 1, H);
    }
    for (const s of SCAN) {
      const len = s.len * H;
      const period = H + len;
      const head = (((f / MAP_LOOP + s.offset) % 1) * period) - 0; // 0..period
      const top = head - len;
      const grad = ctx.createLinearGradient(0, top, 0, head);
      grad.addColorStop(0, sc(0));
      grad.addColorStop(0.85, sc(s.alpha));
      grad.addColorStop(1, sc(s.alpha * 0.4));
      ctx.fillStyle = grad;
      ctx.fillRect(Math.round(s.x * W), Math.round(top), Math.max(1, Math.round(s.width * dpr * 1.5)), Math.round(len));
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(layer, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }, [dots, f, width, height, version]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={ref} style={{ width, height }} />
    </AbsoluteFill>
  );
};

// Exported for tests/README: fraction of bright dots at a frame.
export const brightFraction = (f: number, n: number) => {
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (Math.sin((TAU * CYCLES[i] * f) / MAP_LOOP + PHASE[i]) > THRESH[i]) c++;
  }
  return c / n;
};
void hash2;
