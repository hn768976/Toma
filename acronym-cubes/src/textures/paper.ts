// The printed stock-chart sheet, drawn once per acronym into an 8192 px
// canvas. Paper, grid and dashed rule use a FIXED seed, so they are identical
// in all 13 compositions; only the price line and volume bars change.
// No numbers, labels, tickers or currency anywhere.

import type { AcronymRow } from "../data/acronyms";
import { priceLine, volumeBars } from "../lib/chart";
import { makeNoise2D, fbm2, seeded } from "../lib/prng";
import {
  DASHED_Z,
  PAPER_H,
  PAPER_TEX_H,
  PAPER_TEX_W,
  PAPER_W,
  PAPER_Z0,
  VOLUME_BASE_Z,
} from "../lib/world";

const PX = PAPER_TEX_W / PAPER_W; // canvas pixels per world unit
const px = (x: number) => (x + PAPER_W / 2) * PX;
const py = (z: number) => (z - (PAPER_Z0 - PAPER_H / 2)) * PX;

export const PAPER_RGB = [210, 224, 236] as const; // pale blue-grey
const RULE = "rgba(150, 166, 182, 0.55)";
const DOT = "rgba(138, 154, 170, 0.5)";
const DASH = "rgba(104, 116, 128, 0.9)";
const LINE = "#33a07b";
const BAR = "rgba(126, 136, 147, 0.8)";
export const RULE_SPACING = 0.98;

const drawPaperBase = (ctx: CanvasRenderingContext2D) => {
  const W = PAPER_TEX_W;
  const H = PAPER_TEX_H;
  const rng = seeded("paper-base", 1);
  ctx.fillStyle = `rgb(${PAPER_RGB.join(",")})`;
  ctx.fillRect(0, 0, W, H);

  // Very slightly uneven brightness: a smooth low-frequency field, drawn at
  // low resolution and scaled up.
  const lo = document.createElement("canvas");
  lo.width = 256;
  lo.height = 144;
  const lctx = lo.getContext("2d")!;
  const img = lctx.createImageData(lo.width, lo.height);
  const n = makeNoise2D(rng);
  for (let y = 0; y < lo.height; y++) {
    for (let x = 0; x < lo.width; x++) {
      const v = fbm2(n, x / 40, y / 40, 4) - 0.5;
      const i = (y * lo.width + x) * 4;
      const c = v > 0 ? 255 : 0;
      img.data[i] = c;
      img.data[i + 1] = c;
      img.data[i + 2] = c;
      img.data[i + 3] = Math.round(Math.min(Math.abs(v) * 2, 1) * 255 * 0.07);
    }
  }
  lctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(lo, 0, 0, W, H);

  // Fibre texture: a fine noise tile (soft-light) plus thousands of faint,
  // short fibres.
  const tile = document.createElement("canvas");
  tile.width = 1024;
  tile.height = 1024;
  const tctx = tile.getContext("2d")!;
  const timg = tctx.createImageData(1024, 1024);
  const fn = makeNoise2D(rng);
  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 1024; x++) {
      const v =
        0.55 * (rng() - 0.5) + 0.45 * (fn(x / 3.1, y / 9.7) - 0.5) + 0.35 * (fn(x / 23, y / 7) - 0.5);
      const i = (y * 1024 + x) * 4;
      const c = 128 + v * 60;
      timg.data[i] = c;
      timg.data[i + 1] = c;
      timg.data[i + 2] = c;
      timg.data[i + 3] = 255;
    }
  }
  tctx.putImageData(timg, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = ctx.createPattern(tile, "repeat")!;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < 26000; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const len = 10 + rng() * 55;
    const a = rng() * Math.PI * 2;
    const bend = (rng() - 0.5) * len * 0.6;
    const light = rng() < 0.5;
    ctx.strokeStyle = light ? "rgba(255,255,255,0.10)" : "rgba(90,105,120,0.07)";
    ctx.lineWidth = 0.7 + rng() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(a) * len * 0.5 - Math.sin(a) * bend,
      y + Math.sin(a) * len * 0.5 + Math.cos(a) * bend,
      x + Math.cos(a) * len,
      y + Math.sin(a) * len,
    );
    ctx.stroke();
  }
  ctx.restore();

  // Grid: faint horizontal rules and a fine dot grid between them.
  ctx.save();
  const zTop = PAPER_Z0 - PAPER_H / 2;
  const zBot = PAPER_Z0 + PAPER_H / 2;
  const first = Math.ceil((zTop - 0.3) / RULE_SPACING) * RULE_SPACING + 0.3;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 6.5;
  for (let z = first; z < zBot; z += RULE_SPACING) {
    if (Math.abs(z - DASHED_Z) < 0.2) continue;
    ctx.beginPath();
    ctx.moveTo(0, py(z));
    ctx.lineTo(W, py(z));
    ctx.stroke();
  }
  ctx.fillStyle = DOT;
  const dx = RULE_SPACING / 8;
  const dz = RULE_SPACING / 4;
  for (let z = first + dz; z < zBot; z += dz) {
    const onRule = Math.abs(((z - first) / RULE_SPACING) % 1) < 0.01;
    if (onRule) continue;
    for (let x = -PAPER_W / 2 + dx / 2; x < PAPER_W / 2; x += dx) {
      ctx.beginPath();
      ctx.arc(px(x), py(z), 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Dashed rule near the top.
  ctx.save();
  ctx.strokeStyle = DASH;
  ctx.lineWidth = 8;
  ctx.setLineDash([0.12 * PX, 0.085 * PX]);
  ctx.beginPath();
  ctx.moveTo(0, py(DASHED_Z));
  ctx.lineTo(W, py(DASHED_Z));
  ctx.stroke();
  ctx.restore();
};

const drawChart = (ctx: CanvasRenderingContext2D, row: AcronymRow) => {
  // Volume bars along the bottom.
  ctx.save();
  ctx.fillStyle = BAR;
  for (const b of volumeBars(row)) {
    ctx.fillRect(px(b.x) - 4, py(VOLUME_BASE_Z - b.h), 8, b.h * PX + 400);
  }
  ctx.restore();

  // Price line: thin, green, jagged. A faint soft pass under the crisp pass
  // makes it read as ink on paper rather than a vector stroke.
  const pts = priceLine(row);
  const path = () => {
    ctx.beginPath();
    pts.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), py(z)) : ctx.moveTo(px(x), py(z))));
  };
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(47,157,116,0.22)";
  ctx.lineWidth = 22;
  ctx.filter = "blur(4px)";
  path();
  ctx.stroke();
  ctx.filter = "none";
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 13;
  path();
  ctx.stroke();
  ctx.restore();
};

const cache = new Map<string, HTMLCanvasElement>();

export const paperCanvas = (row: AcronymRow): HTMLCanvasElement => {
  const key = `${row.id}/${row.seed}/${row.shape}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = PAPER_TEX_W;
  c.height = PAPER_TEX_H;
  const ctx = c.getContext("2d")!;
  drawPaperBase(ctx);
  drawChart(ctx, row);
  cache.set(key, c);
  return c;
};
