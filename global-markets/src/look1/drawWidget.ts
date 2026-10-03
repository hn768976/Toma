import { MapPalette } from "../common/palettes";
import { at } from "../common/random";
import { Widget } from "./layout";

// Every widget is drawn from scratch from (widget, tick). Pure function: the
// same tick always yields the same pixels, whatever was drawn before.

type Ctx = CanvasRenderingContext2D;

const SANS = "Inter";
const MONO = "JetBrains Mono";
const font = (ctx: Ctx, px: number, weight = 500, family = SANS) => {
  ctx.font = `${weight} ${px}px "${family}"`;
};

const fmt = (v: number, digits = 2) => v.toFixed(digits);
const signed = (v: number, digits = 2) => (v >= 0 ? "+" : "") + v.toFixed(digits);

const accentColor = (p: MapPalette, a: Widget["accent"]) => (a === "green" ? p.up : a === "red" ? p.down : p.chart);
const accentHi = (p: MapPalette, a: Widget["accent"]) =>
  a === "green" ? "#9DFFB8" : a === "red" ? "#FF9C9C" : p.chartHi;

const withAlpha = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

const panelBox = (ctx: Ctx, p: MapPalette, x: number, y: number, w: number, h: number, title?: string) => {
  ctx.fillStyle = p.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = p.panelEdge;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 0.6, y + 0.6, w - 1.2, h - 1.2);
  if (title) {
    ctx.fillStyle = "rgba(90,160,240,0.14)";
    ctx.fillRect(x + 1.2, y + 1.2, w - 2.4, 22);
  }
};

/** Value of series s at (tick + offset), mapped to a displayed number. */
const val = (w: Widget, s: number, i: number, spread = 0.25) => w.base * (1 - spread / 2 + spread * at(w.series[s], i));

const drawTableRows = (
  ctx: Ctx,
  p: MapPalette,
  w: Widget,
  k: number,
  x: number,
  y: number,
  colW: number,
  rows: number,
  rowH: number,
  size: number,
) => {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 2; c++) {
      const i = k + r * 3 + c * 17;
      const v = val(w, c, i);
      const ch = (at(w.series[c], i) - at(w.series[c], i - 1)) * w.base * 0.06;
      const up = ch >= 0;
      font(ctx, size, 500);
      ctx.fillStyle = r % 3 === 1 ? p.text : up ? p.up : p.down;
      ctx.textAlign = "left";
      ctx.fillText(fmt(v), x + c * colW, y + r * rowH);
      ctx.fillStyle = up ? p.up : p.down;
      ctx.textAlign = "right";
      ctx.fillText(signed(ch), x + c * colW + colW - 10, y + r * rowH);
    }
  }
  ctx.textAlign = "left";
};

