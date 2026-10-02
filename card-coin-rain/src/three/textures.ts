import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
} from "three";
import { CARD_H, CARD_W } from "../lib/loop";
import { COIN_EDGE_V } from "./geometry";
import { fbm, heightToNormal, vnoise, worley } from "./noise";

const dataTex = (data: Uint8Array, w: number, h: number, repeat = false) => {
  const t = new DataTexture(data, w, h, RGBAFormat, UnsignedByteType);
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
  }
  t.needsUpdate = true;
  return t;
};

const grayTex = (values: Float32Array, w: number, h: number, repeat = false) => {
  const d = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(Math.min(1, Math.max(0, values[i])) * 255);
    d[i * 4] = v;
    d[i * 4 + 1] = v;
    d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  return dataTex(d, w, h, repeat);
};

const ridged = (n: number) => 1 - Math.abs(2 * n - 1);

/** Crinkled gold foil: creased ridged noise at two scales (+ a little fine grain). */
export const makeFoilTextures = () => {
  const w = 2048;
  const h = Math.round((w * CARD_H) / CARD_W);
  const height = new Float32Array(w * h);
  const rough = new Float32Array(w * h);
  const ax = CARD_W / CARD_H;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x / w) * ax;
      const v = y / h;
      const big = ridged(fbm(u * 3.4, v * 3.4, 11, 4));
      const small = ridged(fbm(u * 12 + 3.1, v * 12 + 7.7, 23, 3));
      const fine = vnoise(u * 140, v * 140, 41);
      height[y * w + x] = 0.7 * big * big + 0.22 * small + 0.015 * fine;
      rough[y * w + x] = 0.72 + 0.28 * fbm(u * 9, v * 9, 57, 3);
    }
  }
  return {
    normal: dataTex(heightToNormal(height, w, h, 30), w, h),
    roughness: grayTex(rough, w, h),
  };
};

/** Faint horizontal brushing for the satin rose card. */
export const makeBrushedTextures = () => {
  const w = 2048;
  const h = Math.round((w * CARD_H) / CARD_W);
  const height = new Float32Array(w * h);
  const rough = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const streak = 0.6 * vnoise(u * 6, v * 520, 5) + 0.4 * vnoise(u * 2.5, v * 170, 9);
      height[y * w + x] = streak + 0.15 * fbm(u * 8, v * 5, 13, 3);
      rough[y * w + x] = 0.85 + 0.15 * vnoise(u * 3, v * 260, 17);
    }
  }
  return {
    normal: dataTex(heightToNormal(height, w, h, 5.5), w, h),
    roughness: grayTex(rough, w, h),
  };
};

/**
 * Coin normal + roughness maps in lathe UV space (u around, v along profile).
 * Reeded edge in the edge band; concentric fine tooling on the faces.
 */
export const makeCoinTextures = () => {
  const w = 2048;
  const h = 512;
  const RIDGES = 118;
  const nd = new Uint8Array(w * h * 4);
  const rough = new Float32Array(w * h);
  const [e0, e1] = COIN_EDGE_V;
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    const inEdge = v > e0 && v < e1;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      let nx = 0;
      let ny = 0;
      if (inEdge) {
        // Flat-topped reeding: derivative of a softened square wave.
        const p = u * RIDGES * Math.PI * 2;
        nx = -0.85 * Math.sin(p) * Math.min(1, 2.2 * Math.abs(Math.cos(p)) + 0.25);
      } else {
        const g = vnoise(u * 900, v * 40, 3, 900, 0) - vnoise(u * 900 + 0.5, v * 40, 3, 900, 0);
        const blot = fbm(u * 24, v * 24, 7, 3, 24, 0) - 0.5;
        nx = g * 0.06 + blot * 0.05;
        ny = (vnoise(u * 300, v * 160, 19, 300, 0) - 0.5) * 0.08 + blot * 0.04;
      }
      const l = Math.hypot(nx, ny, 1);
      const o = (y * w + x) * 4;
      nd[o] = Math.round((nx / l * 0.5 + 0.5) * 255);
      nd[o + 1] = Math.round((ny / l * 0.5 + 0.5) * 255);
      nd[o + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
      nd[o + 3] = 255;
      rough[y * w + x] = 0.78 + 0.22 * fbm(u * 30, v * 12, 29, 3, 30, 0);
    }
  }
  const normal = dataTex(nd, w, h, true);
  const roughness = grayTex(rough, w, h, true);
  return { normal, roughness };
};

