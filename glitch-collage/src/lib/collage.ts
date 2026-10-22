import type { Palette, RGB } from "./palettes";
import {
  chance,
  irange,
  makeFbm,
  mulberry32,
  pick,
  range,
  type Rng,
} from "./random";

// All layout is authored in a 1920x1080 design space and scaled to the
// composition size, so the 4K render keeps hairlines and glyphs crisp.
const U = 1920;
const V = 1080;

// Internal resolution of the procedural grunge texture.
const TW = 1280;
const TH = 720;

const MONO = "'DejaVu Sans Mono', 'Liberation Mono', 'Courier New', monospace";
const GLYPHS = "0123456789ABCDEFHKXYZ#%+-:/.<>[]=";
const LABELS = [
  "3E-04",
  "0x1F",
  "ICS 0080",
  "SYS.04",
  "RX 12.7",
  "N 0.553",
  "08:41:07",
  "ERR 503",
  "T-0019",
  "LAT 33.9",
  "CH 2",
  "#A03",
];

type Mode = "dense" | "sparse" | "halftone";

type Panel = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  bright: number;
  holeThr: number;
  rough: number;
  soft: number;
  cell: number;
};

type Block = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  mul: number;
  mesh: boolean;
};

type Streak = { y0: number; y1: number; x0: number; x1: number; lum: number };

type Shot = {
  mode: Mode;
  cx: number;
  pw: number;
  panels: Panel[];
  blocks: Block[];
  streaks: Streak[];
  camX: number;
  camY: number;
  zoom: number;
};

const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

const planShot = (rng: Rng): Shot => {
  const roll = rng();
  const mode: Mode = roll < 0.5 ? "dense" : roll < 0.75 ? "halftone" : "sparse";
  const cx = range(rng, 0.47, 0.54);
  const pw =
    mode === "sparse" ? range(rng, 0.2, 0.28) : range(rng, 0.26, 0.34);
  const panels: Panel[] = [];
  // Dim, textured full-height strips fill the field around the main panel
  const nBg = irange(rng, 4, 7);
  for (let i = 0; i < nBg; i++) {
    const w = range(rng, 0.04, 0.16);
    // first one or two always land in the left third, the rest mostly right
    const x = i < 2 ? range(rng, 0.04, 0.3) : chance(rng, 0.75) ? range(rng, cx, 0.98) : range(rng, 0.12, cx);
    panels.push({
      x0: x - w / 2,
      x1: x + w / 2,
      y0: chance(rng, 0.7) ? -0.2 : range(rng, 0, 0.4),
      y1: 1.2,
      bright: range(rng, 0.12, 0.22),
      holeThr: range(rng, 0.12, 0.24),
      rough: range(rng, 0.002, 0.006),
      soft: range(rng, 0.001, 0.003),
      cell: 1,
    });
  }
  // Main panel: 2-4 overlapping hard-edged vertical strips of differing grey
  const nStrips = irange(rng, 2, 4);
  const left = cx - pw / 2;
  const fullHeight = chance(rng, 0.75);
  for (let i = 0; i < nStrips; i++) {
    const w = range(rng, pw * 0.4, pw * 0.75);
    const x0 = left + range(rng, 0, pw - w);
    panels.push({
      x0,
      x1: x0 + w,
      y0: fullHeight ? -0.2 : range(rng, -0.2, 0.25),
      y1: fullHeight ? 1.2 : range(rng, 0.75, 1.2),
      bright:
        mode === "sparse" ? range(rng, 0.45, 0.7) : range(rng, 0.68, 1.05),
      holeThr: mode === "halftone" ? range(rng, 0.24, 0.32) : range(rng, 0.18, 0.3),
      rough: range(rng, 0.003, 0.012),
      soft: range(rng, 0.0015, 0.004),
      cell: chance(rng, 0.4) ? irange(rng, 2, 5) : 1,
    });
  }
  // A mid-grey strip hugging the left edge widens the lit region
  panels.push({
    x0: left - range(rng, 0.0, 0.03),
    x1: left + range(rng, 0.06, 0.12),
    y0: -0.2,
    y1: 1.2,
    bright: range(rng, 0.4, 0.6),
    holeThr: range(rng, 0.2, 0.3),
    rough: range(rng, 0.003, 0.01),
    soft: range(rng, 0.0015, 0.004),
    cell: 1,
  });
  const main = { x0: left, x1: left + pw };
  // Rectangular data blocks inside the panel that brighten or darken it
  const blocks: Block[] = [];
  const nb = irange(rng, 2, 7);
  for (let i = 0; i < nb; i++) {
    const w = range(rng, 0.02, pw * 0.8);
    const h = range(rng, 0.01, 0.25);
    const x = cx + range(rng, -pw * 0.6, pw * 0.6 - w);
    const y = range(rng, 0, 1 - h);
    blocks.push({
      x0: x,
      x1: x + w,
      y0: y,
      y1: y + h,
      mul: chance(rng, 0.4) ? range(rng, 0.3, 0.6) : range(rng, 1.1, 1.4),
      mesh: chance(rng, 0.35),
    });
  }
  const streaks: Streak[] = [];
  const ns = irange(rng, 1, 4);
  for (let i = 0; i < ns; i++) {
    const y = rng();
    const h = range(rng, 0.0015, 0.008);
    const toLeft = chance(rng, 0.5);
    const len = range(rng, 0.05, 0.3);
    streaks.push({
      y0: y,
      y1: y + h,
      x0: toLeft ? main.x0 - len : main.x0 + range(rng, 0, pw),
      x1: toLeft ? main.x0 + range(rng, 0, pw) : main.x1 + len,
      lum: range(rng, 0.12, 0.45),
    });
  }
  return {
    mode,
    cx,
    pw,
    panels,
    blocks,
    streaks,
    camX: range(rng, -40, 40),
    camY: range(rng, -24, 24),
    zoom: range(rng, 1.0, 1.1),
  };
};

