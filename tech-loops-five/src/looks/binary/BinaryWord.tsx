import React, { useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { hexToRgb, mixRgb, rgbStr, type RGB } from "../../lib/color";
import { MONO, MONTSERRAT } from "../../lib/fonts";
import { Grain } from "../../lib/Grain";
import { LOOP, clamp, loopSaw } from "../../lib/loop";
import { hash01, mulberry32 } from "../../lib/random";
import { canvasScale, useFrameCanvas } from "../../lib/useFrameCanvas";
import type { BinaryVersion } from "../../versions";

/**
 * Look 1 — Binary Word. Everything is drawn on one <canvas> with fillText
 * (plus a blurred glow copy). All sizes are in 4K composition pixels.
 *
 * Loop: a cell's state is hash(cell, floor((frame+off)/k) mod (600/k)) with
 * k | 600, so frame 600 reproduces frame 0 exactly. The scan band passes a
 * whole number of times (SCAN_PASSES) per loop.
 */
const DIGIT_H = 28; // digit (cap) height at 4K
const FONT_PX = DIGIT_H / 0.73; // JetBrains Mono digits are ~0.73 em tall
const CHAR_W = FONT_PX * 0.6; // monospace advance
const COL = CHAR_W * 1.2;
const ROW = DIGIT_H * 1.4;
const SCAN_PASSES = 4; // whole scans per 20 s loop
const BG_PERIODS = [20, 24, 25, 30, 40, 50, 60]; // all divide 600
const WORD_PERIODS = [4, 5, 6, 8]; // faster flicker inside the word
const SS = 6; // mask supersampling per cell

type Layout = {
  cols: number;
  rows: number;
  x0: number;
  y0: number;
  coverage: Float32Array; // 0..1 word coverage per cell (max of its two sub-rows)
  sub: Float32Array; // 0..1 coverage per half-row sub-cell (rows*2 × cols)
  near: Float32Array; // 0..1 proximity to the word (for sparkle)
  wordLeft: number;
  wordRight: number;
};

const layoutCache = new Map<string, Layout>();

/** Draw the word ONCE to an offscreen canvas (grid space) and sample per-cell coverage. */
const getLayout = (word: string, width: number, height: number): Layout => {
  const key = `${word}|${width}x${height}`;
  const hit = layoutCache.get(key);
  if (hit) return hit;
  const cols = Math.ceil(width / COL) + 1;
  const rows = Math.ceil(height / ROW) + 1;
  const x0 = (width - cols * COL) / 2;
  const y0 = (height - rows * ROW) / 2;

  const mask = document.createElement("canvas");
  mask.width = cols * SS;
  mask.height = rows * SS;
  const mctx = mask.getContext("2d", { willReadFrequently: true })!;
  // measure in 4K space
  mctx.font = `800 100px ${MONTSERRAT}`;
  const w100 = mctx.measureText(word).width;
  const fontPx = (100 * width * 0.7) / w100; // word spans 70% of frame width
  mctx.setTransform(SS / COL, 0, 0, SS / ROW, (-x0 * SS) / COL, (-y0 * SS) / ROW);
  mctx.font = `800 ${fontPx}px ${MONTSERRAT}`;
  mctx.textAlign = "center";
  mctx.textBaseline = "alphabetic";
  mctx.fillStyle = "#fff";
  const capH = fontPx * 0.7;
  mctx.fillText(word, width / 2, height / 2 + capH / 2);
  const data = mctx.getImageData(0, 0, mask.width, mask.height).data;

  // Inside the word, digits sit on a half-row sub-grid (denser, overlapping
  // into vertical streaks), so coverage is sampled per half row.
  const HS = SS / 2;
  const sub = new Float32Array(cols * rows * 2);
  const coverage = new Float32Array(cols * rows);
  for (let sr = 0; sr < rows * 2; sr++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      for (let y = 0; y < HS; y++) {
        const base = ((sr * HS + y) * mask.width + c * SS) * 4 + 3;
        for (let x = 0; x < SS; x++) sum += data[base + x * 4];
      }
      const v = sum / (HS * SS * 255);
      sub[sr * cols + c] = v;
      const ci = (sr >> 1) * cols + c;
      coverage[ci] = Math.max(coverage[ci], v);
    }
  }
  // proximity: max coverage within a small elliptical neighbourhood, falling off
  const near = new Float32Array(cols * rows);
  let minC = cols;
  let maxC = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (coverage[r * cols + c] > 0.4) {
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
      let best = 0;
      for (let dr = -3; dr <= 3; dr++) {
        for (let dc = -4; dc <= 4; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          const d = Math.sqrt((dr / 3) ** 2 + (dc / 4) ** 2);
          if (d > 1) continue;
          best = Math.max(best, coverage[rr * cols + cc] * (1 - d));
        }
      }
      near[r * cols + c] = best;
    }
  }
  const out: Layout = {
    cols,
    rows,
    x0,
    y0,
    coverage,
    sub,
    near,
    wordLeft: x0 + minC * COL,
    wordRight: x0 + (maxC + 1) * COL,
  };
  layoutCache.set(key, out);
  return out;
};

