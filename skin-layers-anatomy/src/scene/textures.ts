import * as THREE from "three";
import { makeRng } from "./util";

const SIZE = 1024;

const finish = (canvas: HTMLCanvasElement) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

const make = () => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
};

/** Pink cell mosaic for the squamous layer. */
export const squamousTexture = () => {
  const { canvas, ctx } = make();
  const rnd = makeRng(11);
  ctx.fillStyle = "#e0566a";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const n = 34;
  const cell = SIZE / n;
  for (let i = -1; i <= n; i++) {
    for (let j = -1; j <= n; j++) {
      const cx = (i + 0.5 + (rnd() - 0.5) * 0.7) * cell;
      const cy = (j + 0.5 + (rnd() - 0.5) * 0.7) * cell;
      const r = cell * (0.4 + rnd() * 0.16);
      const l = 66 + rnd() * 8;
      ctx.fillStyle = `hsl(${352 + rnd() * 8}, 80%, ${l}%)`;
      ctx.beginPath();
      const k = 7;
      for (let a = 0; a < k; a++) {
        const ang = (a / k) * Math.PI * 2 + rnd() * 0.5;
        const rr = r * (0.8 + rnd() * 0.35);
        const px = cx + Math.cos(ang) * rr;
        const py = cy + Math.sin(ang) * rr;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(190,40,70,0.55)";
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return finish(canvas);
};

/** Fibrous striations for the muscle layer. */
export const muscleTexture = () => {
  const { canvas, ctx } = make();
  const rnd = makeRng(23);
  ctx.fillStyle = "#d81a24";
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 260; i++) {
    const y = rnd() * SIZE;
    const dark = rnd() > 0.45;
    ctx.strokeStyle = dark
      ? `rgba(120,0,10,${0.12 + rnd() * 0.25})`
      : `rgba(255,90,80,${0.1 + rnd() * 0.2})`;
    ctx.lineWidth = 1 + rnd() * 5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    const amp = 4 + rnd() * 8;
    const ph = rnd() * 6.28;
    for (let x = 0; x <= SIZE; x += 32) {
      ctx.lineTo(x, y + Math.sin((x / SIZE) * Math.PI * 4 + ph) * amp);
    }
    ctx.stroke();
  }
  return finish(canvas);
};

/** Soft mottled tissue used for dermis / basal / corneum (tinted by material). */
export const mottledTexture = (seed: number, contrast: number) => {
  const { canvas, ctx } = make();
  const rnd = makeRng(seed);
  ctx.fillStyle = "#dcdcdc";
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * SIZE;
    const y = rnd() * SIZE;
    const r = 20 + rnd() * 90;
    const light = rnd() > 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = contrast * (0.05 + rnd() * 0.12);
    g.addColorStop(0, light ? `rgba(255,255,255,${a})` : `rgba(170,110,80,${a})`);
    g.addColorStop(1, light ? "rgba(255,255,255,0)" : "rgba(170,110,80,0)");
    ctx.fillStyle = g;
    // draw wrapped copies so the texture tiles
    for (const ox of [-SIZE, 0, SIZE]) {
      for (const oy of [-SIZE, 0, SIZE]) {
        ctx.fillRect(x - r + ox, y - r + oy, r * 2, r * 2);
      }
    }
  }
  return finish(canvas);
};

/** Soft elliptical contact shadow under the floating block. */
export const shadowTexture = () => {
  const { canvas, ctx } = make();
  const g = ctx.createRadialGradient(
    SIZE / 2,
    SIZE / 2,
    0,
    SIZE / 2,
    SIZE / 2,
    SIZE / 2,
  );
  g.addColorStop(0, "rgba(96,78,70,0.46)");
  g.addColorStop(0.35, "rgba(104,86,78,0.27)");
  g.addColorStop(0.7, "rgba(112,94,86,0.08)");
  g.addColorStop(1, "rgba(112,94,86,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};
