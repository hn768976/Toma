import { mulberry32 } from "../lib/random";

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  return { canvas: c, ctx };
};

/** Soft line profile: bright core across V, fading ends along U. */
export const lineTexture = () => {
  const { canvas, ctx } = makeCanvas(512, 64);
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.35, "rgba(255,255,255,0.25)");
  g.addColorStop(0.47, "rgba(255,255,255,0.9)");
  g.addColorStop(0.5, "rgba(255,255,255,1)");
  g.addColorStop(0.53, "rgba(255,255,255,0.9)");
  g.addColorStop(0.65, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 64);
  const f = ctx.createLinearGradient(0, 0, 512, 0);
  f.addColorStop(0, "rgba(0,0,0,1)");
  f.addColorStop(0.12, "rgba(0,0,0,0)");
  f.addColorStop(0.88, "rgba(0,0,0,0)");
  f.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = f;
  ctx.fillRect(0, 0, 512, 64);
  return canvas;
};

/** Light shaft: bright at the origin end (u=0), fading out along u. */
export const shaftTexture = () => {
  const { canvas, ctx } = makeCanvas(512, 128);
  for (let x = 0; x < 512; x++) {
    const u = x / 511;
    const a = Math.pow(1 - u, 1.6);
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, `rgba(255,255,255,${a})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 1, 128);
  }
  return canvas;
};

export const radialTexture = () => {
  const { canvas, ctx } = makeCanvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.45)");
  g.addColorStop(0.6, "rgba(255,255,255,0.1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return canvas;
};

/** Glass screen with a grid of data cells ("windows"), deterministic. */
export const screenTexture = (seed: number, bright: number) => {
  const { canvas, ctx } = makeCanvas(512, 512);
  const r = mulberry32(seed);
  ctx.fillStyle = `rgba(150,180,220,${0.09 * bright})`;
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = `rgba(190,215,255,${0.35 * bright})`;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 508, 508);
  const cols = 6 + Math.floor(r() * 10);
  const rows = 8 + Math.floor(r() * 14);
  const cw = 512 / cols;
  const ch = 512 / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const v = r();
      if (v < 0.45) continue;
      const a = (v > 0.93 ? 0.95 : 0.15 + r() * 0.35) * bright;
      ctx.fillStyle = `rgba(215,232,255,${a})`;
      ctx.fillRect(i * cw + cw * 0.15, j * ch + ch * 0.3, cw * (0.3 + r() * 0.55), ch * 0.35);
    }
  }
  return canvas;
};

/** Perspective "floor" of light: a grid of glowing lines. */
export const gridTexture = (seed: number) => {
  const { canvas, ctx } = makeCanvas(1024, 1024);
  const r = mulberry32(seed);
  ctx.clearRect(0, 0, 1024, 1024);
  for (let i = 0; i < 26; i++) {
    const x = r() * 1024;
    ctx.fillStyle = `rgba(220,235,255,${0.15 + r() * 0.6})`;
    ctx.fillRect(x, 0, 3 + r() * 5, 1024);
  }
  for (let i = 0; i < 18; i++) {
    const y = r() * 1024;
    ctx.fillStyle = `rgba(220,235,255,${0.1 + r() * 0.4})`;
    ctx.fillRect(0, y, 1024, 2 + r() * 4);
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(235,245,255,${0.3 + r() * 0.7})`;
    ctx.fillRect(r() * 1024, r() * 1024, 10 + r() * 40, 6 + r() * 10);
  }
  const f = ctx.createRadialGradient(512, 512, 100, 512, 512, 520);
  f.addColorStop(0, "rgba(0,0,0,0)");
  f.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = f;
  ctx.fillRect(0, 0, 1024, 1024);
  return canvas;
};
