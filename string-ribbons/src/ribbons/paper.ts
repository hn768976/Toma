import { mulberry32 } from "./math";

export type PaperPalette = {
  paper: string;
  paperLight: string;
  paperDark: string;
  grid: string;
  speckle: string;
  vignette: string;
  ink: string;
};

export type PaperLayers = {
  /** mottled paper the ribbons are printed on */
  base: HTMLCanvasElement;
  /** printed grid, multiplied over everything (incl. the ribbons) */
  grid: HTMLCanvasElement;
  /** light speckle/grunge, screened over everything */
  grunge: HTMLCanvasElement;
  /** edge darkening, multiplied last */
  vignette: HTMLCanvasElement;
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** Smooth value noise rendered at low resolution and scaled up. */
const noiseCanvas = (w: number, h: number, cell: number, seed: number, octaves: number) => {
  const rnd = mulberry32(seed);
  const nw = Math.max(2, Math.ceil(w / cell));
  const nh = Math.max(2, Math.ceil(h / cell));
  const c = makeCanvas(nw, nh);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(nw, nh);
  const grids: Float32Array[] = [];
  const sizes: number[] = [];
  for (let o = 0; o < octaves; o++) {
    const gs = 4 * 2 ** o + 1;
    const g = new Float32Array(gs * gs);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    grids.push(g);
    sizes.push(gs);
  }
  const sample = (g: Float32Array, gs: number, x: number, y: number) => {
    const fx = x * (gs - 1), fy = y * (gs - 1);
    const ix = Math.min(gs - 2, Math.floor(fx)), iy = Math.min(gs - 2, Math.floor(fy));
    let tx = fx - ix, ty = fy - iy;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const a = g[iy * gs + ix], b = g[iy * gs + ix + 1];
    const c2 = g[(iy + 1) * gs + ix], d = g[(iy + 1) * gs + ix + 1];
    return a + (b - a) * tx + (c2 - a) * ty + (a - b - c2 + d) * tx * ty;
  };
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      let v = 0, amp = 1, tot = 0;
      for (let o = 0; o < octaves; o++) {
        v += amp * sample(grids[o], sizes[o], x / (nw - 1), y / (nh - 1));
        tot += amp;
        amp *= 0.55;
      }
      const n = Math.round((v / tot) * 255);
      const i = (y * nw + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

/** Builds the static print texture once per resolution (deterministic). */
export const buildPaper = (w: number, h: number, pal: PaperPalette): PaperLayers => {
  const H = h;
  const rnd = mulberry32(1234);

  // ---- base paper with mottling ------------------------------------------
  const base = makeCanvas(w, h);
  const b = base.getContext("2d")!;
  b.fillStyle = pal.paper;
  b.fillRect(0, 0, w, h);
  const mott = noiseCanvas(w, h, Math.max(2, H / 135), 7, 6);
  // turn the grey noise into light/dark tints using blend modes
  b.save();
  b.globalAlpha = 0.35;
  b.globalCompositeOperation = "overlay";
  b.imageSmoothingEnabled = true;
  b.drawImage(mott, 0, 0, w, h);
  b.restore();
  b.save();
  b.globalAlpha = 0.25;
  b.globalCompositeOperation = "multiply";
  b.fillStyle = pal.paperDark;
  const blot = noiseCanvas(w, h, Math.max(2, H / 40), 99, 3);
  // dark blotches: draw tinted noise through a threshold-ish curve
  const bctx = blot.getContext("2d")!;
  const bi = bctx.getImageData(0, 0, blot.width, blot.height);
  for (let i = 0; i < bi.data.length; i += 4) {
    const v = bi.data[i] / 255;
    const k = Math.max(0, Math.min(1, (v - 0.55) * 3.2));
    bi.data[i + 3] = Math.round(k * 255);
    bi.data[i] = 120; bi.data[i + 1] = 150; bi.data[i + 2] = 145;
  }
  bctx.putImageData(bi, 0, 0);
  b.drawImage(blot, 0, 0, w, h);
  b.restore();

  // ---- printed grid -------------------------------------------------------
  const grid = makeCanvas(w, h);
  const g = grid.getContext("2d")!;
  const minor = H * 0.0775;
  const lw = Math.max(1, H * 0.0021);
  g.strokeStyle = pal.grid;
  const drawLine = (x0: number, y0: number, x1: number, y1: number, major: boolean) => {
    // broken, unevenly inked line like a worn print
    const L = Math.hypot(x1 - x0, y1 - y0);
    let s = 0;
    while (s < L) {
      const seg = (major ? 0.02 : 0.012) * H + rnd() * 0.05 * H;
      const gap = rnd() < 0.35 ? rnd() * 0.012 * H : 0;
      const e = Math.min(L, s + seg);
      g.globalAlpha = major ? 0.3 + 0.5 * rnd() : 0.05 + 0.07 * rnd();
      g.lineWidth = major ? lw * (0.8 + 0.6 * rnd()) : lw * 0.7;
      g.beginPath();
      g.moveTo(x0 + ((x1 - x0) * s) / L, y0 + ((y1 - y0) * s) / L);
      g.lineTo(x0 + ((x1 - x0) * e) / L, y0 + ((y1 - y0) * e) / L);
      g.stroke();
      s = e + gap;
    }
  };
  const ox = w / 2 - Math.floor(w / 2 / minor) * minor - minor * 0.3;
  const oy = h / 2 - Math.floor(h / 2 / minor) * minor + minor * 0.35;
  let k = 0;
  for (let x = ox; x < w; x += minor, k++) drawLine(x, 0, x, h, k % 2 === 0);
  k = 0;
  for (let y = oy; y < h; y += minor, k++) drawLine(0, y, w, y, k % 2 === 0);
  g.globalAlpha = 1;

  // ---- light grunge speckles (visible on top of the dark ink too) -------
  const grunge = makeCanvas(w, h);
  const gr = grunge.getContext("2d")!;
  const dens = noiseCanvas(w, h, Math.max(2, H / 60), 31, 4);
  const dctx = dens.getContext("2d")!;
  const dd = dctx.getImageData(0, 0, dens.width, dens.height).data;
  gr.fillStyle = pal.speckle;
  const count = Math.round(14000 * (w * h) / (1920 * 1080));
  gr.filter = `blur(${(H * 0.0016).toFixed(2)}px)`;
  for (let i = 0; i < count; i++) {
    const x = rnd() * w, y = rnd() * h;
    const dx = Math.min(dens.width - 1, Math.floor((x / w) * dens.width));
    const dy = Math.min(dens.height - 1, Math.floor((y / h) * dens.height));
    const d = dd[(dy * dens.width + dx) * 4] / 255;
    // speckles cluster in the "worn" patches of the density noise
    const patch = Math.max(0, (d - 0.5) * 2.6);
    if (rnd() > patch * patch) continue;
    const r = H * (0.002 + 0.008 * rnd() ** 2);
    gr.globalAlpha = 0.1 + 0.35 * rnd();
    gr.beginPath();
    gr.ellipse(x, y, r * (0.7 + 0.6 * rnd()), r * (0.7 + 0.6 * rnd()), rnd() * 3, 0, Math.PI * 2);
    gr.fill();
  }
  gr.globalAlpha = 1;

  // ---- vignette ----------------------------------------------------------
  const vignette = makeCanvas(w, h);
  const v = vignette.getContext("2d")!;
  const grad = v.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.58);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, pal.vignette);
  v.fillStyle = grad;
  v.fillRect(0, 0, w, h);

  return { base, grid, grunge, vignette };
};