const areaPath = (ctx: Ctx, pts: number[], x: number, y: number, w: number, h: number) => {
  ctx.beginPath();
  pts.forEach((v, i) => {
    const px = x + (i / (pts.length - 1)) * w;
    const py = y + h - v * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
};

const drawArea = (ctx: Ctx, p: MapPalette, w: Widget, k: number, x: number, y: number, cw: number, ch: number, accent: Widget["accent"], count = 44) => {
  const pts: number[] = [];
  for (let i = 0; i < count; i++) {
    const v = at(w.series[0], k + i) * 0.6 + at(w.series[1], (k + i) * 7) * 0.4;
    pts.push(0.08 + v * 0.88);
  }
  const col = accentColor(p, accent);
  areaPath(ctx, pts, x, y, cw, ch);
  ctx.lineTo(x + cw, y + ch);
  ctx.lineTo(x, y + ch);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y, 0, y + ch);
  const top = accent === "blue" ? 0.95 : 0.6;
  g.addColorStop(0, withAlpha(col, top));
  g.addColorStop(0.55, withAlpha(col, top * 0.4));
  g.addColorStop(1, withAlpha(col, 0.04));
  ctx.fillStyle = g;
  ctx.fill();
  areaPath(ctx, pts, x, y, cw, ch);
  ctx.strokeStyle = accentHi(p, accent);
  ctx.lineWidth = 1.6;
  ctx.stroke();
};

const drawBars = (ctx: Ctx, p: MapPalette, w: Widget, k: number, x: number, y: number, cw: number, ch: number, count = 26) => {
  const bw = cw / count;
  for (let i = 0; i < count; i++) {
    const v = 0.15 + 0.85 * at(w.series[2], k + i);
    const bh = v * ch;
    const g = ctx.createLinearGradient(0, y + ch - bh, 0, y + ch);
    g.addColorStop(0, "rgba(225,244,255,0.95)");
    g.addColorStop(0.3, withAlpha(p.chartHi, 0.75));
    g.addColorStop(1, withAlpha(p.chart, 0.2));
    ctx.fillStyle = g;
    ctx.fillRect(x + i * bw + bw * 0.18, y + ch - bh, bw * 0.64, bh);
  }
};

const drawCandles = (ctx: Ctx, p: MapPalette, w: Widget, k: number, x: number, y: number, cw: number, ch: number, count = 22) => {
  const bw = cw / count;
  for (let i = 0; i < count; i++) {
    const o = at(w.series[0], k + i);
    const c = at(w.series[0], k + i + 1);
    const hi = Math.max(o, c) + 0.08 * at(w.series[1], k + i);
    const lo = Math.min(o, c) - 0.08 * at(w.series[2], k + i);
    const up = c >= o;
    ctx.fillStyle = up ? p.up : p.down;
    ctx.strokeStyle = ctx.fillStyle;
    const cx = x + i * bw + bw / 2;
    const Y = (v: number) => y + ch - (0.05 + v * 0.85) * ch;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, Y(hi));
    ctx.lineTo(cx, Y(lo));
    ctx.stroke();
    const top = Y(Math.max(o, c));
    ctx.fillRect(cx - bw * 0.3, top, bw * 0.6, Math.max(1.2, Y(Math.min(o, c)) - top));
  }
};

