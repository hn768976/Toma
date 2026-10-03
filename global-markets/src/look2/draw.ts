import { WorldData } from "../common/assets";
import { HEIGHT, LOOP, WIDTH } from "../common/constants";
import { CandlePalette } from "../common/palettes";
import { at, hash3 } from "../common/random";
import { AREA, AREA_SP, CANDLE_SP, CANDLES, N_CANDLES, PRICE_HI, PRICE_LO, SCROLL, TICKERS, tickerAt } from "./data";

// Canvas 2D renderer for Candle Chart Flow. Every call redraws the whole frame
// from `frame` alone. Coordinates are in 4K space (3840×2160); `dpr` maps them
// to the actual canvas size.

const W = WIDTH;
const H = HEIGHT;
const TAU = Math.PI * 2;
const X_EDGE = 3000; // where new candles form
const CHART_CY = 1010; // vertical centre of the candle chart
const CHART_RANGE = 900; // px for value 0..1
const FLARE_Y = 1010;
const FLARE_X = 3020;

const priceY = (v: number) => CHART_CY + (0.5 - v) * CHART_RANGE;
const priceOf = (v: number) => PRICE_LO + v * (PRICE_HI - PRICE_LO);

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export type Layers = {
  map: HTMLCanvasElement; // pre-rendered dotted map (static)
  glow: HTMLCanvasElement; // scratch layer for glows
};

/** Dotted world map, drawn once per palette/size. Deterministic. */
export const buildMapLayer = (world: WorldData, p: CandlePalette, dpr: number) => {
  const c = document.createElement("canvas");
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  // land mask at low resolution
  const mw = 720;
  const mh = 360;
  const mask = document.createElement("canvas");
  mask.width = mw;
  mask.height = mh;
  const m = mask.getContext("2d", { willReadFrequently: true })!;
  m.fillStyle = "#000";
  m.fillRect(0, 0, mw, mh);
  m.fillStyle = "#fff";
  m.beginPath();
  for (const poly of world.land) {
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * mw;
        const y = ((90 - lat) / 180) * mh;
        if (i === 0) m.moveTo(x, y);
        else m.lineTo(x, y);
      });
      m.closePath();
    }
  }
  m.fill("evenodd");
  const data = m.getImageData(0, 0, mw, mh).data;

  const ctx = c.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // map placement: full width, lat 80..-60 over the frame height
  const mapW = W * 1.08;
  const x0 = (W - mapW) / 2;
  const latTop = 82;
  const latBot = -58;
  const step = 17;
  ctx.fillStyle = rgba(p.map, 1);
  for (let y = step / 2; y < H; y += step) {
    const lat = latTop - (y / H) * (latTop - latBot);
    const my = Math.floor(((90 - lat) / 180) * mh);
    for (let x = step / 2; x < W; x += step) {
      const lon = ((x - x0) / mapW) * 360 - 180;
      const mx = Math.floor(((lon + 180) / 360) * mw);
      if (mx < 0 || mx >= mw) continue;
      if (data[(my * mw + mx) * 4] > 127) {
        ctx.beginPath();
        ctx.arc(x, y, 3.4, 0, TAU);
        ctx.fill();
      }
    }
  }
  return c;
};

const background = (ctx: CanvasRenderingContext2D, p: CandlePalette) => {
  ctx.fillStyle = p.bgEdge;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W * 0.56, H * 0.47);
  ctx.scale(1.55, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.55);
  g.addColorStop(0, p.bgCenter);
  g.addColorStop(0.45, p.bgMid);
  g.addColorStop(1, p.bgEdge);
  ctx.fillStyle = g;
  ctx.fillRect(-W, -H, 2 * W, 2 * H);
  ctx.restore();
};

