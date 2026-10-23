import { Rng, mulberry32, range } from "../shared/random";
import { Palette } from "./palettes";

const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
};

const blotchyNoise = (
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  w: number,
  h: number,
  cells: number,
  alpha: number,
  op: GlobalCompositeOperation,
) => {
  const cw = cells;
  const ch = Math.max(2, Math.round((cells * h) / w));
  const nc = makeCanvas(cw, ch);
  const nctx = nc.getContext("2d")!;
  const img = nctx.createImageData(cw, ch);
  for (let i = 0; i < cw * ch; i++) {
    const v = 255 * rng();
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(nc, 0, 0, w, h);
  ctx.restore();
};

// Aged staff paper. `w`/`h` are backing-store pixels; `u` is pixels per 4K pixel.
export const buildPaper = (p: Palette, w: number, h: number, u: number, seed: number) => {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  const rng = mulberry32(seed);
  ctx.fillStyle = rgba(p.paper, 1);
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.48, 0, w * 0.5, h * 0.5, w * 0.55);
  g.addColorStop(0, rgba(p.paperCenter, 1));
  g.addColorStop(1, rgba(p.paperCenter, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  blotchyNoise(ctx, rng, w, h, 16, 0.12, "soft-light");
  blotchyNoise(ctx, rng, w, h, 60, 0.12, "soft-light");
  blotchyNoise(ctx, rng, w, h, 240, 0.08, "soft-light");

  // Foxing: clusters of small warm stains.
  for (let i = 0; i < 1600; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = range(rng, 4, rng() < 0.1 ? 70 : 22) * u;
    const sg = ctx.createRadialGradient(x, y, 0, x, y, r);
    sg.addColorStop(0, rgba(p.stain, range(rng, 0.12, 0.4)));
    sg.addColorStop(1, rgba(p.stain, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 70; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = range(rng, 120, 520) * u;
    const sg = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    sg.addColorStop(0, rgba(p.stain, 0.0));
    sg.addColorStop(0.8, rgba(p.stain, range(rng, 0.05, 0.12)));
    sg.addColorStop(1, rgba(p.stain, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Specks.
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rgba(p.speck, range(rng, 0.08, 0.45));
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h, range(rng, 1, rng() < 0.04 ? 7 : 3) * u, 0, Math.PI * 2);
    ctx.fill();
  }
  // Faint printed rules: thin, uneven, faintly doubled.
  ctx.fillStyle = p.rule;
  const spacing = 98 * u;
  for (let y = spacing * 0.4; y < h; y += spacing) {
    for (let x = 0; x < w; x += 300 * u) {
      ctx.globalAlpha = range(rng, 0.4, 0.9);
      ctx.fillRect(x, y + range(rng, -1, 1) * u, 300 * u, 3 * u);
    }
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, y + 7 * u, w, 2.5 * u);
  }
  ctx.globalAlpha = 1;
  return c;
};

// Burnt, irregular vignette on transparent background.
export const buildBurn = (p: Palette, w: number, h: number, u: number, seed: number) => {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  const rng = mulberry32(seed);
  // Elliptical fall-off: clean centre, dense burnt edges and corners.
  const ry = (h / w) * 1.22;
  const rg = ctx.createRadialGradient(w / 2, h / 2, w * 0.36, w / 2, h / 2, w * 0.64);
  rg.addColorStop(0, rgba(p.burn, 0));
  rg.addColorStop(0.45, rgba(p.burn, 0.32));
  rg.addColorStop(0.8, rgba(p.burn, 0.85));
  rg.addColorStop(1, rgba(p.burn, 1));
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(1, ry);
  ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = rg;
  ctx.fillRect(-w, -h / ry, w * 3, (h / ry) * 3);
  ctx.restore();
  // Darker corners and a soft rounded-rectangle edge band (projector gate).
  const band = (x0: number, y0: number, x1: number, y1: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgba(p.burn, 0.7));
    g.addColorStop(1, rgba(p.burn, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  band(0, 0, w * 0.07, 0);
  band(w, 0, w * 0.93, 0);
  band(0, 0, 0, h * 0.09);
  band(0, h, 0, h * 0.91);
  // Slight irregularity so the burn reads as organic, not geometric.
  for (let i = 0; i < 28; i++) {
    const side = Math.floor(rng() * 4);
    const t = rng();
    const x = side < 2 ? t * w : side === 2 ? 0 : w;
    const y = side === 0 ? 0 : side === 1 ? h : t * h;
    const r = range(rng, 160, 340) * u;
    const bg = ctx.createRadialGradient(x, y, 0, x, y, r);
    bg.addColorStop(0, rgba(p.burn, range(rng, 0.06, 0.12)));
    bg.addColorStop(1, rgba(p.burn, 0));
    ctx.fillStyle = bg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
};

export const buildGrain = (size: number, seed: number) => {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  const rng = mulberry32(seed);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (rng() + rng() + rng() - 1.5) * 120;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
};
