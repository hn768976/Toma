import * as THREE from "three";
import { mulberry32 } from "./math";

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// The wallet screen: title, card chip, balance rows and status icons, all
// drawn in code. Used as an emissive map, so black means "unlit".
export class ScreenTexture {
  readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private key = "";

  constructor(
    private readonly title: string,
    private readonly textColor: string,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    this.ctx = canvas.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
  }

  // Redraws only when the shown values change; the picture is a pure
  // function of (row1, row2), so frame order never matters.
  draw(row1: number, row2: number) {
    const key = `${row1}|${row2}`;
    if (key === this.key) return;
    this.key = key;
    const ctx = this.ctx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = this.textColor;
    ctx.strokeStyle = this.textColor;

    // Status icons, top right: signal bars and a battery.
    for (let i = 0; i < 4; i++) {
      const h = 10 + i * 7;
      ctx.globalAlpha = i < 3 ? 1 : 0.45;
      roundRect(ctx, 772 + i * 13, 84 - h, 8, h, 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Wi-Fi: three arcs and a dot.
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(876 - 24, 84, 8 + i * 9, -Math.PI * 0.75, -Math.PI * 0.25);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(852, 82, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = "butt";
    ctx.lineWidth = 3.5;
    roundRect(ctx, 880, 56, 50, 27, 7);
    ctx.stroke();
    roundRect(ctx, 933, 63, 5, 13, 2);
    ctx.fill();
    roundRect(ctx, 886, 62, 30, 15, 3);
    ctx.fill();

    // Title.
    ctx.font = "600 64px Inter";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(this.title, 92, 212);

    // Card chip: an outlined SIM-style chip with contact lines.
    ctx.lineWidth = 4.5;
    roundRect(ctx, 96, 252, 84, 64, 13);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(124, 252);
    ctx.lineTo(124, 272);
    ctx.lineTo(152, 272);
    ctx.lineTo(152, 252);
    ctx.moveTo(124, 316);
    ctx.lineTo(124, 296);
    ctx.lineTo(152, 296);
    ctx.lineTo(152, 316);
    ctx.moveTo(96, 284);
    ctx.lineTo(124, 284);
    ctx.moveTo(152, 284);
    ctx.lineTo(180, 284);
    ctx.stroke();

    // Balance rows on rounded panels, plus an empty third panel.
    const rows = [`${row1}$`, `${row2}$`, ""];
    rows.forEach((text, i) => {
      const y = 362 + i * 118;
      ctx.fillStyle = "#1E2127";
      roundRect(ctx, 92, y, 500, 92, 46);
      ctx.fill();
      if (text) {
        ctx.fillStyle = this.textColor;
        ctx.font = "400 60px Inter";
        ctx.fillText(text, 128, y + 69);
      }
    });
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}

// Fine circuit pattern for the security panels (traces, pads and dots).
export const makeCircuitTexture = (seed: number) => {
  const rng = mulberry32(seed);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < 18; i++) {
    let x = Math.round(rng() * 16) * 32;
    let y = Math.round(rng() * 16) * 32;
    ctx.globalAlpha = 0.2 + rng() * 0.3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 2 + Math.floor(rng() * 4);
    for (let s = 0; s < steps; s++) {
      const len = (1 + Math.floor(rng() * 4)) * 24;
      const dir = Math.floor(rng() * 4);
      x += dir === 0 ? len : dir === 1 ? -len : rng() < 0.5 ? len : -len;
      y += dir >= 2 ? len * (dir === 2 ? 1 : -1) : 0;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Sparse sparkle points, denser toward the panel edges.
  for (let i = 0; i < 260; i++) {
    ctx.globalAlpha = rng() < 0.4 ? 1 : 0.5 + rng() * 0.4;
    const r = 1.2 + rng() * 1.6;
    const e = (v: number) => (v < 0.5 ? 0.5 * Math.pow(2 * v, 1.8) : 1 - 0.5 * Math.pow(2 - 2 * v, 1.8));
    const x = rng() < 0.5 ? e(rng()) : rng();
    const y = rng() < 0.5 ? e(rng()) : rng();
    ctx.beginPath();
    ctx.arc(x * 512, y * 512, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.MirroredRepeatWrapping;
  tex.wrapT = THREE.MirroredRepeatWrapping;
  tex.anisotropy = 8;
  return tex;
};