/** Lightly hammered ingot surface: two scales of Worley dimples. Tiles. */
export const makeBarTextures = () => {
  const w = 1024;
  const h = 1024;
  const height = new Float32Array(w * h);
  const rough = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const a = worley(u * 9, v * 9, 3, 9);
      const b = worley(u * 23, v * 23, 5, 23);
      height[y * w + x] = 0.65 * a * a + 0.35 * b * b + 0.03 * vnoise(u * 200, v * 200, 7, 200, 200);
      rough[y * w + x] = 0.75 + 0.25 * fbm(u * 6, v * 6, 13, 3, 6, 6);
    }
  }
  return {
    normal: dataTex(heightToNormal(height, w, h, 9), w, h, true),
    roughness: grayTex(rough, w, h, true),
  };
};

// ------------------------------------------------------------------- chip

export const CHIP_W = 1.18;
export const CHIP_H = 0.92;
export const CHIP_R = 0.13;

const roundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/**
 * Self-drawn contact pattern (not any real scheme's layout): a centre pad,
 * three pads per side, separated by grooves. Returns colour + bump canvases.
 */
export const makeChipTextures = (base: string, light: string, groove: string) => {
  const W = 1024;
  const H = Math.round((W * CHIP_H) / CHIP_W);
  const draw = (mode: "color" | "bump") => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    if (mode === "color") {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, light);
      g.addColorStop(0.55, base);
      g.addColorStop(1, light);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = "#ffffff";
    }
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = mode === "color" ? groove : "#000000";
    ctx.lineWidth = W * 0.016;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const cx0 = W * 0.34;
    const cx1 = W * 0.66;
    const cy0 = H * 0.24;
    const cy1 = H * 0.76;
    // centre pad
    roundRectPath(ctx, cx0, cy0, cx1 - cx0, cy1 - cy0, W * 0.04);
    ctx.stroke();
    // side pad dividers
    ctx.beginPath();
    for (const yy of [H / 3, (2 * H) / 3]) {
      ctx.moveTo(0, yy);
      ctx.lineTo(cx0, yy);
      ctx.moveTo(cx1, yy);
      ctx.lineTo(W, yy);
    }
    // centre pad to edges
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, cy0);
    ctx.moveTo(W / 2, cy1);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    return c;
  };
  const color = new CanvasTexture(draw("color"));
  color.colorSpace = SRGBColorSpace;
  color.anisotropy = 8;
  const bump = new CanvasTexture(draw("bump"));
  bump.anisotropy = 8;
  return { color, bump };
};

// ------------------------------------------------------------- card print

export const CHIP_CENTER = { x: -CARD_W / 2 + 1.0 + CHIP_W / 2 + 0.25, y: 0.38 };

/**
 * Flat print for the rose card: "Bank Card" top right and the placeholder
 * number under the chip. 4096 px wide so it stays crisp at 4K and above.
 */
export const makeCardPrintTexture = (ink: string): Texture => {
  const W = 4096;
  const H = Math.round((W * CARD_H) / CARD_W);
  const pxPerCm = W / CARD_W;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = ink;
  ctx.textBaseline = "alphabetic";
  const toPx = (x: number, y: number) => [(x + CARD_W / 2) * pxPerCm, (CARD_H / 2 - y) * pxPerCm];

  // "Bank Card", top right.
  ctx.font = `500 ${0.36 * pxPerCm}px Inter`;
  ctx.textAlign = "right";
  const [bx, by] = toPx(CARD_W / 2 - 0.62, CARD_H / 2 - 0.88);
  ctx.fillText("Bank Card", bx, by);

  // Placeholder number, fixed-advance digits in four groups.
  ctx.font = `400 ${0.45 * pxPerCm}px Inter`;
  ctx.textAlign = "center";
  const groups = ["0123", "4567", "8910", "1112"];
  const adv = 0.34 * pxPerCm;
  const gap = 0.36 * pxPerCm;
  const [nx, ny] = toPx(CHIP_CENTER.x - CHIP_W / 2, -0.95);
  let x = nx + adv / 2;
  for (const g of groups) {
    for (const ch of g) {
      ctx.fillText(ch, x, ny);
      x += adv;
    }
    x += gap;
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 16;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  return t;
};
