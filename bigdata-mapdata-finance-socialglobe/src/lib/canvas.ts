import * as THREE from "three";
import { MONO } from "./assets";

/** Canvas 2D -> texture: sRGB, mipmapped, 16x anisotropic. */
export const canvasTexture = (
  canvas: HTMLCanvasElement,
  opts: { repeat?: boolean; srgb?: boolean; aniso?: number } = {},
) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = opts.aniso ?? 16;
  t.premultiplyAlpha = false;
  if (opts.repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.needsUpdate = true;
  return t;
};

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
};

// ---------------------------------------------------------------------------
// Glyph atlas (JetBrains Mono). Used by the GPU widget batches for every piece
// of text that changes over time (rolling digits, ticking counters).

export const GLYPHS =
  " 0123456789.,:;+-%/#*()[]<>=_|ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$@!?'\"•▲▼";

export type GlyphAtlas = {
  texture: THREE.Texture;
  cols: number;
  rows: number;
  /** glyph advance / glyph cell height (monospace). */
  advance: number;
  index: (ch: string) => number;
};

let atlasCache: GlyphAtlas | null = null;

export const glyphAtlas = (): GlyphAtlas => {
  if (atlasCache) return atlasCache;
  const cell = 128; // px per cell (square cells; glyph drawn at ~0.78 cell)
  const cols = 16;
  const rows = Math.ceil(GLYPHS.length / cols);
  const { c, ctx } = makeCanvas(cols * cell, rows * cell);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#fff";
  const fontPx = 96;
  ctx.font = `500 ${fontPx}px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const chars = Array.from(GLYPHS);
  chars.forEach((ch, i) => {
    const x = (i % cols) * cell + cell / 2;
    const y = Math.floor(i / cols) * cell + cell / 2;
    ctx.fillText(ch, x, y + fontPx * 0.04);
  });
  const advance = ctx.measureText("0").width / fontPx; // ~0.6
  const map = new Map<string, number>();
  chars.forEach((ch, i) => map.set(ch, i));
  const texture = canvasTexture(c, { srgb: false });
  atlasCache = {
    texture,
    cols,
    rows,
    advance,
    index: (ch) => map.get(ch) ?? 0,
  };
  return atlasCache;
};

// ---------------------------------------------------------------------------
// Self-drawn line icons (white strokes on transparent), one per atlas cell.

export const ICONS = [
  "person",
  "cloud",
  "database",
  "chart",
  "phone",
  "globe",
  "chat",
  "folder",
  "shield",
  "house",
  "headphones",
  "note",
  "camera",
  "mail",
  "gear",
  "wifi",
  "monitor",
  "lockSmall",
  "doc",
  "pin",
] as const;
export type IconName = (typeof ICONS)[number];

const drawIcon = (ctx: CanvasRenderingContext2D, name: IconName, s: number) => {
  // Draw in a [0,1] box scaled by s, centred on origin.
  const P = (x: number) => (x - 0.5) * s;
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(P(x), P(y), w * s, h * s, r * s);
  };
  const circ = (x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.arc(P(x), P(y), r * s, 0, Math.PI * 2);
  };
  const line = (pts: number[]) => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      if (i === 0) ctx.moveTo(P(pts[i]), P(pts[i + 1]));
      else ctx.lineTo(P(pts[i]), P(pts[i + 1]));
    }
  };
  switch (name) {
    case "person": {
      // Head and shoulders, filled (reads as a glowing figure when small).
      circ(0.5, 0.33, 0.17);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(P(0.14), P(0.92));
      ctx.quadraticCurveTo(P(0.14), P(0.56), P(0.5), P(0.56));
      ctx.quadraticCurveTo(P(0.86), P(0.56), P(0.86), P(0.92));
      ctx.closePath();
      ctx.fill();
      return;
    }
    case "cloud":
      ctx.beginPath();
      ctx.moveTo(P(0.24), P(0.72));
      ctx.arc(P(0.26), P(0.56), 0.16 * s, Math.PI * 0.55, Math.PI * 1.45);
      ctx.arc(P(0.48), P(0.44), 0.21 * s, Math.PI * 1.1, Math.PI * 1.95);
      ctx.arc(P(0.74), P(0.58), 0.15 * s, Math.PI * 1.45, Math.PI * 0.5);
      ctx.closePath();
      ctx.stroke();
      return;
    case "database":
      ctx.beginPath();
      ctx.ellipse(P(0.5), P(0.24), 0.3 * s, 0.1 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      line([0.2, 0.24, 0.2, 0.76]);
      ctx.stroke();
      line([0.8, 0.24, 0.8, 0.76]);
      ctx.stroke();
      for (const y of [0.5, 0.76]) {
        ctx.beginPath();
        ctx.ellipse(P(0.5), P(y), 0.3 * s, 0.1 * s, 0, 0, Math.PI);
        ctx.stroke();
      }
      return;
    case "chart":
      line([0.14, 0.12, 0.14, 0.86, 0.88, 0.86]);
      ctx.stroke();
      for (const [x, h] of [
        [0.3, 0.3],
        [0.48, 0.5],
        [0.66, 0.38],
        [0.82, 0.62],
      ]) {
        ctx.fillRect(P(x - 0.05), P(0.8 - h), 0.1 * s, h * s);
      }
      return;
    case "phone":
      rr(0.3, 0.1, 0.4, 0.8, 0.07);
      ctx.stroke();
      line([0.44, 0.2, 0.56, 0.2]);
      ctx.stroke();
      circ(0.5, 0.78, 0.03);
      ctx.fill();
      return;
    case "globe":
      circ(0.5, 0.5, 0.38);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(P(0.5), P(0.5), 0.16 * s, 0.38 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      line([0.12, 0.5, 0.88, 0.5]);
      ctx.stroke();
      line([0.18, 0.31, 0.82, 0.31]);
      ctx.stroke();
      line([0.18, 0.69, 0.82, 0.69]);
      ctx.stroke();
      return;
    case "chat":
      ctx.beginPath();
      ctx.roundRect(P(0.12), P(0.18), 0.76 * s, 0.5 * s, 0.1 * s);
      ctx.stroke();
      line([0.3, 0.68, 0.26, 0.86, 0.46, 0.68]);
      ctx.stroke();
      for (const x of [0.32, 0.5, 0.68]) {
        circ(x, 0.43, 0.04);
        ctx.fill();
      }
      return;
    case "folder":
      line([0.1, 0.8, 0.1, 0.22, 0.38, 0.22, 0.46, 0.32, 0.9, 0.32, 0.9, 0.8]);
      ctx.closePath();
      ctx.stroke();
      line([0.1, 0.42, 0.9, 0.42]);
      ctx.stroke();
      return;
    case "shield":
      ctx.beginPath();
      ctx.moveTo(P(0.5), P(0.08));
      ctx.lineTo(P(0.84), P(0.2));
      ctx.quadraticCurveTo(P(0.84), P(0.72), P(0.5), P(0.92));
      ctx.quadraticCurveTo(P(0.16), P(0.72), P(0.16), P(0.2));
      ctx.closePath();
      ctx.stroke();
      line([0.34, 0.5, 0.46, 0.62, 0.68, 0.38]);
      ctx.stroke();
      return;
    case "house":
      line([0.12, 0.48, 0.5, 0.14, 0.88, 0.48]);
      ctx.stroke();
      line([0.22, 0.4, 0.22, 0.86, 0.78, 0.86, 0.78, 0.4]);
      ctx.stroke();
      ctx.strokeRect(P(0.42), P(0.6), 0.16 * s, 0.26 * s);
      return;
    case "headphones":
      ctx.beginPath();
      ctx.arc(P(0.5), P(0.52), 0.34 * s, Math.PI, 0);
      ctx.stroke();
      rr(0.12, 0.52, 0.16, 0.3, 0.05);
      ctx.fill();
      rr(0.72, 0.52, 0.16, 0.3, 0.05);
      ctx.fill();
      return;
    case "note":
      line([0.38, 0.74, 0.38, 0.16, 0.8, 0.08, 0.8, 0.64]);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(P(0.29), P(0.76), 0.11 * s, 0.08 * s, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(P(0.71), P(0.66), 0.11 * s, 0.08 * s, -0.4, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "camera":
      rr(0.1, 0.3, 0.8, 0.54, 0.06);
      ctx.stroke();
      line([0.34, 0.3, 0.4, 0.18, 0.6, 0.18, 0.66, 0.3]);
      ctx.stroke();
      circ(0.5, 0.57, 0.15);
      ctx.stroke();
      return;
    case "mail":
      ctx.strokeRect(P(0.1), P(0.24), 0.8 * s, 0.52 * s);
      line([0.1, 0.24, 0.5, 0.54, 0.9, 0.24]);
      ctx.stroke();
      return;
    case "gear": {
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const r = i % 2 === 0 ? 0.38 : 0.3;
        const x = Math.cos(a) * r * s;
        const y = Math.sin(a) * r * s;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      circ(0.5, 0.5, 0.12);
      ctx.stroke();
      return;
    }
    case "wifi":
      for (const r of [0.16, 0.3, 0.44]) {
        ctx.beginPath();
        ctx.arc(P(0.5), P(0.78), r * s, Math.PI * 1.25, Math.PI * 1.75);
        ctx.stroke();
      }
      circ(0.5, 0.78, 0.05);
      ctx.fill();
      return;
    case "monitor":
      rr(0.1, 0.16, 0.8, 0.52, 0.04);
      ctx.stroke();
      line([0.5, 0.68, 0.5, 0.82]);
      ctx.stroke();
      line([0.32, 0.84, 0.68, 0.84]);
      ctx.stroke();
      return;
    case "lockSmall":
      rr(0.22, 0.44, 0.56, 0.44, 0.06);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(P(0.5), P(0.44), 0.18 * s, Math.PI, 0);
      ctx.stroke();
      circ(0.5, 0.64, 0.05);
      ctx.fill();
      return;
    case "doc":
      line([0.22, 0.08, 0.6, 0.08, 0.78, 0.26, 0.78, 0.92, 0.22, 0.92]);
      ctx.closePath();
      ctx.stroke();
      for (const y of [0.42, 0.56, 0.7]) {
        line([0.34, y, 0.66, y]);
        ctx.stroke();
      }
      return;
    case "pin":
      ctx.beginPath();
      ctx.arc(P(0.5), P(0.38), 0.24 * s, Math.PI * 0.85, Math.PI * 2.15);
      ctx.lineTo(P(0.5), P(0.92));
      ctx.closePath();
      ctx.stroke();
      circ(0.5, 0.38, 0.08);
      ctx.fill();
      return;
  }
};

export type IconAtlas = {
  texture: THREE.Texture;
  cols: number;
  rows: number;
  index: (n: IconName) => number;
};

let iconCache: IconAtlas | null = null;

export const iconAtlas = (): IconAtlas => {
  if (iconCache) return iconCache;
  const cell = 128;
  const cols = 8;
  const rows = Math.ceil(ICONS.length / cols);
  const { c, ctx } = makeCanvas(cols * cell, rows * cell);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineWidth = cell * 0.055;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ICONS.forEach((name, i) => {
    ctx.save();
    ctx.translate((i % cols) * cell + cell / 2, Math.floor(i / cols) * cell + cell / 2);
    drawIcon(ctx, name, cell * 0.74);
    ctx.restore();
  });
  const texture = canvasTexture(c, { srgb: false });
  iconCache = {
    texture,
    cols,
    rows,
    index: (n) => ICONS.indexOf(n),
  };
  return iconCache;
};