const grid = (ctx: CanvasRenderingContext2D, p: CandlePalette, scroll: number) => {
  ctx.strokeStyle = p.grid;
  ctx.lineWidth = 2;
  for (let y = 150; y < H; y += 150) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  const sp = CANDLE_SP * 8; // 384 px, divides SCROLL
  const off = ((scroll % sp) + sp) % sp;
  for (let x = -off; x < W; x += sp) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
};

const areaChart = (ctx: CanvasRenderingContext2D, p: CandlePalette, scroll: number) => {
  const baseY = 1180;
  const amp = 560;
  const yOf = (v: number) => baseY - v * amp;
  const i0 = Math.floor((scroll - 40) / AREA_SP);
  const xEnd = X_EDGE + 40;
  const pts: [number, number][] = [];
  for (let i = i0; ; i++) {
    const x = i * AREA_SP - scroll;
    if (x > xEnd) break;
    pts.push([x, yOf(at(AREA, i))]);
  }
  const bottom = H * 0.86;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineTo(pts[pts.length - 1][0], bottom);
  ctx.lineTo(pts[0][0], bottom);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, baseY - amp, 0, bottom);
  g.addColorStop(0, rgba(p.area, 0.42));
  g.addColorStop(0.45, rgba(p.area, 0.2));
  g.addColorStop(1, rgba(p.area, 0));
  ctx.fillStyle = g;
  ctx.fill();
  // fade the right end of the fill
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = rgba(p.areaEdge, 0.75);
  ctx.lineWidth = 3;
  ctx.stroke();
};

const candleLayer = (ctx: CanvasRenderingContext2D, p: CandlePalette, scroll: number, glowPass: boolean) => {
  const j0 = Math.floor((scroll - CANDLE_SP) / CANDLE_SP);
  const bodyW = CANDLE_SP * 0.42;
  for (let j = j0; ; j++) {
    const x = j * CANDLE_SP - scroll + CANDLE_SP / 2;
    if (x > X_EDGE) break;
    const d = at(CANDLES, j);
    let { o, c, h, l } = d;
    let alpha = 1;
    const q = (X_EDGE - x) / CANDLE_SP; // < 1: candle still forming
    if (q < 1) {
      const e = q * q * (3 - 2 * q);
      const wob = 0.02 * Math.sin(q * TAU * 2) * (1 - q);
      c = o + (c - o) * e + wob;
      h = Math.max(o, c) + (h - Math.max(d.o, d.c)) * e;
      l = Math.min(o, c) - (Math.min(d.o, d.c) - l) * e;
      alpha = Math.min(1, q * 4 + 0.25);
    }
    if (x < 260) alpha *= Math.max(0, (x + CANDLE_SP) / (260 + CANDLE_SP)); // fade at the left edge
    const up = c >= o;
    const col = up ? p.up : p.down;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = glowPass ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(x, priceY(h));
    ctx.lineTo(x, priceY(l));
    ctx.stroke();
    const top = priceY(Math.max(o, c));
    const bh = Math.max(4, priceY(Math.min(o, c)) - top);
    if (up && !glowPass) {
      // hollow-ish up candles: bright edge + translucent fill
      ctx.fillStyle = rgba(col, 0.55);
      ctx.fillRect(x - bodyW / 2, top, bodyW, bh);
      ctx.lineWidth = 3;
      ctx.strokeRect(x - bodyW / 2 + 1.5, top + 1.5, bodyW - 3, bh - 3);
    } else {
      ctx.fillRect(x - bodyW / 2, top, bodyW, bh);
    }
  }
  ctx.globalAlpha = 1;
};

const liveClose = (scroll: number) => {
  const jLive = Math.floor((X_EDGE + scroll - CANDLE_SP / 2) / CANDLE_SP);
  const x = jLive * CANDLE_SP - scroll + CANDLE_SP / 2;
  const d = at(CANDLES, jLive);
  const q = Math.max(0, Math.min(1, (X_EDGE - x) / CANDLE_SP));
  const e = q * q * (3 - 2 * q);
  return d.o + (d.c - d.o) * e + 0.02 * Math.sin(q * TAU * 2) * (1 - q);
};

