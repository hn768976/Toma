// Draws one frame of the dashboard "board" onto a 2D canvas, in 1x board
// units (the caller applies the resolution scale via ctx transform).
// Everything here is a pure function of (t, theme) — see noise.ts.

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  FONT_FAMILY,
  type Theme,
} from "./constants";
import {
  clamp01,
  digits,
  fbm,
  hashN,
  hexToken,
  lerp,
  stepped,
  vnoise,
  word,
} from "./noise";

type Ctx = CanvasRenderingContext2D;
type Accent = "a" | "b" | "c";

// ---------------------------------------------------------------- layout
const CHART = { x: 1100, y: 240, w: 1700, rows: 7, rowH: 144 };
const CHART_BOTTOM = CHART.y + CHART.rows * CHART.rowH; // 1248
const MATRIX = { x: 40, y: 600, w: 580, h: 580, cols: 30, rows: 28 };
const LEGEND_X = 1000;
const RIGHT = { x: 2880, y: 240, w: 680 };
const ROW_ACCENT: Accent[] = ["a", "b", "a", "c", "b", "b", "c"];

// ---------------------------------------------------------------- helpers
const rgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${clamp01(alpha)})`;
};

const mix = (hexA: string, hexB: string, t: number) => {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(lerp((a >> shift) & 255, (b >> shift) & 255, t));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

const font = (px: number) => `${px}px "${FONT_FAMILY}", "DejaVu Sans Mono", monospace`;

const line = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number) => {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
};

const circle = (ctx: Ctx, x: number, y: number, r: number) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
};

const arc = (ctx: Ctx, x: number, y: number, r: number, a0: number, a1: number) => {
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a1);
  ctx.stroke();
};

const accent = (theme: Theme, k: Accent) => theme[k];

// ---------------------------------------------------------------- widgets
const textLine = (
  ctx: Ctx,
  x: number,
  y: number,
  text: string,
  color: string,
  size = 11,
  align: CanvasTextAlign = "left",
) => {
  ctx.font = font(size);
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
};

// A row of thin horizontal bars whose lengths breathe over time.
const barStack = (
  ctx: Ctx,
  x: number,
  y: number,
  count: number,
  maxW: number,
  color: string,
  seed: number,
  t: number,
  pitch = 9,
  h = 3,
) => {
  for (let i = 0; i < count; i++) {
    const w = maxW * (0.25 + 0.75 * fbm(t * 0.35 + i * 3.1, seed + i));
    ctx.fillStyle = rgba(color, 0.45 + 0.5 * hashN(seed, i, 2));
    ctx.fillRect(x, y + i * pitch, w, h);
  }
};

// Small ring gauge with a sweeping arc.
const ringGauge = (
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  color: string,
  seed: number,
  t: number,
) => {
  ctx.lineWidth = 3;
  ctx.strokeStyle = rgba(color, 0.18);
  arc(ctx, x, y, r, 0, Math.PI * 2);
  const value = 0.35 + 0.55 * fbm(t * 0.4, seed);
  const start = -Math.PI / 2 + t * (0.6 + hashN(seed, 1) * 0.8);
  ctx.strokeStyle = rgba(color, 0.95);
  arc(ctx, x, y, r, start, start + value * Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(color, 0.4);
  arc(ctx, x, y, r - 6, 0, Math.PI * 2);
};

// A small analogue dial icon.
const miniDial = (ctx: Ctx, x: number, y: number, r: number, color: string, seed: number, t: number) => {
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rgba(color, 0.55);
  arc(ctx, x, y, r, 0, Math.PI * 2);
  const a = (-225 + 270 * fbm(t * 0.3, seed)) * (Math.PI / 180);
  ctx.strokeStyle = rgba(color, 0.9);
  line(ctx, x, y, x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3));
  ctx.fillStyle = rgba(color, 0.9);
  circle(ctx, x, y, 1.6);
  ctx.fill();
};

// A tiny equaliser: vertical bars bouncing.
const equaliser = (
  ctx: Ctx,
  x: number,
  y: number,
  count: number,
  maxH: number,
  color: string,
  seed: number,
  t: number,
  pitch = 7,
  w = 4,
) => {
  for (let i = 0; i < count; i++) {
    const h = maxH * (0.15 + 0.85 * vnoise(t * 2.2 + i * 1.7, seed + i));
    ctx.fillStyle = rgba(color, 0.55 + 0.45 * vnoise(t * 3 + i, seed + 40 + i));
    ctx.fillRect(x + i * pitch, y - h, w, h);
  }
};

// Table of label / value pairs whose values tick over now and then.
const dataTable = (
  ctx: Ctx,
  x: number,
  y: number,
  rows: number,
  theme: Theme,
  seed: number,
  t: number,
  pitch = 22,
  hot: Accent = "a",
) => {
  for (let i = 0; i < rows; i++) {
    const rs = seed * 31 + i;
    const yy = y + i * pitch;
    const isHot = hashN(rs, 3) < 0.35;
    const col = isHot ? rgba(accent(theme, hot), 0.85) : rgba(theme.textDim, 0.95);
    const epoch = Math.floor(t * (0.4 + hashN(rs, 4)) + hashN(rs, 5) * 10);
    textLine(ctx, x, yy, `${word(rs)} ${digits(rs, 2)}`, col, 11);
    textLine(ctx, x + 96, yy, hexToken(rs * 7 + epoch, 4), rgba(theme.text, 0.55), 11);
    const v = (fbm(t * 0.5 + i, rs) * 99).toFixed(2);
    textLine(ctx, x + 176, yy, v, col, 11, "right");
    ctx.fillStyle = rgba(isHot ? accent(theme, hot) : theme.b, 0.5);
    ctx.fillRect(x + 186, yy - 7, 26 * fbm(t * 0.6 + i * 2, rs + 9), 5);
  }
};

// ---------------------------------------------------------------- sections
const drawHeader = (ctx: Ctx, t: number, theme: Theme) => {
  const A = theme.a;
  const B = theme.b;
  // far left: label lines + bars
  for (let i = 0; i < 5; i++) {
    const y = 66 + i * 24;
    textLine(ctx, 60, y, `${word(i + 1)} ${hexToken(i + 11, 3)}`, rgba(theme.textDim, 0.9), 11);
    ctx.fillStyle = rgba(hashN(i, 8) < 0.5 ? B : A, 0.85);
    ctx.fillRect(170, y - 8, 90 * fbm(t * 0.4 + i, 900 + i), 5);
    ctx.fillStyle = rgba(theme.text, 0.35);
    ctx.fillRect(270, y - 8, 160, 1);
  }
  // cluster of thin bars, red / blue
  barStack(ctx, 500, 52, 12, 130, A, 910, t, 9, 4);
  barStack(ctx, 650, 52, 12, 110, B, 920, t, 9, 4);
  barStack(ctx, 780, 52, 12, 150, A, 930, t, 9, 3);
  // ring + text block
  ringGauge(ctx, 1010, 98, 20, B, 940, t);
  for (let i = 0; i < 4; i++) {
    textLine(ctx, 1045, 76 + i * 16, `${word(50 + i)} ${digits(50 + i, 3)}`, rgba(theme.textDim, 0.9), 11);
    ctx.fillStyle = rgba(B, 0.7);
    ctx.fillRect(1150, 70 + i * 16, 40 * fbm(t * 0.6 + i, 950 + i), 4);
  }
  // wide rows: text, line, blocks
  for (let i = 0; i < 4; i++) {
    const y = 66 + i * 30;
    const col = i % 2 ? A : B;
    textLine(ctx, 1280, y, `${word(60 + i)}-${hexToken(60 + i, 2)}`, rgba(col, 0.85), 11);
    ctx.fillStyle = rgba(theme.text, 0.25);
    ctx.fillRect(1380, y - 5, 380, 1);
    for (let k = 0; k < 8; k++) {
      const on = vnoise(t * 1.5 + k, 960 + i * 10 + k) > 0.45;
      ctx.fillStyle = rgba(col, on ? 0.9 : 0.2);
      ctx.fillRect(1780 + k * 14, y - 9, 10, 6);
    }
    textLine(ctx, 1920, y, hexToken(70 + i * 3 + Math.floor(t * 0.7), 6), rgba(theme.textDim, 0.9), 11);
  }
  // right-side header: two rings and bars
  ringGauge(ctx, 2140, 98, 22, A, 970, t);
  ringGauge(ctx, 2210, 98, 22, B, 980, t);
  barStack(ctx, 2260, 60, 9, 160, A, 990, t, 9, 3);
  barStack(ctx, 2450, 60, 9, 120, B, 995, t, 9, 3);
  for (let i = 0; i < 5; i++) {
    const y = 66 + i * 24;
    textLine(ctx, 2620, y, `${word(80 + i)} ${digits(80 + i, 4)}`, rgba(i % 3 === 0 ? A : theme.textDim, 0.9), 11);
    ctx.fillStyle = rgba(i % 3 === 0 ? A : B, 0.7);
    ctx.fillRect(2740, y - 8, 120 * fbm(t * 0.5 + i, 1000 + i), 4);
  }
  barStack(ctx, 2900, 52, 12, 200, B, 1010, t, 9, 4);
  barStack(ctx, 3140, 52, 12, 180, A, 1020, t, 9, 4);
  barStack(ctx, 3350, 52, 12, 180, B, 1030, t, 9, 4);
  // thin separator under the header
  ctx.fillStyle = rgba(theme.gridStrong, 0.8);
  ctx.fillRect(40, 190, BOARD_WIDTH - 80, 1);
};

const drawLeftLabels = (ctx: Ctx, t: number, theme: Theme) => {
  for (let i = 0; i < 12; i++) {
    const y = 236 + i * 28;
    const k: Accent = hashN(i, 21) < 0.65 ? "b" : hashN(i, 22) < 0.5 ? "a" : "c";
    const col = accent(theme, k);
    textLine(ctx, 40, y, `${word(100 + i)} ${hexToken(100 + i, 2)}`, rgba(theme.textDim, 0.95), 11);
    const w = 40 + 330 * fbm(t * 0.3 + i * 1.3, 1100 + i);
    ctx.fillStyle = rgba(col, 0.85);
    ctx.fillRect(150, y - 9, w, 6);
    ctx.fillStyle = rgba(col, 0.25);
    ctx.fillRect(150 + w, y - 9, 370 - w, 6);
    textLine(ctx, 600, y, (fbm(t * 0.5, 1150 + i) * 100).toFixed(1), rgba(col, 0.9), 11, "right");
  }
  // a couple of "hot" lines above the matrix
  textLine(ctx, 40, 585, `${word(130)} ${hexToken(131, 8)}  ${digits(132 + Math.floor(t), 4)}`, rgba(theme.text, 0.55), 11);
  ctx.fillStyle = rgba(theme.gridStrong, 0.9);
  ctx.fillRect(40, 592, MATRIX.w, 1);
};

const drawMatrix = (ctx: Ctx, t: number, theme: Theme) => {
  const px = MATRIX.w / MATRIX.cols;
  const py = MATRIX.h / MATRIX.rows;
  for (let r = 0; r < MATRIX.rows; r++) {
    for (let c = 0; c < MATRIX.cols; c++) {
      const id = r * 131 + c;
      const rate = 0.5 + hashN(id, 1) * 1.3; // state changes per second
      const epoch = Math.floor(t * rate + hashN(id, 2) * 10);
      const state = hashN(id, epoch, 11);
      if (state < 0.2) continue;
      // Red dominates on the left, blue/green on the right — matching the
      // reference's colour weighting.
      const bias = c / MATRIX.cols;
      const k: Accent =
        state < 0.62 - 0.3 * bias ? "a" : state < 0.88 ? "b" : "c";
      const w = 6 + hashN(id, epoch, 12) * 11;
      const h = 4 + hashN(id, epoch, 13) * 4;
      const flicker = 0.85 + 0.15 * Math.sin(t * 9 + hashN(id, 3) * 6.28);
      ctx.fillStyle = rgba(accent(theme, k), (0.5 + 0.5 * hashN(id, epoch, 14)) * flicker);
      ctx.fillRect(MATRIX.x + c * px, MATRIX.y + r * py + (py - h) / 2, w, h);
    }
  }
  ctx.fillStyle = rgba(theme.gridStrong, 0.9);
  ctx.fillRect(MATRIX.x, MATRIX.y + MATRIX.h + 8, MATRIX.w, 1);
  textLine(ctx, MATRIX.x, MATRIX.y + MATRIX.h + 26, `${word(140)} ${hexToken(141 + Math.floor(t * 2), 6)}`, rgba(theme.textDim, 0.9), 11);
};

type Ribbon = { k: Accent; y0: number; y1: number; w: number; id: number; row: number };

// Strands are routed per chart row, like the reference: every row's
// legend receives a handful of strands in that row's colour (one or two
// thick, the rest thin), and their sources are interleaved along the
// matrix edge so the bundles weave and cross on the way over.
const buildRibbons = (): Ribbon[] => {
  const ribbons: Ribbon[] = [];
  let id = 0;
  for (let r = 0; r < CHART.rows; r++) {
    const top = CHART.y + r * CHART.rowH;
    const count = 4 + Math.floor(hashN(r, 70) * 3); // 4..6 per row
    const thickAt = Math.floor(hashN(r, 71) * count);
    let y1 = top + 14 + hashN(r, 72) * 10;
    for (let i = 0; i < count; i++) {
      const w =
        i === thickAt
          ? 14 + hashN(r, i, 73) * 10
          : hashN(r, i, 77) < 0.35
            ? 8 + hashN(r, i, 74) * 4
            : 4 + hashN(r, i, 74) * 3;
      ribbons.push({ k: ROW_ACCENT[r], y0: 0, y1: y1 + w / 2, w, id: id++, row: r });
      y1 += w + 5 + hashN(r, i, 75) * 4;
    }
  }
  // Source order: destination order with noise, so neighbouring rows swap
  // places and strands cross, while the bundle still reads top -> bottom.
  const order = [...ribbons].sort(
    (p, q) => p.y1 + (hashN(p.id, 76) - 0.5) * 640 - (q.y1 + (hashN(q.id, 76) - 0.5) * 640),
  );
  // Packed tight at the source (centred on the matrix edge) so the bundle
  // visibly fans out towards the rows.
  const gap = 3;
  const totalH = order.reduce((acc, rb) => acc + rb.w + gap, 0);
  let y0 = MATRIX.y + (MATRIX.h - totalH) / 2;
  for (const rb of order) {
    rb.y0 = y0 + rb.w / 2;
    y0 += rb.w + gap;
  }
  // No strand may run straight across: if a strand's source sits level
  // with its destination, swap source slots with another strand so both
  // still sweep by at least MIN_SWEEP.
  const MIN_SWEEP = 90;
  const sweep = (rb: Ribbon, src: number) => Math.abs(rb.y1 - src);
  for (let pass = 0; pass < 3; pass++) {
    for (const rb of order) {
      if (sweep(rb, rb.y0) >= MIN_SWEEP) continue;
      let best: Ribbon | null = null;
      let bestScore = 0;
      for (const other of order) {
        if (other === rb) continue;
        const score = Math.min(sweep(rb, other.y0), sweep(other, rb.y0));
        if (score >= MIN_SWEEP && score > bestScore) {
          best = other;
          bestScore = score;
        }
      }
      if (best) {
        const tmp = rb.y0;
        rb.y0 = best.y0;
        best.y0 = tmp;
      }
    }
  }
  return ribbons;
};

const RIBBONS = buildRibbons();

const ribbonPath = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number) => {
  const dx = x1 - x0;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.bezierCurveTo(x0 + dx * 0.45, y0, x1 - dx * 0.45, y1, x1, y1);
};

const drawRibbons = (ctx: Ctx, t: number, theme: Theme) => {
  const x0 = MATRIX.x + MATRIX.w;
  const x1 = LEGEND_X;
  ctx.lineCap = "butt";
  // thick strands underneath, thin ones on top
  const order = [...RIBBONS].sort((p, q) => q.w - p.w);
  for (const rb of order) {
    const col = accent(theme, rb.k);
    const wobble = (vnoise(t * 0.6 + rb.id, 300 + rb.id) - 0.5) * 4;
    const y0 = rb.y0 + wobble;
    // dark rim so overlapping strands stay separated
    ribbonPath(ctx, x0, y0, x1, rb.y1);
    ctx.lineWidth = rb.w + 3.2;
    ctx.strokeStyle = rgba(theme.background, 0.85);
    ctx.stroke();
    // body, a touch dimmer at the source end
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, rgba(col, 0.62));
    g.addColorStop(0.5, rgba(col, 0.74));
    g.addColorStop(1, rgba(col, 0.9));
    ribbonPath(ctx, x0, y0, x1, rb.y1);
    ctx.lineWidth = rb.w;
    ctx.strokeStyle = g;
    ctx.stroke();
    // travelling light pulse
    const p = (t * (0.16 + hashN(rb.id, 60) * 0.12) + hashN(rb.id, 61)) % 1;
    const band = ctx.createLinearGradient(x0, 0, x1, 0);
    const bw = 0.14;
    band.addColorStop(0, "rgba(255,255,255,0)");
    band.addColorStop(clamp01(p - bw), "rgba(255,255,255,0)");
    band.addColorStop(clamp01(p), "rgba(255,255,255,0.22)");
    band.addColorStop(clamp01(p + bw), "rgba(255,255,255,0)");
    band.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = band;
    ctx.stroke();
  }
};

const drawLegendColumn = (ctx: Ctx, t: number, theme: Theme) => {
  // vertical spine with ticks
  ctx.fillStyle = rgba(theme.gridStrong, 0.9);
  ctx.fillRect(LEGEND_X + 66, CHART.y, 1, CHART_BOTTOM - CHART.y);
  for (let y = CHART.y; y < CHART_BOTTOM; y += 18) {
    ctx.fillRect(LEGEND_X + 60, y, 6, 1);
  }
  for (const rb of RIBBONS) {
    const col = accent(theme, rb.k);
    const w = 28 + 30 * fbm(t * 0.5 + rb.id, 400 + rb.id);
    const h = Math.max(3, Math.min(12, rb.w));
    ctx.fillStyle = rgba(col, 0.95);
    ctx.fillRect(LEGEND_X, rb.y1 - h / 2, w, h);
    ctx.fillStyle = rgba(col, 0.25);
    ctx.fillRect(LEGEND_X + w, rb.y1 - h / 2, 58 - w, h);
  }
  // per-row legend stacks beside the spine
  for (let r = 0; r < CHART.rows; r++) {
    const col = accent(theme, ROW_ACCENT[r]);
    const top = CHART.y + r * CHART.rowH;
    barStack(ctx, LEGEND_X + 74, top + 18, 5, 22, col, 420 + r, t, 8, 3);
  }
};

const seriesValue = (idx: number, seed: number) => {
  const env = 0.3 + 0.7 * vnoise(idx * 0.11, seed + 1);
  const jag = (hashN(idx, seed) - 0.5) * 2;
  const drift = (fbm(idx * 0.045, seed + 2) - 0.5) * 36;
  return jag * 50 * env + drift;
};

const drawCharts = (ctx: Ctx, t: number, theme: Theme) => {
  const { x, y, w, rows, rowH } = CHART;
  // grid
  ctx.lineWidth = 1;
  for (let gx = x; gx <= x + w; gx += 85) {
    const strong = Math.round((gx - x) / 85) % 4 === 0;
    ctx.strokeStyle = rgba(strong ? theme.gridStrong : theme.grid, strong ? 0.9 : 0.7);
    line(ctx, gx, y, gx, CHART_BOTTOM);
  }
  for (let r = 0; r <= rows; r++) {
    ctx.strokeStyle = rgba(theme.gridStrong, 0.9);
    line(ctx, x, y + r * rowH, x + w, y + r * rowH);
  }
  // rulers above and below
  for (let gx = x; gx <= x + w; gx += 42.5) {
    const i = Math.round((gx - x) / 42.5);
    const big = i % 4 === 0;
    ctx.fillStyle = rgba(theme.textDim, big ? 0.9 : 0.45);
    ctx.fillRect(gx, y - (big ? 10 : 5), 1, big ? 10 : 5);
    ctx.fillRect(gx, CHART_BOTTOM, 1, big ? 10 : 5);
    if (big) {
      textLine(ctx, gx + 3, y - 12, digits(i + 500, 3), rgba(theme.textDim, 0.8), 9);
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, rows * rowH);
  ctx.clip();

  const spacing = 24;
  const speed = 26; // board px per second the data scrolls left
  for (let r = 0; r < rows; r++) {
    const col = accent(theme, ROW_ACCENT[r]);
    const top = y + r * rowH;
    const cy = top + rowH / 2;
    const seed = 300 + r * 17;

    // dashed guide lines
    ctx.setLineDash([2, 6]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(col, 0.28);
    line(ctx, x, cy - 34, x + w, cy - 34);
    line(ctx, x, cy + 34, x + w, cy + 34);
    ctx.setLineDash([]);
    // solid baseline
    ctx.strokeStyle = rgba(col, 0.55);
    ctx.lineWidth = 1.2;
    line(ctx, x, cy, x + w, cy);
    // row label
    textLine(ctx, x + 8, top + 14, `${word(seed)} ${digits(seed, 2)}`, rgba(theme.textDim, 0.85), 10);
    textLine(ctx, x + w - 8, top + 14, hexToken(seed + Math.floor(t * 1.5), 5), rgba(col, 0.6), 10, "right");

    const offset = t * speed + hashN(seed, 9) * 500;
    const shift = offset % spacing;
    const base = Math.floor(offset / spacing);
    const n = Math.ceil(w / spacing) + 2;

    // ghost trace (dim, un-dotted)
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const px = x + k * spacing - shift;
      const py = cy - seriesValue(base + k, seed + 50) * 0.6;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(col, 0.2);
    ctx.stroke();

    // main dotted trace
    const pts: [number, number, number][] = [];
    for (let k = 0; k < n; k++) {
      const idx = base + k;
      pts.push([x + k * spacing - shift, cy - seriesValue(idx, seed), idx]);
    }
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.lineWidth = 1.6;
    ctx.lineJoin = "round";
    ctx.strokeStyle = rgba(col, 0.8);
    ctx.stroke();
    for (const [px, py, idx] of pts) {
      const hot = hashN(idx, seed, 3) > 0.86;
      if (hot) {
        ctx.fillStyle = rgba(col, 0.22);
        circle(ctx, px, py, 7);
        ctx.fill();
      }
      ctx.fillStyle = hot ? "#ffffff" : rgba(col, 1);
      circle(ctx, px, py, hot ? 3.4 : 2.7);
      ctx.fill();
    }
  }
  ctx.restore();

  // "034" style counter top-right of the chart block, with an equaliser
  textLine(ctx, x + w + 30, y + 22, digits(777 + Math.floor(t * 3), 3), rgba(theme.c, 0.95), 30);
  equaliser(ctx, x + w + 120, y + 22, 14, 26, theme.c, 555, t, 7, 4);
};

const drawReadouts = (ctx: Ctx, t: number, theme: Theme) => {
  const y = CHART_BOTTOM + 40; // 1288
  // big numeric readout
  const big = 23.2 + (stepped(t, 0.5, 600) - 0.5) * 1.4;
  textLine(ctx, CHART.x, y + 90, big.toFixed(1), rgba(theme.b, 0.95), 52);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = rgba(theme.b, vnoise(t * 2 + i, 601 + i) > 0.5 ? 0.9 : 0.3);
    circle(ctx, CHART.x + 6 + i * 12, y + 106, 2);
    ctx.fill();
  }
  // gauges
  ringGauge(ctx, CHART.x + 250, y + 70, 30, theme.a, 610, t);
  ringGauge(ctx, CHART.x + 880, y + 60, 30, theme.c, 620, t);
  // tables
  dataTable(ctx, CHART.x + 320, y + 24, 6, theme, 630, t, 22, "a");
  dataTable(ctx, CHART.x + 560, y + 24, 6, theme, 640, t, 22, "b");
  dataTable(ctx, CHART.x + 960, y + 24, 6, theme, 650, t, 22, "a");
  dataTable(ctx, CHART.x + 1200, y + 24, 6, theme, 660, t, 22, "b");
  // equaliser + bar stacks
  equaliser(ctx, CHART.x + 1450, y + 90, 22, 70, theme.b, 670, t, 8, 5);
  barStack(ctx, CHART.x + 1650, y + 16, 8, 60, theme.a, 680, t, 10, 4);
  // long progress bars
  for (let i = 0; i < 4; i++) {
    const yy = y + 190 + i * 22;
    const k: Accent = (["a", "b", "c", "b"] as Accent[])[i];
    const col = accent(theme, k);
    const w = CHART.w * (0.2 + 0.75 * fbm(t * 0.25 + i * 4, 690 + i));
    ctx.fillStyle = rgba(col, 0.9);
    ctx.fillRect(CHART.x, yy, w, 4);
    ctx.fillStyle = rgba(col, 0.18);
    ctx.fillRect(CHART.x + w, yy, CHART.w - w, 4);
    textLine(ctx, CHART.x + CHART.w + 12, yy + 5, (fbm(t * 0.4, 700 + i) * 100).toFixed(1), rgba(col, 0.9), 11);
  }
  // scrolling ticker line at the very bottom
  ctx.save();
  ctx.beginPath();
  ctx.rect(CHART.x, y + 268, CHART.w, 24);
  ctx.clip();
  const scroll = (t * 60) % 260;
  for (let i = -1; i < 9; i++) {
    const xx = CHART.x + i * 260 - scroll;
    textLine(ctx, xx, y + 286, `${word(720 + i)} ${hexToken(720 + i, 6)} ${digits(721 + i, 5)}`, rgba(theme.textDim, 0.9), 11);
  }
  ctx.restore();
};

const drawRightPanel = (ctx: Ctx, t: number, theme: Theme) => {
  const { x, y, w } = RIGHT;
  // mini dials
  for (let i = 0; i < 7; i++) {
    miniDial(ctx, x + 30 + i * 62, y + 80, 13, theme.b, 800 + i, t);
    textLine(ctx, x + 30 + i * 62, y + 108, digits(810 + i, 3), rgba(theme.textDim, 0.85), 9, "center");
  }
  ctx.fillStyle = rgba(theme.gridStrong, 0.9);
  ctx.fillRect(x, y + 130, w, 1);
  // four large ring gauges
  const centres: [number, number][] = [
    [x + 130, y + 290],
    [x + 440, y + 290],
    [x + 130, y + 600],
    [x + 440, y + 600],
  ];
  centres.forEach(([gx, gy], i) => {
    const r = 68;
    const pulse = 0.7 + 0.3 * Math.sin(t * 2.2 + i * 1.7);
    ctx.lineWidth = 5;
    ctx.strokeStyle = rgba(theme.a, pulse);
    arc(ctx, gx, gy, r, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(theme.a, 0.45);
    ctx.setLineDash([3, 5]);
    arc(ctx, gx, gy, r - 14, 0, Math.PI * 2);
    ctx.setLineDash([]);
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      const len = k % 9 === 0 ? 8 : 4;
      line(
        ctx,
        gx + Math.cos(a) * (r - 22),
        gy + Math.sin(a) * (r - 22),
        gx + Math.cos(a) * (r - 22 - len),
        gy + Math.sin(a) * (r - 22 - len),
      );
    }
    const oa = t * (0.9 + i * 0.25) + i;
    ctx.fillStyle = rgba(theme.a, 1);
    circle(ctx, gx + Math.cos(oa) * (r - 14), gy + Math.sin(oa) * (r - 14), 3.5);
    ctx.fill();
    ctx.strokeStyle = rgba(theme.a, 0.9);
    ctx.lineWidth = 2.5;
    const sweep = 0.4 + 0.5 * fbm(t * 0.5, 820 + i);
    arc(ctx, gx, gy, r + 10, -Math.PI / 2, -Math.PI / 2 + sweep * Math.PI * 2);
    textLine(ctx, gx, gy + 6, hexToken(830 + i + Math.floor(t * 2), 4), rgba(theme.text, 0.9), 16, "center");
    textLine(ctx, gx - r, gy + r + 38, `${digits(840 + i, 2)}-${digits(841 + i, 2)} ${word(842 + i)} ${hexToken(843 + i, 6)}`, rgba(theme.a, 0.8), 10);
  });
  // two text columns beneath
  dataTable(ctx, x, y + 810, 12, theme, 850, t, 24, "a");
  dataTable(ctx, x + 350, y + 810, 12, theme, 860, t, 24, "a");
  // bottom bars
  for (let i = 0; i < 3; i++) {
    const yy = y + 1120 + i * 22;
    const col = i === 1 ? theme.b : theme.a;
    const bw = w * (0.3 + 0.65 * fbm(t * 0.3 + i, 870 + i));
    ctx.fillStyle = rgba(col, 0.85);
    ctx.fillRect(x, yy, bw, 4);
    ctx.fillStyle = rgba(col, 0.18);
    ctx.fillRect(x + bw, yy, w - bw, 4);
  }
};

// ---------------------------------------------------------------- entry
export const drawBoard = (ctx: Ctx, t: number, theme: Theme) => {
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  // faint panel behind the chart block
  ctx.fillStyle = rgba(theme.gridStrong, 0.12);
  ctx.fillRect(CHART.x - 8, CHART.y - 8, CHART.w + 16, CHART_BOTTOM - CHART.y + 16);

  drawHeader(ctx, t, theme);
  drawLeftLabels(ctx, t, theme);
  drawMatrix(ctx, t, theme);
  drawRibbons(ctx, t, theme);
  drawLegendColumn(ctx, t, theme);
  drawCharts(ctx, t, theme);
  drawReadouts(ctx, t, theme);
  drawRightPanel(ctx, t, theme);
};

// Dot-matrix screen texture, drawn over the crisp layer only. `scale` is
// the resolution multiple so the pitch stays 4 board-px at any size.
export const drawPixelGrid = (ctx: Ctx, width: number, height: number, scale: number) => {
  const pitch = 4 * scale;
  const tile = document.createElement("canvas");
  tile.width = pitch;
  tile.height = pitch;
  const tc = tile.getContext("2d");
  if (!tc) return;
  tc.fillStyle = "rgba(0,0,0,0.32)";
  tc.fillRect(0, 0, pitch, Math.max(1, scale)); // horizontal scanline
  tc.fillStyle = "rgba(0,0,0,0.2)";
  tc.fillRect(0, 0, Math.max(1, scale), pitch); // vertical line
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
};

export { mix };
