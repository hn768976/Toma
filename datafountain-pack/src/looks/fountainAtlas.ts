import * as THREE from "three";
import { MONO, SANS, fontsReady } from "../lib/fonts";
import { mulberry32, range, type Rng } from "../lib/random";

/**
 * 2048² atlas of generic pictograms, text blocks and mini charts, all drawn
 * in code (white on transparent). 8×8 cells of 256 px.
 *   cells 0–8   : globe, pin, wifi, cloud, gear, chart, mail, people, lock
 *   cells 9–24  : tall see-through "towers" of tiny text lines
 *   cells 25–40 : text blocks / "window" grids
 *   cells 41–55 : tiny charts
 *   cells 56–63 : badges (icon inside a ring) and brackets
 */
export const ATLAS_GRID = 8;
export const CELL = 256;
export const ICON_CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
export const TOWER_CELLS = Array.from({ length: 16 }, (_, i) => 9 + i);
export const TEXT_CELLS = Array.from({ length: 16 }, (_, i) => 25 + i);
export const CHART_CELLS = Array.from({ length: 15 }, (_, i) => 41 + i);
export const BADGE_CELLS = Array.from({ length: 8 }, (_, i) => 56 + i);

type Ctx = CanvasRenderingContext2D;

const icon = (ctx: Ctx, kind: number, s: number) => {
  // draws centred at 0,0 within ±s
  ctx.beginPath();
  switch (kind) {
    case 0: // globe
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.moveTo(0, -s);
      ctx.ellipse(0, 0, s * 0.42, s, 0, 0, Math.PI * 2);
      ctx.moveTo(-s, 0); ctx.lineTo(s, 0);
      ctx.moveTo(-s * 0.87, -s * 0.5); ctx.lineTo(s * 0.87, -s * 0.5);
      ctx.moveTo(-s * 0.87, s * 0.5); ctx.lineTo(s * 0.87, s * 0.5);
      ctx.stroke();
      break;
    case 1: // location pin
      ctx.moveTo(0, s);
      ctx.bezierCurveTo(-s * 0.2, s * 0.45, -s * 0.75, s * 0.05, -s * 0.75, -s * 0.3);
      ctx.arc(0, -s * 0.3, s * 0.75, Math.PI, 0);
      ctx.bezierCurveTo(s * 0.75, s * 0.05, s * 0.2, s * 0.45, 0, s);
      ctx.moveTo(s * 0.3, -s * 0.3);
      ctx.arc(0, -s * 0.3, s * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 2: // wi-fi
      for (let i = 1; i <= 3; i++) {
        ctx.moveTo(Math.cos(-Math.PI * 0.75) * s * i * 0.33, s * 0.6 + Math.sin(-Math.PI * 0.75) * s * i * 0.33);
        ctx.arc(0, s * 0.6, s * i * 0.33, -Math.PI * 0.75, -Math.PI * 0.25);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, s * 0.6, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 3: // cloud
      ctx.moveTo(-s * 0.7, s * 0.45);
      ctx.arc(-s * 0.55, s * 0.05, s * 0.4, Math.PI * 0.6, Math.PI * 1.45);
      ctx.arc(-s * 0.05, -s * 0.2, s * 0.55, Math.PI * 1.1, Math.PI * 1.9);
      ctx.arc(s * 0.55, s * 0.1, s * 0.38, Math.PI * 1.5, Math.PI * 0.45);
      ctx.closePath();
      ctx.stroke();
      break;
    case 4: { // gear
      const teeth = 8;
      for (let i = 0; i < teeth * 2; i++) {
        const a0 = (i / (teeth * 2)) * Math.PI * 2;
        const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 ? s * 0.72 : s;
        if (i === 0) ctx.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
        ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
        ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
      }
      ctx.closePath();
      ctx.moveTo(s * 0.3, 0);
      ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 5: // bar chart
      ctx.moveTo(-s, -s); ctx.lineTo(-s, s); ctx.lineTo(s, s);
      ctx.stroke();
      [0.35, 0.7, 0.5, 0.95].forEach((v, i) => ctx.fillRect(-s * 0.75 + i * s * 0.45, s - v * s * 1.8, s * 0.28, v * s * 1.8 - s * 0.05));
      break;
    case 6: // mail
      ctx.rect(-s, -s * 0.65, s * 2, s * 1.3);
      ctx.moveTo(-s, -s * 0.65); ctx.lineTo(0, s * 0.15); ctx.lineTo(s, -s * 0.65);
      ctx.stroke();
      break;
    case 7: // people
      ctx.arc(-s * 0.35, -s * 0.35, s * 0.28, 0, Math.PI * 2);
      ctx.moveTo(s * 0.63, -s * 0.25);
      ctx.arc(s * 0.4, -s * 0.25, s * 0.23, 0, Math.PI * 2);
      ctx.moveTo(-s * 0.95, s * 0.75);
      ctx.quadraticCurveTo(-s * 0.95, s * 0.05, -s * 0.35, s * 0.05);
      ctx.quadraticCurveTo(s * 0.25, s * 0.05, s * 0.25, s * 0.75);
      ctx.moveTo(s * 0.45, s * 0.15);
      ctx.quadraticCurveTo(s * 0.95, s * 0.15, s * 0.95, s * 0.7);
      ctx.stroke();
      break;
    case 8: // lock
      ctx.rect(-s * 0.7, -s * 0.1, s * 1.4, s * 1.05);
      ctx.moveTo(-s * 0.45, -s * 0.1);
      ctx.lineTo(-s * 0.45, -s * 0.45);
      ctx.arc(0, -s * 0.45, s * 0.45, Math.PI, 0);
      ctx.lineTo(s * 0.45, -s * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, s * 0.35, s * 0.13, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
};

const textBlock = (ctx: Ctx, rng: Rng) => {
  const style = rng();
  ctx.fillStyle = "#fff";
  if (style < 0.4) {
    // column of tiny text lines
    const lines = 6 + Math.floor(rng() * 10);
    const lh = 180 / lines;
    let y = 38;
    if (rng() < 0.6) {
      ctx.font = `600 22px "${SANS}"`;
      ctx.fillText(["DATA", "NODE", "SYNC", "INDEX", "TOTAL", "LOG"][Math.floor(rng() * 6)] + " " + Math.floor(rng() * 9000 + 1000), 30, y + 10);
      y += 34;
    }
    for (let i = 0; i < lines && y < 226; i++) {
      const w = range(rng, 40, 196);
      ctx.globalAlpha = range(rng, 0.55, 1);
      ctx.fillRect(30, y, w, Math.max(3, lh * 0.38));
      y += lh;
    }
    ctx.globalAlpha = 1;
  } else if (style < 0.7) {
    // "window" grid like a lit tower
    const cols = 3 + Math.floor(rng() * 4);
    const rows = 6 + Math.floor(rng() * 8);
    const cw = 190 / cols;
    const rh = 200 / rows;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (rng() < 0.25) continue;
        ctx.globalAlpha = range(rng, 0.4, 1);
        ctx.fillRect(33 + c * cw, 28 + r * rh, cw * 0.7, rh * 0.45);
      }
    ctx.globalAlpha = 1;
  } else {
    // real tiny text: numbers in mono
    ctx.font = `400 19px "${MONO}"`;
    const lines = 5 + Math.floor(rng() * 5);
    for (let i = 0; i < lines; i++) {
      ctx.globalAlpha = range(rng, 0.6, 1);
      let s = "";
      const n = 3 + Math.floor(rng() * 9);
      for (let k = 0; k < n; k++) s += "0123456789ABCDEF.:-"[Math.floor(rng() * 19)];
      ctx.fillText(s, 28, 44 + i * 24);
    }
    ctx.globalAlpha = 1;
  }
};

/** A tall, narrow column of tiny text lines (a dim "data tower"). */
const tower = (ctx: Ctx, rng: Rng) => {
  ctx.fillStyle = "#fff";
  const cols = 1 + Math.floor(rng() * 3);
  const colW = 34 + rng() * 20;
  const x0 = 128 - (cols * (colW + 8)) / 2;
  const top = 18 + rng() * 60;
  for (let c = 0; c < cols; c++) {
    for (let y = top; y < 236; y += 7) {
      if (rng() < 0.12) continue;
      ctx.globalAlpha = range(rng, 0.35, 1);
      ctx.fillRect(x0 + c * (colW + 8), y, colW * range(rng, 0.35, 1), 3);
    }
  }
  ctx.globalAlpha = 0.5;
  ctx.fillRect(x0 - 4, top - 6, 2, 236 - top);
  ctx.globalAlpha = 1;
};

const chart = (ctx: Ctx, rng: Rng) => {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 6;
  const kind = rng();
  if (kind < 0.75) {
    const n = 4 + Math.floor(rng() * 6);
    for (let i = 0; i < n; i++) {
      const v = range(rng, 0.2, 1);
      ctx.fillRect(40 + i * (176 / n), 216 - v * 150, (176 / n) * 0.6, v * 150);
    }
  } else if (kind < 0.97) {
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const x = 36 + i * 23;
      const y = 200 - range(rng, 0.1, 0.9) * 150;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(128, 128, 78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.arc(128, 128, 78, -Math.PI / 2, -Math.PI / 2 + range(rng, 0.8, 4.5));
    ctx.closePath();
    ctx.fill();
  }
};

let atlasPromise: Promise<THREE.CanvasTexture> | null = null;
export const fountainAtlas = () => {
  if (!atlasPromise) {
    atlasPromise = fontsReady().then(() => {
      const c = document.createElement("canvas");
      c.width = c.height = ATLAS_GRID * CELL;
      const ctx = c.getContext("2d")!;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const rng = mulberry32(0xa71a5);
      const cell = (i: number, fn: () => void) => {
        ctx.save();
        ctx.translate((i % ATLAS_GRID) * CELL, Math.floor(i / ATLAS_GRID) * CELL);
        ctx.beginPath();
        ctx.rect(16, 16, CELL - 32, CELL - 32); // keep a transparent gutter
        ctx.clip();
        fn();
        ctx.restore();
      };
      ICON_CELLS.forEach((ci, k) =>
        cell(ci, () => {
          ctx.translate(CELL / 2, CELL / 2);
          ctx.strokeStyle = "#fff";
          ctx.fillStyle = "#fff";
          ctx.lineWidth = 13;
          icon(ctx, k, 78);
        }),
      );
      TOWER_CELLS.forEach((ci) => cell(ci, () => tower(ctx, rng)));
      TEXT_CELLS.forEach((ci) => cell(ci, () => textBlock(ctx, rng)));
      CHART_CELLS.forEach((ci) => cell(ci, () => chart(ctx, rng)));
      BADGE_CELLS.forEach((ci, k) =>
        cell(ci, () => {
          ctx.translate(CELL / 2, CELL / 2);
          ctx.strokeStyle = "#fff";
          ctx.fillStyle = "#fff";
          ctx.lineWidth = 9;
          ctx.beginPath();
          ctx.arc(0, 0, 96, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 11;
          icon(ctx, [0, 1, 8, 2, 4, 7, 6, 3][k], 54);
        }),
      );
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.premultiplyAlpha = true;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      return tex;
    });
  }
  return atlasPromise;
};
