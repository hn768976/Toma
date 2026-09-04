import * as THREE from "three";
import { mulberry32, int, range, pick, type Rng } from "./rng";
import { SEED } from "../config";
import { drawGlyph } from "./glyphs";
import type { Palette } from "../palettes";

/**
 * Canvas-generated textures for the flat, world-oriented surfaces: the
 * holographic card, the floating UI panels and the background gradient.
 *
 * Two-channel packing for card and panels:
 *   R — fill mask (the panel's translucent body)
 *   G — ink mask (border, rules, chart marks)
 * The materials tint both at render time, so one texture serves both palettes.
 */

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const finish = (canvas: HTMLCanvasElement): THREE.Texture => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
};

// --------------------------------------------------------------- the card
let cardCache: THREE.Texture | null = null;

export const CARD_ASPECT = 0.86; // width / height

export const getCardTexture = (): THREE.Texture => {
  if (cardCache) return cardCache;
  const w = 1024;
  const h = Math.round(w / CARD_ASPECT);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  const pad = 26;
  const r = 96;

  // Fill: brighter along the lower edge, as if lit from the platform below.
  const grad = ctx.createLinearGradient(0, pad, 0, h - pad);
  grad.addColorStop(0, "rgb(34,0,0)");
  grad.addColorStop(0.55, "rgb(52,0,0)");
  grad.addColorStop(1, "rgb(96,0,0)");
  ctx.fillStyle = grad;
  roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, r);
  ctx.fill();

  // Border, plus a hairline inset rule.
  ctx.strokeStyle = "rgb(0,255,0)";
  ctx.lineWidth = 9;
  roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, r);
  ctx.stroke();

  ctx.strokeStyle = "rgb(0,70,0)";
  ctx.lineWidth = 3;
  roundRect(ctx, pad + 22, pad + 22, w - (pad + 22) * 2, h - (pad + 22) * 2, r - 20);
  ctx.stroke();

  cardCache = finish(canvas);
  return cardCache;
};

// -------------------------------------------------------- floating panels
export type PanelSpec = { aspect: number };

/** Aspect ratios of the six floating panels, widest first. */
export const PANEL_SPECS: readonly PanelSpec[] = [
  { aspect: 1.75 },
  { aspect: 1.3 },
  { aspect: 2.1 },
  { aspect: 1.55 },
  { aspect: 1.15 },
  { aspect: 1.9 },
];

const INK = "rgb(0,255,0)";
const INK_DIM = "rgb(0,120,0)";

/** Text-shaped rules. Deliberately illegible: interface texture, not content. */
const drawTextBlock = (ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number) => {
  const rows = int(rng, 3, 6);
  ctx.strokeStyle = INK_DIM;
  ctx.lineCap = "round";
  for (let i = 0; i < rows; i++) {
    ctx.lineWidth = range(rng, 4, 7);
    const len = w * range(rng, 0.35, 1);
    ctx.beginPath();
    ctx.moveTo(x, y + i * 26);
    ctx.lineTo(x + len, y + i * 26);
    ctx.stroke();
  }
};

const drawBars = (ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number) => {
  const n = int(rng, 6, 11);
  const gap = w / n;
  for (let i = 0; i < n; i++) {
    const bh = h * range(rng, 0.18, 1);
    ctx.fillStyle = i % 3 === 0 ? INK : INK_DIM;
    ctx.fillRect(x + i * gap, y + h - bh, gap * 0.58, bh);
  }
};

const drawSparkline = (ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number) => {
  const n = int(rng, 9, 16);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const px = x + (i / (n - 1)) * w;
    const py = y + h - range(rng, 0.1, 0.95) * h;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
};

const drawTickTable = (ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number) => {
  const cols = int(rng, 5, 9);
  const rows = int(rng, 3, 5);
  const cw = w / cols;
  const ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() < 0.28) continue;
      ctx.fillStyle = rng() < 0.25 ? INK : INK_DIM;
      ctx.fillRect(x + c * cw, y + r * ch + ch * 0.3, cw * range(rng, 0.3, 0.7), ch * 0.32);
    }
  }
};

const drawProgressArc = (ctx: CanvasRenderingContext2D, rng: Rng, cx: number, cy: number, rad: number) => {
  ctx.lineCap = "round";
  ctx.strokeStyle = INK_DIM;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + range(rng, 0.9, 5.2));
  ctx.stroke();
};

const drawShield = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size, size);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.045;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  drawGlyph(ctx, "shield");
  ctx.restore();
};

let panelCache: THREE.Texture[] | null = null;

export const getPanelTextures = (): THREE.Texture[] => {
  if (panelCache) return panelCache;
  const rng = mulberry32(SEED ^ 0x9e37_79b9);

  panelCache = PANEL_SPECS.map((spec) => {
    const w = 1024;
    const h = Math.round(w / spec.aspect);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    const pad = 16;
    ctx.fillStyle = "rgb(46,0,0)";
    roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, 22);
    ctx.fill();

    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, 22);
    ctx.stroke();

    // Title rule along the top, then two content zones.
    ctx.strokeStyle = INK_DIM;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pad + 28, pad + 62);
    ctx.lineTo(w - pad - 28, pad + 62);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillRect(pad + 28, pad + 28, range(rng, 90, 240), 12);

    const zoneY = pad + 96;
    const zoneH = h - zoneY - pad - 28;
    const kinds = ["bars", "spark", "table", "arc", "shield", "text"] as const;
    const left = pick(rng, kinds);
    const right = pick(rng, kinds);
    const halfW = (w - pad * 2 - 84) / 2;

    const drawZone = (kind: (typeof kinds)[number], x: number) => {
      switch (kind) {
        case "bars":
          drawBars(ctx, rng, x, zoneY, halfW, zoneH);
          break;
        case "spark":
          drawSparkline(ctx, rng, x, zoneY, halfW, zoneH);
          break;
        case "table":
          drawTickTable(ctx, rng, x, zoneY, halfW, zoneH);
          break;
        case "arc":
          drawProgressArc(ctx, rng, x + halfW / 2, zoneY + zoneH / 2, Math.min(halfW, zoneH) * 0.38);
          break;
        case "shield":
          drawShield(ctx, x + halfW / 2, zoneY + zoneH / 2, Math.min(halfW, zoneH) * 0.9);
          break;
        case "text":
          drawTextBlock(ctx, rng, x, zoneY + 14, halfW);
          break;
      }
    };

    drawZone(left, pad + 42);
    drawZone(right, pad + 42 + halfW + 42);

    return finish(canvas);
  });

  return panelCache;
};

// --------------------------------------------------- background gradient
const bgCache = new Map<string, THREE.Texture>();

/**
 * Rendered as the scene background so the canvas stays opaque — additive
 * blending only reads correctly against a real backdrop, not a transparent one
 * composited by the browser.
 */
export const getBackgroundTexture = (palette: Palette): THREE.Texture => {
  const hit = bgCache.get(palette.id);
  if (hit) return hit;

  const w = 1280;
  const h = 720;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = palette.bgCorner;
  ctx.fillRect(0, 0, w, h);

  // The lift sits behind and slightly below the platform, where the core is.
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.62, 0, w * 0.5, h * 0.62, w * 0.62);
  grad.addColorStop(0, palette.bgCenter);
  grad.addColorStop(0.5, palette.bgCenter);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  bgCache.set(palette.id, tex);
  return tex;
};