/** Faint circuit traces along the top edge, built once at module level. */
type Trace = { pts: [number, number][]; pad: boolean };
const buildTraces = (seed: number, width: number): Trace[] => {
  const rnd = mulberry32(seed * 977 + 3);
  const traces: Trace[] = [];
  let x = 20;
  while (x < width - 20) {
    const pts: [number, number][] = [[x, -4]];
    let cx = x;
    let cy = 30 + rnd() * 120;
    pts.push([cx, cy]);
    const segs = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < segs; i++) {
      const dx = (rnd() < 0.5 ? -1 : 1) * (30 + rnd() * 140);
      const dy = 20 + rnd() * 70;
      cx += dx;
      cy += Math.abs(dx); // 45° jog
      pts.push([cx, cy]);
      cy += dy;
      pts.push([cx, cy]);
    }
    traces.push({ pts, pad: rnd() < 0.7 });
    x += 18 + rnd() * 70;
  }
  return traces;
};
const traceCache = new Map<string, Trace[]>();

export const BinaryWord: React.FC<{ v: BinaryVersion }> = ({ v }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const mainRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const f = ((frame % LOOP) + LOOP) % LOOP;

  useFrameCanvas(() => {
    const main = mainRef.current;
    const glowCanvas = glowRef.current;
    if (!main || !glowCanvas) return;
    const s = canvasScale();
    const W = Math.round(width * s);
    const H = Math.round(height * s);
    for (const c of [main, glowCanvas]) {
      if (c.width !== W) c.width = W;
      if (c.height !== H) c.height = H;
    }
    const L = getLayout(v.word, width, height);
    const tkey = `${v.seed}|${width}`;
    if (!traceCache.has(tkey)) traceCache.set(tkey, buildTraces(v.seed, width));
    const traces = traceCache.get(tkey)!;

    const ctx = main.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = v.background;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(s, 0, 0, s, 0, 0);

    // circuit traces (very faint, top edge only)
    ctx.strokeStyle = v.circuitColor;
    ctx.fillStyle = v.circuitColor;
    ctx.lineWidth = 2.5;
    for (const tr of traces) {
      ctx.beginPath();
      tr.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
      if (tr.pad) {
        const [px, py] = tr.pts[tr.pts.length - 1];
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // scan band (horizontal travel across the word)
    const bandW = (L.wordRight - L.wordLeft) * 0.09;
    const scanX = L.wordLeft - bandW * 3 + loopSaw(f, SCAN_PASSES) * (L.wordRight - L.wordLeft + bandW * 6);

    const dim = hexToRgb(v.bgDim);
    const bright = hexToRgb(v.bgBright);
    const wordC = hexToRgb(v.wordColor);
    const white: RGB = [255, 255, 255];

    // Bucket cells by colour level so fillStyle changes stay cheap.
    const LEVELS = 24;
    const bgBuckets: { x: number; y: number; ch: string }[][] = Array.from({ length: LEVELS }, () => []);
    const wBuckets: { x: number; y: number; ch: string }[][] = Array.from({ length: LEVELS }, () => []);

    const seed = v.seed * 7919;
    // 1) word digits on the half-row sub-grid
    for (let sr = 0; sr < L.rows * 2; sr++) {
      const y = L.y0 + (sr + 0.5) * (ROW / 2) + DIGIT_H / 2;
      for (let c = 0; c < L.cols; c++) {
        const si = sr * L.cols + c;
        const cov = L.sub[si];
        if (cov <= 0.08) continue;
        const x = L.x0 + c * COL + (COL - CHAR_W) / 2;
        const cellH = hash01(c + seed, sr, 11);
        const k = WORD_PERIODS[Math.floor(cellH * WORD_PERIODS.length)];
        const off = Math.floor(hash01(c + seed, sr, 12) * k);
        const e = Math.floor((f + off) / k) % (LOOP / k);
        const he = hash01(si + seed, e, 3);
        let inWord = cov > 0.45;
        if (inWord && cov < 0.8 && he < 0.1) inWord = false; // drop-outs near the edge
        if (!inWord && he < cov * 0.4) inWord = true; // a few stray lit cells just outside
        if (!inWord) continue;
        let level = 0.66 + 0.34 * hash01(si + seed, e, 4);
        if (cov < 0.6) level *= 0.7 + 0.3 * cov;
        const ch = hash01(si + seed, e, 5) < 0.5 ? "0" : "1";
        const scan = Math.exp(-(((x - scanX) / bandW) ** 2));
        const lv = clamp(level + scan * 0.5, 0, 1.5);
        wBuckets[Math.min(LEVELS - 1, Math.floor((lv / 1.5) * LEVELS))].push({ x, y, ch });
      }
    }
    // 2) background digits on the regular grid (skipped where the word is)
    for (let r = 0; r < L.rows; r++) {
      const y = L.y0 + r * ROW + ROW / 2 + DIGIT_H / 2;
      for (let c = 0; c < L.cols; c++) {
        const i = r * L.cols + c;
        if (L.coverage[i] > 0.08) continue;
        const x = L.x0 + c * COL + (COL - CHAR_W) / 2;
        const cellH = hash01(c + seed, r, 1);
        const k = BG_PERIODS[Math.floor(cellH * BG_PERIODS.length)];
        const off = Math.floor(hash01(c + seed, r, 2) * k);
        const e = Math.floor((f + off) / k) % (LOOP / k);
        const h = hash01(i + seed, e, 7);
        if (h < 0.35) continue; // ~35% blanks
        const ch = h < 0.675 ? "0" : "1";
        const scan = Math.exp(-(((x - scanX) / bandW) ** 2));
        let lv = Math.pow(hash01(i + seed, e, 8), 2) * 0.85 * (1 - 0.6 * L.near[i]); // mostly dim, darker around the word
        const sparkle = L.near[i] > 0.05 && hash01(i + seed, e, 9) < L.near[i] * 0.22 ? 1 : 0;
        lv = clamp(lv + sparkle * 0.55 + scan * 0.3 * (0.25 + L.near[i]), 0, 1.5);
        bgBuckets[Math.min(LEVELS - 1, Math.floor((lv / 1.5) * LEVELS))].push({ x, y, ch });
      }
    }

    ctx.font = `400 ${FONT_PX}px ${MONO}`;
    ctx.textBaseline = "alphabetic";
    for (let b = 0; b < LEVELS; b++) {
      const lv = ((b + 0.5) / LEVELS) * 1.5;
      const col = lv <= 1 ? mixRgb(dim, bright, lv) : mixRgb(bright, mixRgb(bright, wordC, 0.5), lv - 1);
      ctx.fillStyle = rgbStr(col);
      for (const d of bgBuckets[b]) ctx.fillText(d.ch, d.x, d.y);
    }

    // bright word digits on the main canvas and (for the glow) on the glow canvas
    const g = glowCanvas.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.setTransform(s, 0, 0, s, 0, 0);
    ctx.font = `700 ${FONT_PX}px ${MONO}`;
    g.font = `700 ${FONT_PX}px ${MONO}`;
    for (let b = 0; b < LEVELS; b++) {
      if (!wBuckets[b].length) continue;
      const lv = ((b + 0.5) / LEVELS) * 1.5;
      const col = lv <= 1 ? mixRgb(mixRgb(bright, wordC, 0.35), wordC, lv) : mixRgb(wordC, white, Math.min(1, (lv - 1) * 1.6));
      ctx.fillStyle = rgbStr(col);
      g.fillStyle = rgbStr(col);
      for (const d of wBuckets[b]) {
        ctx.fillText(d.ch, d.x, d.y);
        g.fillText(d.ch, d.x, d.y);
      }
    }
  }, [f, width, height, v]);

  return (
    <AbsoluteFill style={{ backgroundColor: v.background }}>
      <canvas ref={mainRef} style={{ position: "absolute", width: "100%", height: "100%" }} />
      {/* soft glow: blurred copy of the bright digits, low opacity */}
      <canvas
        ref={glowRef}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          filter: `blur(${width * 0.006}px)`,
          opacity: 0.85,
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 45% at 50% 50%, ${v.glowColor}14 0%, transparent 70%)`,
          mixBlendMode: "screen",
        }}
      />
      <Grain amount={0.018} seed={1} />
    </AbsoluteFill>
  );
};
