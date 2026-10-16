// Data Montage infographic elements. Layout is seeded once (module level);
// every animated quantity is a function of the loop phase t ∈ [0,1) with
// whole-number cycle counts, so each element repeats exactly every 600 frames
// (or every 600/m frames).
import type { LandMask } from "../../lib/assets";
import { TAU } from "../../lib/constants";
import { irange, mulberry32, pick, range, type Rng } from "../../lib/random";
import { CODES } from "../../data/tickers";

export type ElType =
  | "gaugeRow"
  | "bigGauge"
  | "bars"
  | "line"
  | "map"
  | "hex"
  | "radar"
  | "wave"
  | "numbers"
  | "globe"
  | "grid"
  | "panel"
  | "specks";

export type El = {
  type: ElType;
  layer: number;
  /** position along the layer's wrap strip, 0..1 */
  x0: number;
  /** vertical centre, in visible-heights (-0.5..0.5) */
  y: number;
  /** width as a fraction of the layer's visible width */
  w: number;
  /** height / width */
  aspect: number;
  animated: boolean;
  /** opacity breathing: whole cycles per loop + phase */
  fm: number;
  fph: number;
  base: number;
  seed: number;
  vals: number[];
  ms: number[];
  phs: number[];
};

const ASPECT: Record<ElType, [number, number]> = {
  gaugeRow: [0.22, 0.3],
  bigGauge: [1, 1],
  bars: [0.45, 0.6],
  line: [0.45, 0.6],
  map: [0.5, 0.5],
  hex: [0.95, 1.05],
  radar: [1, 1],
  wave: [0.25, 0.35],
  numbers: [0.55, 0.8],
  globe: [1, 1],
  grid: [0.5, 0.7],
  panel: [0.45, 0.8],
  specks: [0.5, 0.8],
};
const WIDTHS: Record<ElType, [number, number]> = {
  gaugeRow: [0.18, 0.3],
  bigGauge: [0.07, 0.13],
  bars: [0.14, 0.24],
  line: [0.16, 0.28],
  map: [0.2, 0.32],
  hex: [0.08, 0.15],
  radar: [0.09, 0.15],
  wave: [0.14, 0.24],
  numbers: [0.08, 0.14],
  globe: [0.1, 0.16],
  grid: [0.16, 0.28],
  panel: [0.18, 0.34],
  specks: [0.2, 0.32],
};
const STATIC: ElType[] = ["hex", "grid", "panel"];

/** Planes per depth layer (near → far). 80 in total. */
export const LAYER_COUNTS = [8, 16, 26, 18, 16];

const TYPES_BY_LAYER: ElType[][] = [
  ["gaugeRow", "gaugeRow", "bigGauge", "bars", "panel", "specks"],
  ["gaugeRow", "gaugeRow", "bars", "line", "numbers", "panel", "bigGauge", "specks", "map"],
  ["gaugeRow", "gaugeRow", "gaugeRow", "bars", "bars", "line", "map", "map", "numbers", "numbers", "panel", "bigGauge", "bigGauge", "specks", "specks", "radar"],
  ["panel", "map", "map", "line", "numbers", "grid", "gaugeRow", "gaugeRow", "bars", "specks", "radar"],
  ["panel", "panel", "grid", "map", "numbers", "gaugeRow", "bars", "specks"],
];

const makeEl = (rng: Rng, type: ElType, layer: number, i: number, n: number): El => {
  const [a0, a1] = ASPECT[type];
  const [w0, w1] = WIDTHS[type];
  const k = 48;
  return {
    type,
    layer,
    // spread evenly along the strip with jitter, so density stays even
    x0: (i + range(rng, 0.1, 0.9)) / n,
    y: range(rng, -0.47, 0.47),
    w: range(rng, w0, w1) * (layer === 0 ? 1.0 : 0.78),
    aspect: range(rng, a0, a1),
    animated: !STATIC.includes(type),
    fm: irange(rng, 1, 3),
    fph: rng() * TAU,
    base: range(rng, 0.55, 1.0),
    seed: Math.floor(rng() * 1e9),
    vals: Array.from({ length: k }, () => rng()),
    ms: Array.from({ length: k }, () => irange(rng, 1, 4)),
    phs: Array.from({ length: k }, () => rng() * TAU),
  };
};