const buildPanelTexture = (rng: Rng, shot: Shot, palette: Palette) => {
  const canvas = makeCanvas(TW, TH);
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(TW, TH);
  const data = img.data;

  const edge = makeFbm(rng, 3, 14, 4);
  const tone = makeFbm(rng, 10, 7, 4);
  const holes = makeFbm(rng, 18, 12, 4);
  const grit = makeFbm(rng, 90, 50, 2);
  // Strongly anisotropic noise: thin vertical scratches and streaks
  const scratch = makeFbm(rng, 260, 3, 2);
  // Per-pixel white noise dithers every threshold into a sprayed, speckled edge
  const hash = new Float32Array(TW * TH);
  for (let i = 0; i < hash.length; i++) hash[i] = rng();

  // Per-row bands: scanline tone and the horizontal tearing of panel edges
  const rowN = new Float32Array(TH);
  const rowJag = new Float32Array(TH);
  let band = 0;
  let jag = 0;
  for (let y = 0; y < TH; y++) {
    if (y % irange(rng, 2, 9) === 0) band = rng();
    if (chance(rng, 0.04)) jag = chance(rng, 0.5) ? 0 : (rng() - 0.5) * 2;
    rowN[y] = band;
    rowJag[y] = jag;
  }
  const colN = new Float32Array(TW);
  for (let x = 0; x < TW; x++) colN[x] = rng();

  const [pr, pg, pb] = palette.panel;
  const { panels, streaks, blocks } = shot;
  const aspect = TH / TW;

  for (let y = 0; y < TH; y++) {
    const v = y / TH;
    const rowMesh = y % 3 === 0 ? 0.82 : 1;
    for (let x = 0; x < TW; x++) {
      const u = x / TW;
      let lum = 0;
      let alpha = 0;
      const hz = hash[y * TW + x];

      for (let i = 0; i < panels.length; i++) {
        const p = panels[i];
        const ju = u + rowJag[y] * p.rough;
        if (ju < p.x0 - p.rough || ju > p.x1 + p.rough) continue;
        const dx = Math.min(ju - p.x0, p.x1 - ju);
        const dy = Math.min(v - p.y0, p.y1 - v) * aspect * 1.6;
        const d = Math.min(dx, dy);
        const e = d + (edge(u, v) - 0.5) * p.rough + (hz - 0.5) * p.soft * 3;
        const m = clamp01(e / p.soft);
        if (m <= 0) continue;
        const gr = grit(u, v);
        let l =
          p.bright * (0.66 + (tone(u, v) - 0.5) * 1.1 + (gr - 0.5) * 0.8) *
            (0.84 + 0.32 * colN[x]) +
          (p.bright > 0.3 ? (rowN[y] - 0.5) * 0.12 : 0);
        const sc = scratch(u, v);
        l *= 0.55 + 0.9 * sc * sc + (sc > 0.72 ? 0.5 : 0);
        // the reference brightens toward the bottom of frame
        l *= 0.72 + 0.5 * v;
        // Holes sampled on a coarse grid read as digital, blocky damage
        const qx = Math.floor(x / p.cell) * p.cell;
        const qy = Math.floor(y / p.cell) * p.cell;
        const hv = holes(qx / TW, qy / TH) + (hz - 0.5) * 0.1 + (gr - 0.5) * 0.16;
        const h = smoothstep(p.holeThr - 0.02, p.holeThr + 0.02, hv);
        l *= p.bright > 0.3 ? 0.05 + 0.95 * h : 0.55 + 0.45 * h;
        if (hz > 0.985) l *= 1.6;
        else if (hz < 0.02) l *= 0.15;
        if (p.bright > 0.2) l *= rowMesh * (x % 3 === 0 ? 0.86 : 1);
        lum = lum * (1 - m) + l * m;
        alpha = alpha + m * (1 - alpha);
      }

      if (alpha > 0) {
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          if (u < b.x0 || u > b.x1 || v < b.y0 || v > b.y1) continue;
          lum *= b.mul;
          if (b.mesh && (x % 4 === 0 || y % 4 === 0)) lum *= 0.45;
        }
      }

      for (let i = 0; i < streaks.length; i++) {
        const s = streaks[i];
        if (v < s.y0 || v > s.y1 || u < s.x0 || u > s.x1) continue;
        const fade = Math.min((u - s.x0) / 0.04, (s.x1 - u) / 0.04, 1);
        const a = clamp01(fade) * 0.7 * (hz > 0.25 ? 1 : 0.2);
        lum = lum * (1 - a) + s.lum * (0.7 + 0.6 * colN[x]) * a;
        alpha = alpha + a * (1 - alpha);
      }

      if (alpha <= 0) continue;
      const k = (y * TW + x) * 4;
      const L = lum < 0 ? 0 : lum > 1.15 ? 1.15 : lum;
      data[k] = pr * L;
      data[k + 1] = pg * L;
      data[k + 2] = pb * L;
      data[k + 3] = alpha * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};

let grainTile: HTMLCanvasElement | null = null;
const getGrainTile = () => {
  if (grainTile) return grainTile;
  const size = 512;
  grainTile = makeCanvas(size, size);
  const ctx = grainTile.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const rng = mulberry32(1337);
  for (let i = 0; i < size * size; i++) {
    const g = 128 + (rng() + rng() + rng() - 1.5) * 120;
    img.data[i * 4] = g;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return grainTile;
};

const drawBackground = (ctx: CanvasRenderingContext2D, rng: Rng, p: Palette) => {
  const g = ctx.createLinearGradient(0, 0, U, 0);
  g.addColorStop(0, rgba(p.bgDeep, 1));
  g.addColorStop(0.18, rgba(p.bgDeep, 1));
  g.addColorStop(0.5, rgba(mix(p.bgDeep, p.bgLift, 0.7), 1));
  g.addColorStop(1, rgba(p.bgLift, 1));
  ctx.fillStyle = g;
  ctx.fillRect(-200, -200, U + 400, V + 400);

  // Translucent slabs: mostly right of center, a couple with a diagonal cut
  const n = irange(rng, 2, 5);
  for (let i = 0; i < n; i++) {
    const x = range(rng, 0.3, 0.95) * U;
    const y = range(rng, -0.2, 0.6) * V;
    const w = range(rng, 0.08, 0.3) * U;
    const h = range(rng, 0.3, 1.0) * V;
    const sg = ctx.createLinearGradient(0, y, 0, y + h);
    const a = range(rng, 0.2, 0.55);
    sg.addColorStop(0, rgba(p.slab, a * 0.4));
    sg.addColorStop(0.5, rgba(p.slab, a));
    sg.addColorStop(1, rgba(p.slab, a * 0.3));
    ctx.fillStyle = sg;
    ctx.beginPath();
    if (chance(rng, 0.35)) {
      const cut = range(rng, 0.2, 0.7) * w;
      ctx.moveTo(x + cut, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + h * range(rng, 0.2, 0.5));
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.closePath();
    ctx.fill();
  }
};

const drawHalftone = (
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  shot: Shot,
  p: Palette,
  strong: boolean,
) => {
  const field = makeFbm(rng, 4, 3, 3);
  const x0 = (shot.cx - shot.pw * range(rng, 0.4, 0.7)) * U;
  const x1 = x0 + range(rng, 0.15, 0.4) * U;
  const y0 = range(rng, 0.2, 0.6) * V;
  const y1 = Math.min(V, y0 + range(rng, 0.15, 0.45) * V);
  const step = range(rng, 9, 15);
  const maxR = step * (strong ? 0.55 : 0.4);
  ctx.fillStyle = rgba(p.void, strong ? 0.75 : 0.5);
  for (let y = y0; y < y1; y += step) {
    const stretch = chance(rng, 0.3) ? range(rng, 1.5, 3) : 1;
    for (let x = x0; x < x1; x += step) {
      const n = field(x / U, y / V) * 1.7 - 0.45;
      const r = maxR * clamp01(n);
      if (r < 0.8) continue;
      ctx.beginPath();
      ctx.ellipse(x, y, r * stretch, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

const drawLightDots = (ctx: CanvasRenderingContext2D, rng: Rng, p: Palette) => {
  const x0 = range(rng, 0.45, 0.8) * U;
  const y0 = range(rng, 0.05, 0.7) * V;
  const cols = irange(rng, 4, 14);
  const rows = irange(rng, 4, 18);
  const step = range(rng, 7, 12);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (chance(rng, 0.35)) continue;
      ctx.fillStyle = rgba(p.ink, range(rng, 0.25, 0.75));
      const s = range(rng, 1.5, 3.2);
      ctx.fillRect(x0 + i * step, y0 + j * step, s, s);
    }
  }
};

const drawSplats = (ctx: CanvasRenderingContext2D, rng: Rng, shot: Shot, p: Palette) => {
  const n = irange(rng, 0, 3);
  ctx.fillStyle = rgba(p.void, 0.92);
  for (let i = 0; i < n; i++) {
    const cx = (shot.cx + range(rng, -shot.pw / 2, shot.pw / 2)) * U;
    const cy = range(rng, 0.05, 0.95) * V;
    const r = range(rng, 4, 22);
    const pts = 14;
    ctx.beginPath();
    for (let k = 0; k < pts; k++) {
      const a = (k / pts) * Math.PI * 2;
      const rr = r * range(rng, 0.45, 1.35);
      const px = cx + Math.cos(a) * rr * range(rng, 1, 1.8);
      const py = cy + Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
};

const drawHairlines = (ctx: CanvasRenderingContext2D, rng: Rng, shot: Shot, p: Palette) => {
  const nh = irange(rng, 4, shot.mode === "sparse" ? 14 : 10);
  for (let i = 0; i < nh; i++) {
    const y = Math.round(range(rng, 0.03, 0.97) * V) + 0.5;
    const x0 = range(rng, 0.05, 0.55) * U;
    const x1 = x0 + range(rng, 0.08, 0.6) * U;
    ctx.strokeStyle = rgba(p.ink, range(rng, 0.12, 0.55));
    ctx.lineWidth = range(rng, 0.7, 1.3);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }
  const nv = irange(rng, 3, 8);
  for (let i = 0; i < nv; i++) {
    const x = Math.round(range(rng, 0.1, 0.92) * U) + 0.5;
    const y0 = range(rng, -0.1, 0.5) * V;
    const y1 = y0 + range(rng, 0.2, 1.1) * V;
    ctx.strokeStyle = rgba(p.ink, range(rng, 0.1, 0.5));
    ctx.lineWidth = range(rng, 0.7, 1.4);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
  }
  const nc = irange(rng, 0, 2);
  for (let i = 0; i < nc; i++) {
    const x = range(rng, 0.2, 0.9) * U;
    const y = range(rng, 0.1, 0.9) * V;
    const s = range(rng, 4, 10);
    ctx.strokeStyle = rgba(p.ink, range(rng, 0.5, 0.9));
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x + s, y);
    ctx.moveTo(x, y - s);
    ctx.lineTo(x, y + s);
    ctx.stroke();
  }
  if (chance(rng, 0.35)) {
    const x = range(rng, 0.45, 0.85) * U;
    const y = range(rng, 0.1, 0.8) * V;
    const len = range(rng, 80, 260);
    const a = range(rng, -0.6, -0.15);
    ctx.strokeStyle = rgba(p.ink, range(rng, 0.25, 0.6));
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
};

const drawTickColumn = (
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  x: number,
  color: RGB,
  dense: boolean,
) => {
  let y = range(rng, -20, 60);
  const end = range(rng, 0.6, 1.1) * V;
  const step = dense ? range(rng, 5, 8) : range(rng, 10, 18);
  while (y < end) {
    if (!chance(rng, 0.2)) {
      ctx.fillStyle = rgba(color, range(rng, 0.25, 0.9));
      ctx.fillRect(x, y, range(rng, 2, dense ? 4 : 8), range(rng, 1, 2.2));
    }
    y += step * (chance(rng, 0.1) ? range(rng, 2, 5) : 1);
  }
};

const drawGlyphColumns = (ctx: CanvasRenderingContext2D, rng: Rng, shot: Shot, p: Palette) => {
  const n = irange(rng, 2, 6);
  for (let i = 0; i < n; i++) {
    const nearPanel = chance(rng, 0.6);
    const x = nearPanel
      ? (shot.cx + range(rng, -shot.pw * 0.7, shot.pw * 0.7)) * U
      : range(rng, 0.06, 0.95) * U;
    const red = chance(rng, 0.15);
    const big = chance(rng, 0.3);
    const size = red || big ? range(rng, 22, 42) : range(rng, 9, 17);
    const color = red ? p.accent : p.ink;
    let y = range(rng, 0, 0.5) * V;
    const count = irange(rng, 3, 14);
    ctx.font = `${size}px ${MONO}`;
    ctx.textBaseline = "top";
    for (let k = 0; k < count; k++) {
      ctx.fillStyle = rgba(color, range(rng, 0.35, 0.95));
      ctx.fillText(pick(rng, GLYPHS.split("")), x, y);
      y += size * range(rng, 1.15, 2.2);
    }
  }
  const nl = irange(rng, 0, 2);
  for (let i = 0; i < nl; i++) {
    const size = range(rng, 10, 15);
    ctx.font = `${size}px ${MONO}`;
    ctx.fillStyle = rgba(chance(rng, 0.2) ? p.accent : p.ink, range(rng, 0.4, 0.85));
    ctx.fillText(pick(rng, LABELS), range(rng, 0.08, 0.85) * U, range(rng, 0.05, 0.95) * V);
  }
};

const drawAccents = (ctx: CanvasRenderingContext2D, rng: Rng, shot: Shot, p: Palette) => {
  const n = irange(rng, 0, 4);
  for (let i = 0; i < n; i++) {
    const y = Math.round(range(rng, 0.15, 0.95) * V) + 0.5;
    const x0 = (shot.cx + range(rng, -0.25, 0)) * U;
    const x1 = x0 + range(rng, 0.08, 0.45) * U;
    ctx.strokeStyle = rgba(p.accent, range(rng, 0.45, 0.9));
    ctx.lineWidth = range(rng, 0.9, 1.6);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }
  if (chance(rng, 0.3)) {
    const x = range(rng, 0.2, 0.6) * U;
    const y0 = range(rng, -0.1, 0.3) * V;
    ctx.fillStyle = rgba(p.accent, range(rng, 0.65, 0.95));
    ctx.fillRect(x, y0, range(rng, 2, 3.5), range(rng, 0.4, 0.95) * V);
  }
  if (chance(rng, 0.45)) {
    drawTickColumn(ctx, rng, range(rng, 0.08, 0.6) * U, p.accent, true);
  }
  const sq = irange(rng, 0, 4);
  for (let i = 0; i < sq; i++) {
    ctx.fillStyle = rgba(p.accent, range(rng, 0.6, 1));
    const s = range(rng, 3, 9);
    ctx.fillRect(range(rng, 0.05, 0.9) * U, range(rng, 0.05, 0.95) * V, s, s);
  }
};

const drawBoxes = (ctx: CanvasRenderingContext2D, rng: Rng, p: Palette) => {
  const n = irange(rng, 1, 5);
  for (let i = 0; i < n; i++) {
    const w = range(rng, 8, 40);
    const h = range(rng, 8, 30);
    ctx.strokeStyle = rgba(p.ink, range(rng, 0.35, 0.8));
    ctx.lineWidth = range(rng, 0.8, 1.5);
    ctx.strokeRect(
      Math.round(range(rng, 0.1, 0.9) * U) + 0.5,
      Math.round(range(rng, 0.05, 0.95) * V) + 0.5,
      w,
      h,
    );
  }
  // Cluster of tiny filled cells, like a chip pinout
  if (chance(rng, 0.55)) {
    const x0 = range(rng, 0.5, 0.85) * U;
    const y0 = range(rng, 0.1, 0.7) * V;
    const cols = irange(rng, 2, 6);
    const rows = irange(rng, 4, 14);
    const s = range(rng, 4, 7);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (chance(rng, 0.45)) continue;
        ctx.fillStyle = rgba(p.ink, range(rng, 0.5, 0.95));
        ctx.fillRect(x0 + i * s * 1.8, y0 + j * s * 1.8, s, s);
      }
    }
  }
  // Rare bright UI tile
  if (chance(rng, 0.12)) {
    const x = range(rng, 0.2, 0.45) * U;
    const y = range(rng, 0.65, 0.88) * V;
    const w = range(rng, 60, 90);
    const h = w * 0.45;
    ctx.fillStyle = rgba(p.ink, 0.88);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = rgba(p.void, 0.9);
    for (let k = 1; k < 4; k++) ctx.fillRect(x + 6, y + (h / 4) * k - 1, w - 12, 2);
  }
};

// Pen-like scratches, drips and streaks across the bright panel
const drawScratches = (ctx: CanvasRenderingContext2D, rng: Rng, shot: Shot, p: Palette) => {
  const n = irange(rng, 12, 40);
  const x0 = (shot.cx - shot.pw / 2) * U;
  const w = shot.pw * U;
  for (let i = 0; i < n; i++) {
    const dark = chance(rng, 0.6);
    let x = x0 + rng() * w;
    let y = range(rng, -0.1, 0.8) * V;
    const len = range(rng, 0.1, 1.0) * V;
    const end = y + len;
    ctx.strokeStyle = dark ? rgba(p.void, range(rng, 0.35, 0.85)) : rgba(p.ink, range(rng, 0.2, 0.6));
    ctx.lineWidth = range(rng, 0.6, dark ? 2.2 : 1.4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (y < end) {
      y += range(rng, 6, 30);
      x += range(rng, -1.2, 1.2);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (dark && chance(rng, 0.25)) {
      ctx.fillStyle = rgba(p.void, 0.85);
      ctx.beginPath();
      ctx.ellipse(x, y, range(rng, 1.5, 4), range(rng, 2.5, 7), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

// Short horizontal rules, dash ladders and typewriter rows
const drawHorizontalMarks = (ctx: CanvasRenderingContext2D, rng: Rng, p: Palette) => {
  const n = irange(rng, 10, 30);
  for (let i = 0; i < n; i++) {
    const x = range(rng, 0.05, 0.9) * U;
    const y = Math.round(range(rng, 0.03, 0.97) * V) + 0.5;
    const len = range(rng, 30, 200);
    ctx.strokeStyle = rgba(p.ink, range(rng, 0.45, 0.8));
    ctx.lineWidth = range(rng, 0.8, 1.4);
    if (chance(rng, 0.35)) ctx.setLineDash([range(rng, 2, 6), range(rng, 2, 6)]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const rows = irange(rng, 1, 3);
  for (let i = 0; i < rows; i++) {
    const size = range(rng, 11, 22);
    ctx.font = `${size}px ${MONO}`;
    ctx.textBaseline = "top";
    ctx.fillStyle = rgba(p.ink, range(rng, 0.45, 0.85));
    let str = "";
    for (let k = irange(rng, 3, 9); k > 0; k--) str += pick(rng, GLYPHS.split(""));
    ctx.fillText(chance(rng, 0.5) ? str : pick(rng, ["011 SEP", "0 1", "04 OCT", "A-17", "N°08"]), range(rng, 0.1, 0.8) * U, range(rng, 0.05, 0.92) * V);
  }
};

const drawHexGrid = (ctx: CanvasRenderingContext2D, rng: Rng, p: Palette) => {
  const r = range(rng, 18, 34);
  const x0 = range(rng, 0.5, 0.75) * U;
  const y0 = range(rng, 0.1, 0.6) * V;
  const cols = irange(rng, 3, 7);
  const rows = irange(rng, 3, 8);
  ctx.strokeStyle = rgba(p.ink, range(rng, 0.1, 0.22));
  ctx.lineWidth = 1;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (chance(rng, 0.2)) continue;
      const cx = x0 + i * r * 1.5;
      const cy = y0 + j * r * Math.sqrt(3) + (i % 2) * r * (Math.sqrt(3) / 2);
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
};

// Stronger crimson moments: glowing dashed bars and red glyph stacks
const drawRedFeature = (ctx: CanvasRenderingContext2D, rng: Rng, shot: Shot, p: Palette) => {
  ctx.save();
  ctx.shadowColor = rgba(p.accent, 0.9);
  ctx.shadowBlur = 10;
  const dashColumn = (x: number, w: number) => {
    let y = range(rng, -0.05, 0.4) * V;
    const end = y + range(rng, 0.3, 0.9) * V;
    while (y < end) {
      const h = range(rng, 4, 16);
      ctx.fillStyle = rgba(p.accent, range(rng, 0.55, 0.95));
      ctx.fillRect(x + range(rng, -1, 1), y, w * range(rng, 0.6, 1), h);
      y += h + range(rng, 3, 14);
    }
  };
  if (chance(rng, 0.6)) dashColumn((shot.cx + range(rng, -shot.pw * 0.4, shot.pw * 0.4)) * U, range(rng, 6, 10));
  if (chance(rng, 0.5)) dashColumn(range(rng, 0.08, 0.2) * U, range(rng, 5, 9));
  if (chance(rng, 0.4)) {
    const size = range(rng, 22, 38);
    ctx.font = `${size}px ${MONO}`;
    ctx.textBaseline = "top";
    let y = range(rng, 0.05, 0.4) * V;
    const x = (shot.cx + range(rng, -shot.pw * 0.6, shot.pw * 0.6)) * U;
    for (let k = irange(rng, 3, 7); k > 0; k--) {
      ctx.fillStyle = rgba(p.accent, range(rng, 0.6, 0.95));
      ctx.fillText(pick(rng, GLYPHS.split("")), x, y);
      y += size * range(rng, 1.1, 1.5);
    }
  }
  ctx.restore();
};

const drawPost = (
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  canvas: HTMLCanvasElement,
  p: Palette,
) => {
  // Left edge falls to black, broad vignette elsewhere
  const left = ctx.createLinearGradient(0, 0, U * 0.3, 0);
  left.addColorStop(0, rgba(p.bgDeep, 0.8));
  left.addColorStop(0.3, rgba(p.bgDeep, 0.4));
  left.addColorStop(1, rgba(p.bgDeep, 0));
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, U, V);
  const vg = ctx.createRadialGradient(U * 0.5, V * 0.55, U * 0.25, U * 0.5, V * 0.55, U * 0.78);
  vg.addColorStop(0, rgba(p.bgDeep, 0));
  vg.addColorStop(1, rgba(p.bgDeep, 0.5));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, U, V);
  const top = ctx.createLinearGradient(0, 0, 0, V * 0.45);
  top.addColorStop(0, rgba(p.bgDeep, 0.45));
  top.addColorStop(1, rgba(p.bgDeep, 0));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, U, V);

  // Glitch: a few horizontal strips displaced sideways
  const strips = irange(rng, 1, 4);
  const sx = canvas.width / U;
  for (let i = 0; i < strips; i++) {
    const y = range(rng, 0, V);
    const h = range(rng, 2, 14);
    const dx = range(rng, -30, 30);
    ctx.drawImage(canvas, 0, y * sx, canvas.width, h * sx, dx, y, U, h);
  }

  // Film grain
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.16;
  const pat = ctx.createPattern(getGrainTile(), "repeat")!;
  ctx.translate(range(rng, 0, 512), range(rng, 0, 512));
  ctx.fillStyle = pat;
  ctx.fillRect(-512, -512, U + 1024, V + 1024);
  ctx.restore();
};

export type CollageOptions = {
  width: number;
  height: number;
  index: number;
  seed: number;
  palette: Palette;
};

export const renderCollage = (canvas: HTMLCanvasElement, o: CollageOptions) => {
  const ctx = canvas.getContext("2d")!;
  const rng = mulberry32(o.seed * 1000003 + o.index * 7919 + 17);
  const shot = planShot(rng);
  const s = o.width / U;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, o.width, o.height);
  ctx.scale(s, (o.height / V));

  ctx.save();
  // Per-shot camera framing (each held image is a slightly different crop)
  ctx.translate(U / 2 + shot.camX, V / 2 + shot.camY);
  ctx.scale(shot.zoom, shot.zoom);
  ctx.translate(-U / 2, -V / 2);

  drawBackground(ctx, rng, o.palette);

  const tex = buildPanelTexture(rng, shot, o.palette);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(tex, 0, 0, U, V);

  // Cheap bloom: downsample + blur + add back
  const small = makeCanvas(240, 135);
  const sctx = small.getContext("2d")!;
  sctx.filter = "blur(6px)";
  sctx.drawImage(tex, 0, 0, 240, 135);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.32;
  ctx.drawImage(small, 0, 0, U, V);
  ctx.restore();

  drawScratches(ctx, rng, shot, o.palette);
  if (shot.mode === "halftone") drawHalftone(ctx, rng, shot, o.palette, true);
  else if (chance(rng, 0.3)) drawHalftone(ctx, rng, shot, o.palette, false);
  if (chance(rng, 0.3)) drawHexGrid(ctx, rng, o.palette);
  drawHorizontalMarks(ctx, rng, o.palette);
  if (chance(rng, 0.5)) drawLightDots(ctx, rng, o.palette);
  drawSplats(ctx, rng, shot, o.palette);
  drawHairlines(ctx, rng, shot, o.palette);
  drawTickColumn(ctx, rng, range(rng, 0.09, 0.14) * U, o.palette.ink, false);
  if (chance(rng, 0.5)) drawTickColumn(ctx, rng, range(rng, 0.15, 0.3) * U, o.palette.ink, false);
  drawGlyphColumns(ctx, rng, shot, o.palette);
  drawAccents(ctx, rng, shot, o.palette);
  drawBoxes(ctx, rng, o.palette);
  if (chance(rng, 0.38)) drawRedFeature(ctx, rng, shot, o.palette);
  ctx.restore();

  drawPost(ctx, rng, canvas, o.palette);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
};
