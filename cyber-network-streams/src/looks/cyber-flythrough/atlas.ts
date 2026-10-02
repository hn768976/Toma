import { INTER, MONO } from "../../lib/fonts";
import { hash2, mulberry32 } from "../../lib/random";

// Canvas 2D atlas of HUD panel faces for Cyber Flythrough. Drawn on black
// (the panels are additive), redrawn from a step number derived from the
// frame — never incrementally.

export const CELL_W = 512;
export const CELL_H = 320;
export const COLS = 8;
export const ROWS = 8;
export const ATLAS_W = CELL_W * COLS; // 4096
export const ATLAS_H = CELL_H * ROWS; // 2560
export const N_DESIGNS = 9;

type Pal = { teal: string; blue: string };

const r = mulberry32(0xa71a5);
// fixed per-cell parameters
const cells = Array.from({ length: COLS * ROWS }, (_, i) => ({
  design: i % N_DESIGNS,
  seed: Math.floor(r() * 1e6),
  aspect: r(),
  label: ["SYSTEM STATUS", "NETWORK", "SECURE LINK", "DATA FLOW", "NODE 07", "UPLINK", "SCAN", "FIREWALL", "CORE"][Math.floor(r() * 9)],
}));

const frameBox = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: Pal) => {
  // faint additive fill + thin border + bright corners
  ctx.fillStyle = "rgba(14,80,120,0.28)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(63,232,216,0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = p.teal;
  ctx.lineWidth = 4;
  const c = 22;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + c);
  ctx.lineTo(x + 2, y + 2);
  ctx.lineTo(x + c, y + 2);
  ctx.moveTo(x + w - c, y + 2);
  ctx.lineTo(x + w - 2, y + 2);
  ctx.lineTo(x + w - 2, y + c);
  ctx.moveTo(x + w - 2, y + h - c);
  ctx.lineTo(x + w - 2, y + h - 2);
  ctx.lineTo(x + w - c, y + h - 2);
  ctx.moveTo(x + c, y + h - 2);
  ctx.lineTo(x + 2, y + h - 2);
  ctx.lineTo(x + 2, y + h - c);
  ctx.stroke();
};

const textLines = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, n: number, seed: number, step: number) => {
  for (let i = 0; i < n; i++) {
    const len = 0.35 + 0.6 * hash2(seed + i, Math.floor(step / 3));
    ctx.fillStyle = i === 0 ? "rgba(120,240,240,0.9)" : "rgba(63,232,216,0.55)";
    ctx.fillRect(x, y + i * 18, w * len, 6);
  }
};

export const shield = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s / 100, s / 100);
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.bezierCurveTo(14, -36, 30, -32, 40, -32);
  ctx.bezierCurveTo(40, 2, 32, 30, 0, 48);
  ctx.bezierCurveTo(-32, 30, -40, 2, -40, -32);
  ctx.bezierCurveTo(-30, -32, -14, -36, 0, -46);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = "rgba(63,232,216,0.18)";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-17, 2);
  ctx.lineTo(-4, 15);
  ctx.lineTo(20, -12);
  ctx.stroke();
  ctx.restore();
};

const ring = (ctx: CanvasRenderingContext2D, cx: number, cy: number, rad: number, pct: number, p: Pal) => {
  ctx.lineCap = "butt";
  ctx.strokeStyle = "rgba(63,232,216,0.22)";
  ctx.lineWidth = rad * 0.22;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = p.teal;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
  ctx.stroke();
};