export const ELEMENTS: El[] = (() => {
  const rng = mulberry32(1018476988);
  const out: El[] = [];
  LAYER_COUNTS.forEach((n, layer) => {
    const types = TYPES_BY_LAYER[layer];
    for (let i = 0; i < n; i++) out.push(makeEl(rng, pick(rng, types), layer, i, n));
  });
  // two wireframe globes near the top (one in focus, one softer behind it)
  const g1 = out.find((e) => e.layer === 2 && e.type !== "panel")!;
  Object.assign(g1, { type: "globe", animated: true, y: 0.44, w: 0.1, aspect: 1 });
  const g2 = out.find((e) => e.layer === 1 && e.type !== "panel")!;
  Object.assign(g2, { type: "globe", animated: true, y: 0.46, w: 0.08, aspect: 1, x0: (g1.x0 + 0.3) % 1 });
  // big donut rows cut off by the bottom edge
  out.filter((e) => (e.layer === 2 || e.layer === 1) && e.type === "gaugeRow").slice(0, 4).forEach((e) => {
    e.y = -0.47;
    e.w *= 1.3;
  });
  return out;
})();

// ---------------------------------------------------------------------------
// Drawing

export type Ink = { dim: string; bright: string };

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
};

const osc = (el: El, i: number, t: number) => 0.5 + 0.5 * Math.sin(TAU * el.ms[i % el.ms.length] * t + el.phs[i % el.phs.length]);