export const drawWidget = (ctx: Ctx, w: Widget, tick: number, p: MapPalette) => {
  const k = ((tick % w.n) + w.n) % w.n;
  const W = w.lw;
  const H = w.lh;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const m = 4; // transparent margin

  switch (w.type) {
    case "panel": {
      panelBox(ctx, p, m, m, W - 2 * m, H - 2 * m, "Volume");
      font(ctx, 15, 600);
      ctx.fillStyle = p.text;
      ctx.textAlign = "center";
      ctx.fillText("Volume", W / 2, m + 17);
      ctx.textAlign = "left";
      font(ctx, 11, 600);
      ctx.fillStyle = p.textDim;
      ctx.fillText("Start Vol", 18, 50);
      ctx.fillText("Avail Vol", W / 2 + 6, 50);
      drawTableRows(ctx, p, w, k, 18, 72, W / 2 - 12, 6, 19, 14);
      if (w.variant % 2 === 0) {
        drawBars(ctx, p, w, k, 18, 190, W - 36, 70, 30);
      } else {
        drawArea(ctx, p, w, k, 18, 192, W - 36, 70, "blue", 50);
      }
      font(ctx, 12, 600);
      ctx.fillStyle = p.text;
      ctx.fillText(fmt(val(w, 3, k)), 18, H - 14);
      ctx.fillStyle = p.cyan;
      ctx.textAlign = "right";
      ctx.fillText(w.code, W - 18, H - 14);
      ctx.textAlign = "left";
      break;
    }
    case "table": {
      if (w.framed) panelBox(ctx, p, m, m, W - 2 * m, H - 2 * m, "x");
      font(ctx, 12, 600);
      ctx.fillStyle = p.text;
      ctx.fillText("Start Vol", 14, m + 16);
      ctx.fillText("Avail Vol", W / 2 + 4, m + 16);
      drawTableRows(ctx, p, w, k, 14, 50, W / 2 - 8, 8, 18, 12.5);
      break;
    }
    case "bars": {
      if (w.framed) panelBox(ctx, p, m, m, W - 2 * m, H - 2 * m);
      font(ctx, 10, 600);
      ctx.fillStyle = p.text;
      ctx.fillText(w.variant % 2 ? "Start Vol" : "Volume", 12, 18);
      font(ctx, 10, 500);
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = c === 3 ? p.textDim : p.text;
        ctx.fillText(fmt(val(w, c % 3, k + c * 5), c === 3 ? 2 : 2), 12 + c * 56, 34);
      }
      drawBars(ctx, p, w, k, 10, 44, W - 20, H - 66, 24);
      font(ctx, 9, 500);
      ctx.fillStyle = p.textDim;
      ctx.fillText("Volume", 12, H - 9);
      ctx.fillStyle = p.text;
      ctx.textAlign = "right";
      ctx.fillText(fmt(val(w, 3, k)), W - 12, H - 9);
      ctx.textAlign = "left";
      break;
    }
    case "area": {
      if (w.framed) panelBox(ctx, p, m, m, W - 2 * m, H - 2 * m);
      drawArea(ctx, p, w, k, m + 2, 22, W - 2 * m - 4, H - 26, w.accent);
      if (w.variant < 2) {
        font(ctx, 13, 600);
        ctx.fillStyle = w.accent === "blue" ? p.text : accentHi(p, w.accent);
        ctx.textAlign = "right";
        ctx.fillText(fmt(val(w, 3, k)), W - m - 4, 17);
        ctx.textAlign = "left";
      }
      break;
    }
    case "line": {
      ctx.strokeStyle = "rgba(120,180,255,0.16)";
      ctx.lineWidth = 1;
      for (let g = 0; g < 4; g++) {
        ctx.beginPath();
        ctx.moveTo(m, 20 + g * 24);
        ctx.lineTo(W - m, 20 + g * 24);
        ctx.stroke();
      }
      const count = 14;
      const pts: [number, number][] = [];
      for (let i = 0; i < count; i++) {
        const px = m + 4 + (i / (count - 1)) * (W - 2 * m - 8);
        const v = 0.6 * at(w.series[1], k + i) + 0.4 * at(w.series[2], (k + i) * 5);
        pts.push([px, 16 + (1 - v) * (H - 26)]);
      }
      const col = w.accent === "blue" ? p.cyan : accentHi(p, w.accent);
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.lineTo(pts[count - 1][0], H - m);
      ctx.lineTo(pts[0][0], H - m);
      ctx.closePath();
      const gr = ctx.createLinearGradient(0, 10, 0, H);
      gr.addColorStop(0, withAlpha(accentColor(p, w.accent), 0.55));
      gr.addColorStop(1, withAlpha(accentColor(p, w.accent), 0));
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#FFFFFF";
      for (const [px, py] of pts) {
        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      font(ctx, 10, 500);
      ctx.fillStyle = p.textDim;
      ctx.fillText(w.code, m + 2, 12);
      break;
    }
    case "percent": {
      if (w.framed) panelBox(ctx, p, m, m, W - 2 * m, H - 2 * m);
      font(ctx, 11, 600);
      ctx.fillStyle = p.text;
      ctx.fillText(w.variant % 2 ? "Start Vol" : "Volume", 14, 22);
      font(ctx, 10, 500);
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = c === 3 ? p.textDim : p.text;
        ctx.fillText(fmt(val(w, c % 3, k + c * 5)), 14 + c * 54, 38);
      }
      if (w.variant < 3) {
        drawBars(ctx, p, w, k, 12, 46, W - 24, 78, 28);
      } else {
        drawArea(ctx, p, w, k, 12, 48, W - 24, 76, w.accent, 36);
      }
      const pct = 1 + 7 * at(w.series[3], k);
      font(ctx, 42, 400);
      ctx.fillStyle = p.text;
      ctx.textAlign = "center";
      ctx.fillText(`${fmt(pct)} %`, W / 2, 182);
      font(ctx, 10, 600);
      ctx.fillStyle = p.textDim;
      ctx.fillText("ST Net Trading", W / 2, 202);
      ctx.textAlign = "left";
      break;
    }
    case "column": {
      font(ctx, 10.5, 500, MONO);
      const rows = 13;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 2; c++) {
          const i = k + r + c * 9;
          const d = at(w.series[c], i) - at(w.series[c], i - 1);
          ctx.fillStyle = r % 4 === 0 ? p.text : d >= 0 ? p.up : p.down;
          ctx.fillText(fmt(val(w, c, i, 0.4), 2), 6 + c * 74, 18 + r * 16.5);
        }
      }
      break;
    }
    case "tag": {
      const v = val(w, 0, k);
      const d = at(w.series[0], k) - at(w.series[0], k - 1);
      if (w.framed) {
        ctx.fillStyle = "rgba(10,30,60,0.6)";
        ctx.fillRect(m, m, W - 2 * m, H - 2 * m);
      }
      font(ctx, 20, 600);
      ctx.fillStyle = w.variant === 0 ? (d >= 0 ? p.up : p.down) : w.variant === 1 ? p.down : p.text;
      ctx.textAlign = "center";
      ctx.fillText(fmt(v), W / 2, 26);
      ctx.textAlign = "left";
      break;
    }
    case "candles": {
      if (w.framed) panelBox(ctx, p, m, m, W - 2 * m, H - 2 * m);
      drawCandles(ctx, p, w, k, m + 6, 20, W - 2 * m - 12, H - 28);
      font(ctx, 10, 600);
      ctx.fillStyle = p.text;
      ctx.fillText(w.code, m + 6, 15);
      ctx.textAlign = "right";
      ctx.fillStyle = p.cyan;
      ctx.fillText(fmt(val(w, 0, k)), W - m - 6, 15);
      ctx.textAlign = "left";
      break;
    }
    case "quad": {
      font(ctx, 13, 600);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const i = k + c * 7 + r * 3;
          const d = at(w.series[c], i) - at(w.series[c], i - 1);
          ctx.fillStyle = r === 0 ? p.text : c === 2 ? (d >= 0 ? p.up : p.down) : p.text;
          ctx.fillText(fmt(val(w, c, i, 0.5), w.variant % 2 ? 3 : 2), 8 + c * 72, 26 + r * 26);
        }
      }
      if (w.variant === 3) {
        ctx.fillStyle = withAlpha(p.down, 0.75);
        ctx.fillRect(150, 36, 64, 22);
        ctx.fillStyle = p.text;
        font(ctx, 13, 600);
        ctx.fillText(fmt(val(w, 2, k + 3, 0.5)), 154, 52);
      }
      break;
    }
    case "ticker": {
      const v = val(w, 0, k);
      const d = (at(w.series[0], k) - at(w.series[0], k - 1)) * 10;
      font(ctx, 14, 600, MONO);
      ctx.fillStyle = p.cyan;
      ctx.fillText(w.code, 8, 26);
      ctx.fillStyle = p.text;
      ctx.fillText(fmt(v), 82, 26);
      const up = d >= 0;
      ctx.fillStyle = up ? p.up : p.down;
      ctx.beginPath();
      if (up) {
        ctx.moveTo(170, 25);
        ctx.lineTo(180, 25);
        ctx.lineTo(175, 15);
      } else {
        ctx.moveTo(170, 15);
        ctx.lineTo(180, 15);
        ctx.lineTo(175, 25);
      }
      ctx.fill();
      ctx.fillText(fmt(Math.abs(d)), 188, 26);
      break;
    }
  }
};
