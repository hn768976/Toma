import * as THREE from "three";
import { createRng } from "../engine/random";

export const FONT_FAMILY = "Barlow Condensed";

const TICKERS = [
  "PPT",
  "UOT",
  "HGK",
  "AMS",
  "UVD",
  "YJS",
  "HJU",
  "YZT",
  "QUA",
  "MXR",
  "LKM",
  "CWW",
  "OPJ",
  "KDQ",
  "IUA",
  "IKD",
  "NRS",
  "SHC",
  "OEM",
  "EQU",
  "OEQ",
  "UQC",
  "LBC",
  "OCD",
  "NEM",
  "KHU",
  "FTM",
  "ZPT",
  "VWW",
  "DAK",
  "KBY",
  "BEM",
  "DIY",
  "TVW",
  "IYJ",
  "FEK",
  "REY",
  "BTV",
  "GKQ",
  "SKF",
  "XAM",
  "MSW",
  "LBY",
  "GFY",
  "JGR",
  "EQC",
  "RJS",
  "DSV",
  "ZTH",
  "YFR",
  "MZI",
  "FOC",
  "TDY",
  "VBA",
];

const fmt = (v: number) => v.toFixed(2);

const triangle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y - s * 0.42);
  ctx.lineTo(x + s * 0.5, y - s * 0.42);
  ctx.lineTo(x, y + s * 0.45);
  ctx.closePath();
  ctx.fill();
};

/**
 * Draws a stock ticker table (white on black – tinted in the shader).
 * 2:1 canvas, rows of: SYMBOL  price  price  change ▼ pct%
 */
export const makeTableTexture = (seed: number, big = false) => {
  const rng = createRng(seed);
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, W, H);
  const rows = big ? 9 : 13;
  const rowH = H / (rows + 0.6);
  const fontPx = Math.round(rowH * 0.78);
  const blocks = big ? 1 : 2;
  const blockW = W / blocks;
  ctx.textBaseline = "middle";
  for (let b = 0; b < blocks; b++) {
    const x0 = b * blockW + blockW * 0.03;
    const cols = [0, 0.16, 0.37, 0.58, 0.77].map((c) => x0 + c * blockW * 0.97);
    for (let r = 0; r < rows; r++) {
      const y = (r + 0.8) * rowH;
      const bright = rng.chance(0.18) ? 1.0 : rng.range(0.55, 0.85);
      const g = Math.round(255 * bright);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.shadowColor = `rgba(255,255,255,${0.55 * bright})`;
      ctx.shadowBlur = fontPx * 0.25;
      const p1 = rng.range(80, 1400);
      const p2 = p1 * rng.range(0.6, 0.92);
      const ch = p1 - p2;
      const pct = rng.range(14, 29);
      ctx.font = `600 ${fontPx}px "${FONT_FAMILY}"`;
      ctx.textAlign = "left";
      ctx.fillText(rng.pick(TICKERS), cols[0], y);
      ctx.font = `500 ${fontPx}px "${FONT_FAMILY}"`;
      ctx.textAlign = "right";
      ctx.fillText(fmt(p1), cols[1] + blockW * 0.17, y);
      ctx.fillText(fmt(p2), cols[2] + blockW * 0.17, y);
      ctx.fillText(fmt(ch), cols[3] + blockW * 0.13, y);
      triangle(ctx, cols[3] + blockW * 0.165, y, fontPx * 0.42);
      ctx.fillText(`${pct.toFixed(2)}%`, cols[4] + blockW * 0.2, y);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
};