const flare = (ctx: CanvasRenderingContext2D, p: CandlePalette, fm: number) => {
  const t = fm / LOOP;
  const pulse = 0.86 + 0.1 * Math.sin(TAU * 3 * t) + 0.04 * Math.sin(TAU * 7 * t + 1.3);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // wide anamorphic haze
  ctx.save();
  ctx.translate(FLARE_X, FLARE_Y);
  ctx.scale(1, 0.07);
  let g = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.75);
  g.addColorStop(0, rgba(p.flareGlow, 0.42 * pulse));
  g.addColorStop(0.35, rgba(p.flareGlow, 0.14 * pulse));
  g.addColorStop(1, rgba(p.flareGlow, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-W * 2, -W, W * 4, W * 2);
  ctx.restore();
  // thin bright streak across the frame
  const lg = ctx.createLinearGradient(0, 0, W, 0);
  lg.addColorStop(0, rgba(p.flare, 0.05));
  lg.addColorStop(0.45, rgba(p.flare, 0.28 * pulse));
  lg.addColorStop(FLARE_X / W, rgba(p.flare, 0.95 * pulse));
  lg.addColorStop(1, rgba(p.flare, 0.35 * pulse));
  ctx.fillStyle = lg;
  ctx.fillRect(0, FLARE_Y - 2, W, 4);
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, FLARE_Y - 6, W, 12);
  ctx.globalAlpha = 1;
  // hot spot on the right
  g = ctx.createRadialGradient(FLARE_X, FLARE_Y, 0, FLARE_X, FLARE_Y, 380);
  g.addColorStop(0, rgba(p.flare, 0.9 * pulse));
  g.addColorStop(0.08, rgba(p.flareGlow, 0.55 * pulse));
  g.addColorStop(0.4, rgba(p.flareGlow, 0.12 * pulse));
  g.addColorStop(1, rgba(p.flareGlow, 0));
  ctx.fillStyle = g;
  ctx.fillRect(FLARE_X - 400, FLARE_Y - 400, 800, 800);
  // vertical sparkle
  ctx.save();
  ctx.translate(FLARE_X, FLARE_Y);
  ctx.scale(0.05, 1);
  g = ctx.createRadialGradient(0, 0, 0, 0, 0, 260);
  g.addColorStop(0, rgba(p.flare, 0.5 * pulse));
  g.addColorStop(1, rgba(p.flare, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-300, -300, 600, 600);
  ctx.restore();
  ctx.restore();
};

const triangle = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, up: boolean) => {
  ctx.beginPath();
  if (up) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s / 2, y - s * 0.85);
  } else {
    ctx.moveTo(x, y - s * 0.85);
    ctx.lineTo(x + s, y - s * 0.85);
    ctx.lineTo(x + s / 2, y);
  }
  ctx.closePath();
  ctx.fill();
};

const tickerItem = (ctx: CanvasRenderingContext2D, p: CandlePalette, i: number, x: number, y: number, size: number, fm: number) => {
  const t = TICKERS[i % TICKERS.length];
  const { value, change, sinceTick } = tickerAt(t, fm);
  const up = change >= 0;
  ctx.font = `500 ${size}px "JetBrains Mono"`;
  ctx.fillStyle = p.textDim;
  ctx.fillText(t.code, x, y);
  let cx = x + ctx.measureText(t.code).width + size * 0.7;
  const flash = sinceTick < 6 ? 1 - sinceTick / 6 : 0;
  ctx.fillStyle = flash > 0 ? (up ? p.labelUp : p.labelDown) : p.text;
  ctx.globalAlpha = 0.85 + 0.15 * flash;
  const vs = value.toFixed(2);
  ctx.fillText(vs, cx, y);
  ctx.globalAlpha = 1;
  cx += ctx.measureText(vs).width + size * 0.5;
  ctx.fillStyle = up ? p.labelUp : p.labelDown;
  triangle(ctx, cx, y - size * 0.08, size * 0.62, up);
  cx += size * 0.9;
  ctx.fillText(Math.abs(change).toFixed(2), cx, y);
};

