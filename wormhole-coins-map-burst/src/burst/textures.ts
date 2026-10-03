// Procedural sprite atlas for the Sparkle Burst (one texture source so every
// particle can live in a single ParticleContainer). Drawn once per tab.
import { Rectangle, Texture } from "pixi.js";

export const BOKEH_LEVELS = 7;

export type BurstTextures = {
  spark: Texture;
  star: Texture;
  bokeh: Texture[]; // index 0 = smallest/sharpest … 6 = largest/softest
  streak: Texture;
  glow: Texture;
  leaks: Texture[];
  shaft: Texture; // long soft light shaft, origin at the left edge
};

const radial = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, string][]) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

export const makeBurstTextures = (leakColors: string[]): BurstTextures => {
  const S = 128; // cell size
  const cols = 8;
  const atlas = document.createElement("canvas");
  atlas.width = S * cols;
  atlas.height = S * 2;
  const ctx = atlas.getContext("2d")!;
  const cell = (i: number) => ({ x: (i % cols) * S, y: Math.floor(i / cols) * S });

  // 0: spark — hot core with soft halo.
  {
    const { x, y } = cell(0);
    radial(ctx, x + S / 2, y + S / 2, S / 2 - 1, [
      [0, "rgba(255,255,255,1)"],
      [0.16, "rgba(255,255,255,0.95)"],
      [0.34, "rgba(255,255,255,0.3)"],
      [1, "rgba(255,255,255,0)"],
    ]);
  }
  // 1: star — spark with four thin rays.
  {
    const { x, y } = cell(1);
    const cx = x + S / 2;
    const cy = y + S / 2;
    radial(ctx, cx, cy, S / 2 - 1, [
      [0, "rgba(255,255,255,1)"],
      [0.1, "rgba(255,255,255,0.8)"],
      [0.28, "rgba(255,255,255,0.12)"],
      [1, "rgba(255,255,255,0)"],
    ]);
    for (const horiz of [true, false]) {
      const g = horiz ? ctx.createLinearGradient(x + 1, 0, x + S - 1, 0) : ctx.createLinearGradient(0, y + 1, 0, y + S - 1);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.85)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      if (horiz) ctx.fillRect(x + 1, cy - 1, S - 2, 2);
      else ctx.fillRect(cx - 1, y + 1, 2, S - 2);
    }
  }
  // 2..8: bokeh discs, progressively softer with a faint brighter rim.
  for (let k = 0; k < BOKEH_LEVELS; k++) {
    const { x, y } = cell(2 + k);
    const soft = 0.05 + k * 0.05;
    const r = S / 2 - 2;
    radial(ctx, x + S / 2, y + S / 2, r, [
      [0, "rgba(255,255,255,0.55)"],
      [Math.max(0.05, 0.8 - soft - 0.1), "rgba(255,255,255,0.6)"],
      [Math.max(0.1, 0.9 - soft), "rgba(255,255,255,0.75)"],
      [1, "rgba(255,255,255,0)"],
    ]);
  }
  // 9: streak — horizontal, bright head on the right, fading tail.
  {
    const { x, y } = cell(9);
    const g = ctx.createLinearGradient(x + 2, 0, x + S - 2, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.8, "rgba(255,255,255,0.55)");
    g.addColorStop(0.97, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save();
    ctx.fillStyle = g;
    const h = 10;
    // Soft vertical profile: stack of rects with decreasing alpha.
    for (let i = 0; i < h; i++) {
      const d = Math.abs(i - (h - 1) / 2) / (h / 2);
      ctx.globalAlpha = Math.exp(-d * d * 3);
      ctx.fillRect(x + 2, y + S / 2 - h / 2 + i, S - 4, 1);
    }
    ctx.restore();
  }
  // 10: big soft glow.
  {
    const { x, y } = cell(10);
    radial(ctx, x + S / 2, y + S / 2, S / 2 - 1, [
      [0, "rgba(255,255,255,1)"],
      [0.25, "rgba(255,255,255,0.45)"],
      [0.6, "rgba(255,255,255,0.1)"],
      [1, "rgba(255,255,255,0)"],
    ]);
  }

  const source = Texture.from(atlas).source;
  source.autoGenerateMipmaps = true;
  source.scaleMode = "linear";
  source.update();
  const frame = (i: number, w = S, h = S) => {
    const { x, y } = cell(i);
    return new Texture({ source, frame: new Rectangle(x, y + (S - h) / 2, w, h) });
  };

  // Light-leak textures (rainbow-tinted soft blobs), separate sprites.
  const leakTex = (cols: string[]) => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const l = c.getContext("2d")!;
    const g = l.createLinearGradient(0, 0, 512, 0);
    cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col));
    l.fillStyle = g;
    l.fillRect(0, 0, 512, 256);
    // Elliptical soft mask (covers the whole canvas so no hard edges remain).
    l.globalCompositeOperation = "destination-in";
    const m = l.createRadialGradient(256, 256, 0, 256, 256, 250);
    m.addColorStop(0, "rgba(0,0,0,1)");
    m.addColorStop(0.45, "rgba(0,0,0,0.45)");
    m.addColorStop(1, "rgba(0,0,0,0)");
    l.setTransform(1, 0, 0, 0.5, 0, 0);
    l.fillStyle = m;
    l.fillRect(-10, -10, 532, 532);
    const t = Texture.from(c);
    t.source.scaleMode = "linear";
    return t;
  };

  // Soft volumetric light shaft: bright at the origin, widening and fading out.
  const shaftCanvas = document.createElement("canvas");
  shaftCanvas.width = 512;
  shaftCanvas.height = 128;
  {
    const l = shaftCanvas.getContext("2d")!;
    for (let x = 0; x < 512; x++) {
      const u = x / 511;
      const w = 6 + u * 52;
      const a = Math.pow(1 - u, 1.3) * Math.min(1, u * 12);
      const g = l.createLinearGradient(0, 64 - w, 0, 64 + w);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, `rgba(255,255,255,${a.toFixed(4)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      l.fillStyle = g;
      l.fillRect(x, 64 - w, 1, 2 * w);
    }
  }
  const shaft = Texture.from(shaftCanvas);
  shaft.source.scaleMode = "linear";

  return {
    shaft,
    spark: frame(0),
    star: frame(1),
    bokeh: Array.from({ length: BOKEH_LEVELS }, (_, k) => frame(2 + k)),
    streak: frame(9, S, 16),
    glow: frame(10),
    // Rainbow-tinted: the palette's leak colours in rotated order per blob.
    leaks: [0, 1, 2, 3].map((r) => leakTex([...leakColors.slice(r), ...leakColors.slice(0, r)])),
  };
};