export const drawCell = (ctx: CanvasRenderingContext2D, idx: number, step: number, p: Pal) => {
  const c = cells[idx];
  const x0 = (idx % COLS) * CELL_W;
  const y0 = Math.floor(idx / COLS) * CELL_H;
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(x0, y0, CELL_W, CELL_H);
  ctx.translate(x0, y0);
  const pad = 18; // keeps mip levels from bleeding between cells
  const x = pad,
    y = pad,
    w = CELL_W - pad * 2,
    h = CELL_H - pad * 2;
  const v = (k: number) => hash2(c.seed + k * 977, step);
  if (c.design !== 3) frameBox(ctx, x, y, w, h, p);
  ctx.textBaseline = "alphabetic";
  switch (c.design) {
    case 0: {
      // shield + check + text lines
      shield(ctx, x + 105, y + h / 2 + 4, 150, p.teal);
      textLines(ctx, x + 210, y + 70, w - 240, 6, c.seed, step);
      ctx.fillStyle = "rgba(120,240,240,0.95)";
      ctx.font = `600 28px ${INTER}`;
      ctx.fillText("PROTECTED", x + 210, y + 50);
      break;
    }
    case 1: {
      // three ring gauges
      for (let k = 0; k < 3; k++) {
        const pct = 0.25 + 0.7 * (0.5 + 0.5 * Math.sin(step * 0.21 + k * 2.1 + c.seed));
        ring(ctx, x + 85 + k * 150, y + h / 2 - 10, 52, pct, p);
        ctx.fillStyle = "rgba(140,240,240,0.95)";
        ctx.font = `500 26px ${MONO}`;
        ctx.textAlign = "center";
        ctx.fillText(`${Math.round(pct * 100)}`, x + 85 + k * 150, y + h / 2);
        ctx.textAlign = "left";
      }
      textLines(ctx, x + 30, y + h - 52, w - 60, 2, c.seed, step);
      break;
    }
    case 2: {
      // bar mini chart
      ctx.fillStyle = "rgba(120,240,240,0.9)";
      ctx.font = `600 24px ${INTER}`;
      ctx.fillText(c.label, x + 26, y + 44);
      const nb = 18;
      for (let k = 0; k < nb; k++) {
        const hv = 0.15 + 0.85 * Math.abs(Math.sin(k * 0.7 + c.seed + step * 0.35)) * (0.5 + 0.5 * v(k));
        const bw = (w - 60) / nb;
        ctx.fillStyle = k % 5 === 0 ? "rgba(140,245,245,0.95)" : p.teal;
        ctx.fillRect(x + 30 + k * bw, y + h - 30 - hv * (h - 110), bw * 0.6, hv * (h - 110));
      }
      ctx.fillStyle = "rgba(63,232,216,0.5)";
      ctx.fillRect(x + 26, y + h - 26, w - 52, 2);
      break;
    }
    case 3: {
      // number block, no frame
      const num = (100 + v(1) * 899).toFixed(2);
      ctx.fillStyle = "rgba(150,245,245,0.98)";
      ctx.font = `500 112px ${MONO}`;
      ctx.fillText(idx % 5 === 3 ? "783.52" : num, x + 10, y + h / 2 + 30);
      ctx.fillStyle = p.teal;
      ctx.fillRect(x + 12, y + h / 2 + 58, w * 0.55, 6);
      ctx.font = `500 26px ${INTER}`;
      ctx.fillText(c.label, x + 12, y + h / 2 - 82);
      break;
    }
    case 4: {
      // list rows with values and bars
      ctx.font = `500 22px ${MONO}`;
      for (let k = 0; k < 7; k++) {
        const yy = y + 46 + k * 34;
        ctx.fillStyle = "rgba(120,240,240,0.85)";
        ctx.fillText(`${(v(k) * 99.99).toFixed(2).padStart(5, "0")}`, x + 26, yy);
        ctx.fillStyle = k % 3 === 0 ? "rgba(140,245,245,0.9)" : "rgba(63,232,216,0.7)";
        ctx.fillRect(x + 130, yy - 14, (w - 160) * (0.2 + 0.8 * v(k + 20)), 12);
      }
      break;
    }
    case 5: {
      // system status header + online + progress
      ctx.fillStyle = "rgba(120,240,240,0.92)";
      ctx.font = `600 30px ${INTER}`;
      ctx.fillText("SYSTEM STATUS", x + 26, y + 52);
      ctx.fillStyle = p.teal;
      ctx.font = `700 30px ${INTER}`;
      ctx.textAlign = "right";
      ctx.fillText("ONLINE", x + w - 26, y + 52);
      ctx.textAlign = "left";
      for (let k = 0; k < 4; k++) {
        const pv = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(step * 0.15 + k * 1.7 + c.seed));
        ctx.fillStyle = "rgba(63,232,216,0.25)";
        ctx.fillRect(x + 26, y + 90 + k * 46, w - 52, 14);
        ctx.fillStyle = k === 1 ? "rgba(140,245,245,0.95)" : p.teal;
        ctx.fillRect(x + 26, y + 90 + k * 46, (w - 52) * pv, 14);
      }
      break;
    }
    case 6: {
      // sparkline
      ctx.fillStyle = "rgba(120,240,240,0.9)";
      ctx.font = `500 24px ${MONO}`;
      ctx.fillText(`${(v(3) * 999).toFixed(2)}`, x + 26, y + 44);
      ctx.strokeStyle = "rgba(63,232,216,0.22)";
      ctx.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.moveTo(x + 26, y + 80 + k * 40);
        ctx.lineTo(x + w - 26, y + 80 + k * 40);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(140,245,245,0.95)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let k = 0; k <= 30; k++) {
        const yy = y + h - 60 - (0.5 + 0.45 * Math.sin(k * 0.55 + step * 0.4 + c.seed) * Math.cos(k * 0.23 + c.seed)) * (h - 140);
        const xx = x + 26 + (k / 30) * (w - 52);
        if (k) ctx.lineTo(xx, yy);
        else ctx.moveTo(xx, yy);
      }
      ctx.stroke();
      break;
    }
    case 7: {
      // dot matrix
      for (let gy = 0; gy < 7; gy++)
        for (let gx = 0; gx < 14; gx++) {
          const on = hash2(c.seed + gx * 31 + gy * 7, Math.floor(step / 2)) > 0.45;
          ctx.fillStyle = on ? p.teal : "rgba(63,232,216,0.2)";
          ctx.fillRect(x + 30 + gx * 31, y + 34 + gy * 32, 18, 18);
        }
      break;
    }
    default: {
      // small shield + big percentage
      shield(ctx, x + 80, y + 90, 90, p.teal);
      ctx.fillStyle = "rgba(150,245,245,0.98)";
      ctx.font = `500 76px ${MONO}`;
      ctx.fillText(`${(60 + v(2) * 39.9).toFixed(1)}%`, x + 150, y + 118);
      textLines(ctx, x + 30, y + 175, w - 60, 4, c.seed, step);
    }
  }
  ctx.restore();
};

export const drawAtlas = (ctx: CanvasRenderingContext2D, step: number, p: Pal) => {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ATLAS_W, ATLAS_H);
  for (let i = 0; i < COLS * ROWS; i++) drawCell(ctx, i, step, p);
};

export const cellAspect = (idx: number) => {
  void idx;
  return (CELL_W - 36) / (CELL_H - 36);
};
