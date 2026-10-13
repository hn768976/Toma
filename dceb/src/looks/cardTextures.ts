/**
 * Generic bank-card faces drawn in code (canvas 2D), built once.
 * Only generic text: "BANK NAME", "CREDIT CARD", "CARDHOLDER NAME", "12/32",
 * "1234 5678 9012 3456". The chip is a plain gold contact pad. No networks,
 * no logos, no holograms.
 */
import * as THREE from "three";

export type Colourway = {
  name: string;
  /** two gradient stops (display sRGB) */
  a: string;
  b: string;
  /** metallic look (silver/gold) */
  metal?: boolean;
};

export const TEX_W = 1024;
export const TEX_H = Math.round((TEX_W * 54) / 85.6); // 646

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const mixHex = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t).getStyle();

const drawChip = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  const w = 132;
  const h = 102;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#f6dc8c");
  g.addColorStop(0.45, "#d7a845");
  g.addColorStop(1, "#f0cf78");
  roundRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(110,75,10,0.55)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // plain contact-pad segmentation
  ctx.beginPath();
  ctx.moveTo(x + w * 0.36, y + 2);
  ctx.lineTo(x + w * 0.36, y + h - 2);
  ctx.moveTo(x + w * 0.64, y + 2);
  ctx.lineTo(x + w * 0.64, y + h - 2);
  ctx.moveTo(x + 2, y + h * 0.5);
  ctx.lineTo(x + w * 0.36, y + h * 0.5);
  ctx.moveTo(x + w * 0.64, y + h * 0.5);
  ctx.lineTo(x + w - 2, y + h * 0.5);
  ctx.moveTo(x + 2, y + h * 0.27);
  ctx.lineTo(x + w * 0.36, y + h * 0.27);
  ctx.moveTo(x + w * 0.64, y + h * 0.27);
  ctx.lineTo(x + w - 2, y + h * 0.27);
  ctx.moveTo(x + 2, y + h * 0.73);
  ctx.lineTo(x + w * 0.36, y + h * 0.73);
  ctx.moveTo(x + w * 0.64, y + h * 0.73);
  ctx.lineTo(x + w - 2, y + h * 0.73);
  ctx.strokeStyle = "rgba(120,82,15,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();
};

const embossed = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number) => {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillText(text, x + 2.5, y + 2.5);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(text, x - 1.2, y - 1.2);
  const g = ctx.createLinearGradient(0, y - 50, 0, y + 6);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#dfe3ea");
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
};

const spaced = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: "left" | "right") => {
  // manual letter spacing (canvas letterSpacing support varies)
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((s, w) => s + w, 0) + spacing * (text.length - 1);
  let cx = align === "left" ? x : x - total;
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i] + spacing;
  });
};

export const drawFace = (cw: Colourway) => {
  const c = document.createElement("canvas");
  c.width = TEX_W;
  c.height = TEX_H;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, TEX_W, TEX_H);
  g.addColorStop(0, cw.a);
  g.addColorStop(0.55, mixHex(cw.a, cw.b, 0.6));
  g.addColorStop(1, cw.b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  // soft diagonal sheen bands + fine wave lines (generic pattern)
  const sheen = ctx.createLinearGradient(0, TEX_H, TEX_W, 0);
  sheen.addColorStop(0.0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0.05)");
  sheen.addColorStop(0.52, "rgba(255,255,255,0.10)");
  sheen.addColorStop(0.6, "rgba(255,255,255,0.04)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 2;
  for (let k = 0; k < 14; k++) {
    ctx.beginPath();
    for (let x = 0; x <= TEX_W; x += 8) {
      const y = 360 + k * 26 + 38 * Math.sin(x / 150 + k * 0.35);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = '600 30px "Inter"';
  spaced(ctx, "CREDIT CARD", 64, 92, 3, "left");
  ctx.font = '700 40px "Inter"';
  spaced(ctx, "BANK NAME", TEX_W - 64, 96, 2, "right");
  drawChip(ctx, 92, 196);
  ctx.font = '500 66px "JetBrains Mono"';
  embossed(ctx, "1234 5678 9012 3456", 78, 440);
  ctx.font = '500 34px "JetBrains Mono"';
  embossed(ctx, "12/32", 560, 508);
  ctx.font = '600 34px "Inter"';
  ctx.fillStyle = "#ffffff";
  spaced(ctx, "CARDHOLDER NAME", 80, 578, 2, "left");
  return c;
};

export const drawBack = (cw: Colourway) => {
  const c = document.createElement("canvas");
  c.width = TEX_W;
  c.height = TEX_H;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(TEX_W, 0, 0, TEX_H);
  g.addColorStop(0, mixHex(cw.a, "#000000", 0.15));
  g.addColorStop(1, mixHex(cw.b, "#000000", 0.25));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  // magnetic stripe
  const m = ctx.createLinearGradient(0, 58, 0, 172);
  m.addColorStop(0, "#151515");
  m.addColorStop(0.5, "#262626");
  m.addColorStop(1, "#101010");
  ctx.fillStyle = m;
  ctx.fillRect(0, 58, TEX_W, 114);
  // signature strip (plain, faint hatching)
  ctx.fillStyle = "#f4f4f0";
  ctx.fillRect(64, 232, 640, 82);
  ctx.strokeStyle = "rgba(150,160,175,0.35)";
  ctx.lineWidth = 2;
  for (let x = 64; x < 704; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, 232);
    ctx.lineTo(x + 30, 314);
    ctx.stroke();
  }
  return c;
};

export const toTexture = (canvas: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};