const drawDonut = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  lw: number,
  frac: number,
  ink: Ink,
  u: number,
  label: boolean,
) => {
  ctx.lineCap = "butt";
  ctx.strokeStyle = rgba(ink.dim, 0.35);
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = rgba(ink.dim, 1.0);
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
  ctx.stroke();
  ctx.strokeStyle = rgba(ink.dim, 0.6);
  ctx.lineWidth = u * 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + lw * 0.9, 0, TAU);
  ctx.stroke();
  if (label) {
    ctx.fillStyle = rgba(ink.bright, 0.95);
    ctx.font = `600 ${Math.round(r * 0.55)}px Inter`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(frac * 100)}%`, cx, cy + r * 0.04);
  }
};

const drawFrame = (ctx: CanvasRenderingContext2D, w: number, h: number, ink: Ink, u: number) => {
  ctx.strokeStyle = rgba(ink.dim, 0.35);
  ctx.lineWidth = u;
  ctx.strokeRect(u, u, w - 2 * u, h - 2 * u);
  // corner brackets
  ctx.strokeStyle = rgba(ink.bright, 0.8);
  ctx.lineWidth = u * 2;
  const c = Math.min(w, h) * 0.08;
  for (const [x, y, sx, sy] of [
    [u, u, 1, 1],
    [w - u, u, -1, 1],
    [u, h - u, 1, -1],
    [w - u, h - u, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * c);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * c, y);
    ctx.stroke();
  }
};

const gridLines = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, nx: number, ny: number, style: string, lw: number) => {
  ctx.strokeStyle = style;
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (let i = 0; i <= nx; i++) {
    const xx = x + (w * i) / nx;
    ctx.moveTo(xx, y);
    ctx.lineTo(xx, y + h);
  }
  for (let j = 0; j <= ny; j++) {
    const yy = y + (h * j) / ny;
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
  }
  ctx.stroke();
};

const hexPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * TAU) / 6;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

export const drawElement = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  el: El,
  ink: Ink,
  land: LandMask,
) => {
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  const u = Math.max(1, w / 300); // one "line unit"
  const m = Math.min(w, h);
  switch (el.type) {
    case "gaugeRow": {
      const n = 3 + (el.seed % 3);
      const r = Math.min(h * 0.3, (w / n) * 0.3);
      for (let i = 0; i < n; i++) {
        const cx = (w * (i + 0.5)) / n;
        drawDonut(ctx, cx, h * 0.5, r, r * 0.42, 0.12 + 0.82 * osc(el, i, t), ink, u, true);
      }
      break;
    }
    case "bigGauge": {
      const r = m * 0.36;
      const frac = 0.15 + 0.8 * osc(el, 0, t);
      // segmented outer ring
      const segs = 48;
      for (let i = 0; i < segs; i++) {
        const on = i / segs < frac;
        ctx.strokeStyle = rgba(on ? ink.bright : ink.dim, on ? 0.95 : 0.22);
        ctx.lineWidth = r * 0.16;
        const a0 = -Math.PI / 2 + (i / segs) * TAU;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, r, a0 + 0.02, a0 + TAU / segs - 0.03);
        ctx.stroke();
      }
      drawDonut(ctx, w / 2, h / 2, r * 0.7, r * 0.08, osc(el, 1, t), ink, u, false);
      ctx.fillStyle = rgba(ink.bright, 0.95);
      ctx.font = `600 ${Math.round(r * 0.42)}px Inter`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${Math.round(frac * 100)}%`, w / 2, h / 2);
      break;
    }
    case "bars": {
      drawFrame(ctx, w, h, ink, u);
      const n = 18 + (el.seed % 20);
      const x0 = w * 0.08;
      const bw = (w * 0.84) / n;
      gridLines(ctx, x0, h * 0.12, w * 0.84, h * 0.76, n / 2, 5, rgba(ink.dim, 0.14), u);
      for (let i = 0; i < n; i++) {
        const v = 0.15 + 0.75 * (0.6 * el.vals[i % el.vals.length] + 0.4 * osc(el, i, t));
        const bh = h * 0.76 * v;
        const g = ctx.createLinearGradient(0, h * 0.88 - bh, 0, h * 0.88);
        g.addColorStop(0, rgba(ink.bright, 0.95));
        g.addColorStop(1, rgba(ink.dim, 0.35));
        ctx.fillStyle = g;
        ctx.fillRect(x0 + i * bw + bw * 0.18, h * 0.88 - bh, bw * 0.64, bh);
      }
      break;
    }
    case "line": {
      drawFrame(ctx, w, h, ink, u);
      gridLines(ctx, w * 0.06, h * 0.1, w * 0.88, h * 0.8, 10, 6, rgba(ink.dim, 0.16), u);
      for (let s = 0; s < 2; s++) {
        ctx.strokeStyle = rgba(s ? ink.dim : ink.bright, s ? 0.7 : 0.95);
        ctx.lineWidth = u * (s ? 1.5 : 2.2);
        ctx.beginPath();
        const N = 60;
        for (let i = 0; i <= N; i++) {
          const x = i / N;
          let y = 0;
          for (let k = 1; k <= 4; k++) y += Math.sin(TAU * (k * x + el.ms[k + s * 4] * t) + el.phs[k + s * 4]) / (k * 1.6);
          const px = w * (0.06 + 0.88 * x);
          const py = h * (0.5 - 0.28 * y + (s ? 0.12 : -0.05));
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      break;
    }
    case "map": {
      // dotted Natural Earth land, equirectangular
      const cols = 110;
      const rows = 46;
      const step = w / cols;
      const dot = step * 0.42;
      ctx.fillStyle = rgba(ink.dim, 0.95);
      for (let j = 0; j < rows; j++) {
        const lat = 80 - (j / (rows - 1)) * 140;
        const my = Math.min(land.h - 1, Math.floor(((90 - lat) / 180) * land.h));
        for (let i = 0; i < cols; i++) {
          const lon = -180 + (i / cols) * 360;
          const mx = Math.floor(((lon + 180) / 360) * land.w);
          if (land.data[my * land.w + mx]) {
            ctx.fillRect(i * step + (step - dot) / 2, (j / rows) * h + (h / rows - dot) / 2, dot, dot);
          }
        }
      }
      // pulsing hot spots
      for (let k = 0; k < 6; k++) {
        const px = w * (0.1 + 0.8 * el.vals[k]);
        const py = h * (0.2 + 0.55 * el.vals[k + 10]);
        const pulse = osc(el, k, t);
        ctx.strokeStyle = rgba(ink.bright, 0.9 * (1 - pulse));
        ctx.lineWidth = u * 1.5;
        ctx.beginPath();
        ctx.arc(px, py, step * (1 + 4 * pulse), 0, TAU);
        ctx.stroke();
        ctx.fillStyle = rgba(ink.bright, 1);
        ctx.beginPath();
        ctx.arc(px, py, step * 0.6, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "hex": {
      ctx.strokeStyle = rgba(ink.bright, 0.85);
      ctx.lineWidth = u * 2.2;
      hexPath(ctx, w / 2, h / 2, m * 0.46);
      ctx.stroke();
      ctx.strokeStyle = rgba(ink.dim, 0.45);
      ctx.lineWidth = u;
      hexPath(ctx, w / 2, h / 2, m * 0.4);
      ctx.stroke();
      // small hex cells inside
      const r = m * 0.06;
      for (let q = -3; q <= 3; q++)
        for (let p = -3; p <= 3; p++) {
          const cx = w / 2 + (p + q * 0.5) * r * 1.8;
          const cy = h / 2 + q * r * 1.56;
          if (Math.hypot(cx - w / 2, cy - h / 2) > m * 0.32) continue;
          ctx.strokeStyle = rgba(ink.dim, 0.18 + 0.5 * el.vals[(p + 3) * 7 + q + 3 < 48 ? (p + 3) * 7 + q + 3 : 0]);
          hexPath(ctx, cx, cy, r * 0.95);
          ctx.stroke();
        }
      break;
    }
    case "radar": {
      const r = m * 0.46;
      ctx.strokeStyle = rgba(ink.dim, 0.5);
      ctx.lineWidth = u;
      for (let k = 1; k <= 4; k++) {
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, (r * k) / 4, 0, TAU);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(w / 2 - r, h / 2);
      ctx.lineTo(w / 2 + r, h / 2);
      ctx.moveTo(w / 2, h / 2 - r);
      ctx.lineTo(w / 2, h / 2 + r);
      ctx.stroke();
      const a = TAU * el.ms[0] * t + el.phs[0];
      if (el.seed % 2 === 0) {
        // plain concentric target: thick bright rings, slowly pulsing
        for (let k = 1; k <= 3; k++) {
          ctx.strokeStyle = rgba(ink.dim, 0.5 + 0.5 * osc(el, k, t));
          ctx.lineWidth = u * (2 + k);
          ctx.beginPath();
          ctx.arc(w / 2, h / 2, (r * k) / 3.3, 0, TAU);
          ctx.stroke();
        }
        break;
      }
      const g = ctx.createConicGradient(a - 1.2, w / 2, h / 2);
      g.addColorStop(0, rgba(ink.bright, 0));
      g.addColorStop(1.2 / TAU, rgba(ink.bright, 0.55));
      g.addColorStop(1.2 / TAU + 0.001, rgba(ink.bright, 0));
      g.addColorStop(1, rgba(ink.bright, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, TAU);
      ctx.fill();
      for (let k = 0; k < 5; k++) {
        const ba = el.vals[k] * TAU;
        const br = r * (0.2 + 0.75 * el.vals[k + 5]);
        // blips light up as the sweep passes
        const since = (((a - ba) % TAU) + TAU) % TAU;
        const lit = Math.exp(-since * 1.5);
        ctx.fillStyle = rgba(ink.bright, 0.25 + 0.75 * lit);
        ctx.beginPath();
        ctx.arc(w / 2 + br * Math.cos(ba), h / 2 + br * Math.sin(ba), u * 3, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "wave": {
      ctx.strokeStyle = rgba(ink.dim, 0.3);
      ctx.lineWidth = u;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      for (let s = 0; s < 3; s++) {
        ctx.strokeStyle = rgba(s === 0 ? ink.bright : ink.dim, s === 0 ? 0.95 : 0.5);
        ctx.lineWidth = u * (s === 0 ? 2 : 1.2);
        ctx.beginPath();
        const N = 120;
        for (let i = 0; i <= N; i++) {
          const x = i / N;
          const env = Math.sin(Math.PI * x);
          let y = 0;
          for (let k = 1; k <= 3; k++) y += Math.sin(TAU * ((2 + k * 3 + s) * x - el.ms[k + s] * 2 * t) + el.phs[k + s * 3]) / k;
          const py = h / 2 - h * 0.32 * env * y * 0.6;
          if (i === 0) ctx.moveTo(x * w, py);
          else ctx.lineTo(x * w, py);
        }
        ctx.stroke();
      }
      break;
    }
    case "numbers": {
      drawFrame(ctx, w, h, ink, u);
      const rows = 7;
      const lh = (h * 0.8) / rows;
      ctx.textBaseline = "middle";
      // values step every 30 frames: 20 steps per loop
      const step = Math.floor(t * 20);
      for (let r = 0; r < rows; r++) {
        const y = h * 0.12 + lh * (r + 0.5);
        const code = CODES[(el.seed + r) % CODES.length];
        ctx.font = `500 ${Math.round(lh * 0.5)}px "JetBrains Mono"`;
        ctx.textAlign = "left";
        ctx.fillStyle = rgba(ink.dim, 0.85);
        ctx.fillText(code, w * 0.07, y);
        const v = Math.floor(100 + 9800 * el.vals[(r * 5 + step) % el.vals.length]);
        ctx.font = `600 ${Math.round(lh * 0.55)}px Inter`;
        ctx.textAlign = "right";
        ctx.fillStyle = rgba(ink.bright, 0.95);
        ctx.fillText(String(v), w * 0.93, y);
      }
      ctx.fillStyle = rgba(ink.bright, 0.5);
      ctx.fillRect(w * 0.07, h * 0.08, w * 0.86 * (0.2 + 0.8 * osc(el, 3, t)), u * 3);
      break;
    }
    case "globe": {
      const r = m * 0.44;
      const cx = w / 2;
      const cy = h / 2;
      const rot = TAU * t + el.phs[0]; // one whole turn per loop
      const tilt = 0.35;
      ctx.strokeStyle = rgba(ink.dim, 0.7);
      ctx.lineWidth = u * 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.stroke();
      // atmosphere
      const atm = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.12);
      atm.addColorStop(0, rgba(ink.dim, 0));
      atm.addColorStop(0.6, rgba(ink.dim, 0.25));
      atm.addColorStop(1, rgba(ink.dim, 0));
      ctx.fillStyle = atm;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.12, 0, TAU);
      ctx.fill();
      const proj = (lat: number, lon: number): [number, number, number] => {
        const la = (lat * Math.PI) / 180;
        const lo = (lon * Math.PI) / 180 + rot;
        let x = Math.cos(la) * Math.sin(lo);
        let y = Math.sin(la);
        let z = Math.cos(la) * Math.cos(lo);
        const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
        const z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
        y = y2;
        z = z2;
        return [cx + r * x, cy - r * y, z];
      };
      // graticule
      ctx.lineWidth = u;
      for (let lon = 0; lon < 360; lon += 20) {
        ctx.strokeStyle = rgba(ink.dim, 0.35);
        ctx.beginPath();
        let pen = false;
        for (let lat = -90; lat <= 90; lat += 6) {
          const [x, y, z] = proj(lat, lon);
          if (z < 0) {
            pen = false;
            continue;
          }
          if (!pen) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          pen = true;
        }
        ctx.stroke();
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.strokeStyle = rgba(ink.dim, 0.35);
        ctx.beginPath();
        let pen = false;
        for (let lon = 0; lon <= 360; lon += 6) {
          const [x, y, z] = proj(lat, lon);
          if (z < 0) {
            pen = false;
            continue;
          }
          if (!pen) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          pen = true;
        }
        ctx.stroke();
      }
      // land dots
      const dot = Math.max(1, r * 0.022);
      for (let lat = -84; lat <= 84; lat += 3) {
        const my = Math.floor(((90 - lat) / 180) * land.h);
        const stepLon = 3 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
        for (let lon = -180; lon < 180; lon += stepLon) {
          const mx = Math.floor(((lon + 180) / 360) * land.w) % land.w;
          if (!land.data[my * land.w + mx]) continue;
          const [x, y, z] = proj(lat, lon);
          if (z < 0.05) continue;
          ctx.fillStyle = rgba(ink.bright, 0.35 + 0.65 * z);
          ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
        }
      }
      break;
    }
    case "panel": {
      // hard-edged translucent block: the patchwork wall behind everything
      ctx.fillStyle = rgba(ink.dim, 0.012 + 0.025 * el.vals[0]);
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = rgba(ink.dim, 0.3);
      ctx.lineWidth = u;
      ctx.strokeRect(u / 2, u / 2, w - u, h - u);
      gridLines(ctx, 0, 0, w, h, 24, Math.round(24 * el.aspect), rgba(ink.dim, 0.07), u * 0.7);
      ctx.fillStyle = rgba(ink.dim, 0.35);
      ctx.fillRect(0, 0, w, h * 0.06);
      ctx.font = `500 ${Math.round(h * 0.035)}px "JetBrains Mono"`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      for (let r = 0; r < 6; r++) {
        ctx.fillStyle = rgba(ink.dim, 0.25 + 0.3 * el.vals[r + 20]);
        ctx.fillText(`${CODES[(el.seed + r) % CODES.length]} ${Math.floor(el.vals[r + 30] * 9000 + 1000)}`, w * 0.04, h * (0.1 + r * 0.055));
      }
      break;
    }
    case "specks": {
      const n = 60;
      for (let k = 0; k < n; k++) {
        const x = (((el.vals[k % 48] * 7.31 + k * 0.618) % 1) * w);
        const y = (((el.vals[(k * 7) % 48] * 3.17 + k * 0.382) % 1) * h);
        const tw = 0.4 + 0.6 * osc(el, k, t);
        ctx.fillStyle = rgba(k % 5 ? ink.dim : ink.bright, 0.5 + 0.5 * tw);
        const sz = u * (1 + 2.5 * el.vals[(k * 3) % 48]);
        if (k % 7 === 0) {
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = u;
          ctx.strokeRect(x, y, sz * 3, sz * 3);
        } else ctx.fillRect(x, y, sz, sz);
      }
      break;
    }
    case "grid": {
      gridLines(ctx, 0, 0, w, h, 16, Math.round(16 * el.aspect), rgba(ink.dim, 0.16), u);
      ctx.strokeStyle = rgba(ink.dim, 0.5);
      ctx.lineWidth = u * 1.5;
      for (let k = 0; k < 3; k++) {
        const x = w * el.vals[k] * 0.7;
        const y = h * el.vals[k + 3] * 0.7;
        ctx.strokeRect(x, y, w * (0.12 + 0.2 * el.vals[k + 6]), h * (0.12 + 0.2 * el.vals[k + 9]));
      }
      ctx.font = `500 ${Math.round(h * 0.06)}px "JetBrains Mono"`;
      ctx.fillStyle = rgba(ink.dim, 0.6);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${CODES[el.seed % CODES.length]}-${(el.seed % 9000) + 1000}`, w * 0.03, h * 0.03);
      break;
    }
  }
  ctx.globalCompositeOperation = "source-over";
};