const labels = (ctx: CanvasRenderingContext2D, p: CandlePalette, fm: number, scroll: number) => {
  ctx.textBaseline = "alphabetic";
  // bottom ticker rows
  ctx.fillStyle = rgba(p.bgEdge, 0.55);
  ctx.fillRect(0, 1880, W, 210);
  ctx.strokeStyle = rgba(p.textDim, 0.25);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 1880);
  ctx.lineTo(W, 1880);
  ctx.stroke();
  for (let i = 0; i < 6; i++) tickerItem(ctx, p, i, 120 + i * 620, 1955, 38, fm);
  for (let i = 0; i < 6; i++) tickerItem(ctx, p, i + 6, 120 + i * 620, 2035, 32, fm);

  // top-left info block
  ctx.font = `600 44px "Inter"`;
  ctx.fillStyle = p.text;
  ctx.fillText("SEC-A", 140, 190);
  const a = tickerAt(TICKERS[1], fm);
  ctx.font = `500 30px "JetBrains Mono"`;
  const rows: [string, string][] = [
    ["LAST", a.value.toFixed(2)],
    ["OPEN", (a.value - a.change * 3.1).toFixed(2)],
    ["HIGH", (a.value + Math.abs(a.change) * 4.3 + 2.4).toFixed(2)],
    ["LOW", (a.value - Math.abs(a.change) * 5.2 - 3.1).toFixed(2)],
    ["VOL", `${(1.1 + Math.abs(a.change) * 0.37).toFixed(2)}M`],
  ];
  rows.forEach(([k, v], r) => {
    ctx.fillStyle = p.textDim;
    ctx.fillText(k, 140, 250 + r * 44);
    ctx.fillStyle = r === 0 ? (a.change >= 0 ? p.labelUp : p.labelDown) : p.text;
    ctx.fillText(v, 280, 250 + r * 44);
  });
  ctx.fillStyle = a.change >= 0 ? p.labelUp : p.labelDown;
  triangle(ctx, 440, 248, 22, a.change >= 0);

  // top-right info block
  ctx.font = `600 40px "Inter"`;
  ctx.fillStyle = p.text;
  ctx.fillText("IDX-01", 2900, 180);
  tickerItem(ctx, p, 0, 2900, 236, 32, fm);
  tickerItem(ctx, p, 2, 2900, 284, 28, fm);
  tickerItem(ctx, p, 4, 2900, 326, 28, fm);
  // a little sparkline for the block
  ctx.strokeStyle = rgba(p.up, 0.8);
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const v = at(CANDLES, Math.floor(scroll / CANDLE_SP) + i).c;
    const x = 2900 + i * 18;
    const y = 420 - v * 60;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();

  // small scattered stats in the top middle
  ctx.font = `500 26px "JetBrains Mono"`;
  const stats = [
    ["IDX-07", 1240, 160],
    ["SEC-F", 1700, 160],
    ["IDX-12", 2160, 160],
  ] as const;
  stats.forEach(([, x, y], i) => {
    tickerItem(ctx, p, 2 + i * 2, x, y, 26, fm);
  });

  // price axis on the right
  ctx.font = `500 26px "JetBrains Mono"`;
  for (let k = 0; k <= 6; k++) {
    const v = k / 6;
    const y = priceY(v);
    ctx.fillStyle = rgba(p.textDim, 0.7);
    ctx.fillText(priceOf(v).toFixed(2), W - 190, y + 9);
    ctx.fillStyle = rgba(p.textDim, 0.35);
    ctx.fillRect(W - 215, y, 14, 2);
  }
  // live price tag
  const lc = liveClose(scroll);
  const ly = priceY(lc);
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = rgba(p.text, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(X_EDGE + 30, ly);
  ctx.lineTo(W - 225, ly);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = rgba(p.up, 0.85);
  ctx.fillRect(W - 222, ly - 24, 200, 48);
  ctx.fillStyle = p.bgEdge;
  ctx.font = `600 28px "JetBrains Mono"`;
  ctx.fillText(priceOf(lc).toFixed(2), W - 208, ly + 10);

  // time axis under the chart, scrolling with the candles (every 8 candles)
  ctx.font = `500 24px "JetBrains Mono"`;
  ctx.fillStyle = rgba(p.textDim, 0.75);
  const j0 = Math.ceil(scroll / CANDLE_SP / 8) * 8 - 8;
  for (let j = j0; ; j += 8) {
    const x = j * CANDLE_SP - scroll + CANDLE_SP / 2;
    if (x > X_EDGE) break;
    if (x < 120) continue;
    const idx = ((j % N_CANDLES) + N_CANDLES) % N_CANDLES;
    const mins = 9 * 60 + 30 + idx * 5;
    const label = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    ctx.fillText(label, x - 34, 1520);
    ctx.fillRect(x - 1, 1478, 2, 12);
  }
};

