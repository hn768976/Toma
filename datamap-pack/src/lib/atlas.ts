import * as THREE from "three";
import { INTER, MONO } from "./fonts";

// Glyph atlas drawn once with Canvas 2D (after the fonts have loaded): Inter
// for digits/percent, JetBrains Mono for HUD codes, plus a triangle and a
// solid cell for bar fills. A gaussian-blurred copy is used for depth of field.

export const CELL_W = 112;
export const CELL_H = 128;
export const FONT_PX = 72;
const COLS = 16;

export type Glyph = {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  adv: number; // advance in units of font size
};

export type Atlas = {
  sharp: THREE.Texture;
  blur: THREE.Texture;
  glyph: (font: "num" | "code", ch: string) => Glyph;
  fill: Glyph;
  tri: Glyph;
};

const NUM_CHARS = "0123456789%.";
const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-:/.";

let cached: Atlas | null = null;

export const getAtlas = (): Atlas => {
  if (cached) return cached;
  const entries: { key: string; draw: (ctx: CanvasRenderingContext2D, cx: number, base: number) => number }[] = [];
  for (const ch of NUM_CHARS)
    entries.push({
      key: "num" + ch,
      draw: (ctx, cx, base) => {
        ctx.font = `500 ${FONT_PX}px "${INTER}"`;
        const w = ctx.measureText(ch).width;
        ctx.fillText(ch, cx - w / 2, base);
        return w / FONT_PX;
      },
    });
  for (const ch of CODE_CHARS)
    entries.push({
      key: "code" + ch,
      draw: (ctx, cx, base) => {
        ctx.font = `500 ${FONT_PX}px "${MONO}"`;
        const w = ctx.measureText(ch).width;
        ctx.fillText(ch, cx - w / 2, base);
        return w / FONT_PX;
      },
    });
  entries.push({
    key: "tri",
    draw: (ctx, cx, base) => {
      const s = FONT_PX * 0.62;
      ctx.beginPath();
      ctx.moveTo(cx, base - s);
      ctx.lineTo(cx + s * 0.58, base);
      ctx.lineTo(cx - s * 0.58, base);
      ctx.closePath();
      ctx.fill();
      return 0.8;
    },
  });
  entries.push({
    key: "fill",
    draw: (ctx, cx) => {
      ctx.fillRect(cx - CELL_W / 2 + 24, 24, CELL_W - 48, CELL_H - 48);
      return 1;
    },
  });
  const rows = Math.ceil(entries.length / COLS);
  const W = COLS * CELL_W;
  const H = rows * CELL_H;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  const map = new Map<string, Glyph>();
  entries.forEach((e, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x0 = col * CELL_W;
    const y0 = row * CELL_H;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, CELL_W, CELL_H);
    ctx.clip();
    ctx.translate(x0, y0);
    // Baseline so that cap height sits centred in the cell.
    const adv = e.draw(ctx, CELL_W / 2, CELL_H / 2 + FONT_PX * 0.36);
    ctx.restore();
    // Texture v runs bottom-up (flipY), so v0 is the cell's bottom edge.
    map.set(e.key, {
      u0: x0 / W,
      u1: (x0 + CELL_W) / W,
      v0: 1 - (y0 + CELL_H) / H,
      v1: 1 - y0 / H,
      adv,
    });
  });
  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = W;
  blurCanvas.height = H;
  const bctx = blurCanvas.getContext("2d")!;
  bctx.filter = "blur(9px)";
  bctx.drawImage(canvas, 0, 0);
  // Brighten the blurred copy a little so a defocused glyph keeps roughly
  // the same energy instead of vanishing.
  bctx.filter = "none";
  bctx.globalCompositeOperation = "lighter";
  bctx.globalAlpha = 0.3;
  bctx.drawImage(blurCanvas, 0, 0);

  const tex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  const get = (k: string) => {
    const g = map.get(k);
    if (!g) throw new Error("glyph missing: " + k);
    return g;
  };
  cached = {
    sharp: tex(canvas),
    blur: tex(blurCanvas),
    glyph: (font, ch) => get(font + ch),
    fill: get("fill"),
    tri: get("tri"),
  };
  return cached;
};