const grainPass = (ctx: CanvasRenderingContext2D, fm: number) => {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const n1 = hash3(x, y, fm);
      const n2 = hash3(x + 7919, y + 104729, fm);
      // ~2 % grain + ±1/255 triangular dither
      const lum = (d[i] * 0.3 + d[i + 1] * 0.5 + d[i + 2] * 0.2) / 255;
      const v = (n1 - 0.5) * 0.04 * 255 * (0.35 + 0.65 * Math.min(1, lum * 3)) + (n1 + n2 - 1);
      d[i] += v;
      d[i + 1] += v;
      d[i + 2] += v;
    }
  }
  ctx.putImageData(img, 0, 0);
};

export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  layers: Layers,
  p: CandlePalette,
  frame: number,
  dpr: number,
) => {
  const fm = ((frame % LOOP) + LOOP) % LOOP;
  const scroll = (fm / LOOP) * SCROLL;
  const t = fm / LOOP;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";

  background(ctx, p);
  // map: faint, slow sway (periodic)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.3;
  ctx.drawImage(layers.map, Math.round(36 * Math.sin(TAU * t) * dpr), 0);
  ctx.restore();
  grid(ctx, p, scroll);

  // area chart on the scratch layer, faded out towards both ends
  const g = layers.glow.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, layers.glow.width, layers.glow.height);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  areaChart(g, p, scroll);
  g.globalCompositeOperation = "destination-in";
  const fade = g.createLinearGradient(0, 0, W, 0);
  fade.addColorStop(0, "rgba(0,0,0,0.25)");
  fade.addColorStop(0.12, "rgba(0,0,0,1)");
  fade.addColorStop((X_EDGE - 260) / W, "rgba(0,0,0,1)");
  fade.addColorStop((X_EDGE + 40) / W, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = fade;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layers.glow, 0, 0);
  ctx.restore();

  // candles: glow pass (blurred) + sharp pass
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, layers.glow.width, layers.glow.height);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  candleLayer(g, p, scroll, true);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = `blur(${Math.max(1, 16 * dpr)}px)`;
  ctx.globalAlpha = 0.9;
  ctx.drawImage(layers.glow, 0, 0);
  ctx.filter = `blur(${Math.max(1, 5 * dpr)}px)`;
  ctx.globalAlpha = 0.7;
  ctx.drawImage(layers.glow, 0, 0);
  ctx.restore();
  candleLayer(ctx, p, scroll, false);

  flare(ctx, p, fm);
  labels(ctx, p, fm, scroll);

  // edge darkening
  ctx.save();
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  grainPass(ctx, fm);
};
