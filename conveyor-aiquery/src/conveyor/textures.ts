import * as THREE from "three";
import { hash3, mulberry32, type Rng } from "../lib/random";

// All textures are drawn once per tab with Canvas 2D and seeded randomness.

const TEX = 2048; // kraft maps: 2048 px = 1 m of cardboard

const smooth = (t: number) => t * t * (3 - 2 * t);
// Tileable 2D value noise: the lattice wraps every `period` cells.
const vnoise = (x: number, y: number, period: number, seed: number) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = smooth(x - xi), fy = smooth(y - yi);
  const w = (i: number) => ((i % period) + period) % period;
  const h = (i: number, j: number) => hash3(w(i), w(j), 0, seed);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
};
const tfbm = (u: number, v: number, basePeriod: number, oct: number, seed: number) => {
  let s = 0, a = 1, n = 0, p = basePeriod;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(u * p, v * p, p, seed + i * 31);
    n += a;
    a *= 0.5;
    p *= 2;
  }
  return s / n; // 0..1
};

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

const finish = (c: HTMLCanvasElement, srgb: boolean, repeat = true) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
};

// Height -> tangent-space normal map (tileable).
const heightToNormal = (hgt: Float32Array, w: number, h: number, strength: number) => {
  const c = canvas(w, h);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xl = hgt[y * w + ((x - 1 + w) % w)], xr = hgt[y * w + ((x + 1) % w)];
      const yu = hgt[((y - 1 + h) % h) * w + x], yd = hgt[((y + 1) % h) * w + x];
      // canvas y runs down, texture v runs up (flipY) -> invert dy
      let nx = (xl - xr) * strength, ny = (yd - yu) * strength;
      const nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

export interface KraftMaps {
  color: THREE.Texture;
  rough: THREE.Texture;
  normal: THREE.Texture;
}

// Kraft board: base #C8A06A, low-frequency mottling (+-6%), fibre speckle,
// scuffs; roughness ~0.8; normal = faint corrugation ridges + fibre grain.
export const makeKraft = (seed: number): KraftMaps => {
  const rng = mulberry32(seed);
  const W = TEX;
  const lum = new Float32Array(W * W);
  const hgt = new Float32Array(W * W);
  for (let y = 0; y < W; y++) {
    const v = y / W;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const mott = tfbm(u, v, 5, 4, seed) - 0.5; // ~ +-0.25 before scaling
      const fine = vnoise(u * 700, v * 700, 700, seed + 5) - 0.5;
      lum[y * W + x] = mott * 0.34 + fine * 0.012 + (tfbm(u, v, 2, 2, seed + 40) - 0.5) * 0.12;
      // Flutes every ~8 mm (16 px), running vertically on the face.
      const flute = Math.sin((x / 16) * Math.PI * 2) * 0.5;
      hgt[y * W + x] = flute * 0.4 + (vnoise(u * 1024, v * 1024, 1024, seed + 11) - 0.5) * 0.3;
    }
  }
  // Fibre speckle: short dark and light streaks.
  for (let i = 0; i < 90000; i++) {
    const x0 = rng() * W, y0 = rng() * W;
    const len = 2 + rng() * 9;
    const ang = rng() * Math.PI;
    const val = (rng() < 0.6 ? -1 : 1) * (0.01 + rng() * 0.025);
    for (let s = 0; s < len; s++) {
      const x = Math.floor(x0 + Math.cos(ang) * s) & (W - 1);
      const y = Math.floor(y0 + Math.sin(ang) * s) & (W - 1);
      lum[y * W + x] += val;
      hgt[y * W + x] += val * 4;
    }
  }
  // Scuffs: lighter abraded scratches in a few clusters.
  const scuff = new Float32Array(W * W);
  for (let k = 0; k < 14; k++) {
    const cx = rng() * W, cy = rng() * W, ang = rng() * Math.PI;
    const n = 6 + Math.floor(rng() * 14);
    for (let j = 0; j < n; j++) {
      const ox = cx + (rng() - 0.5) * 120, oy = cy + (rng() - 0.5) * 120;
      const len = 30 + rng() * 140, a = ang + (rng() - 0.5) * 0.4;
      for (let s = 0; s < len; s++) {
        const x = Math.floor(ox + Math.cos(a) * s) & (W - 1);
        const y = Math.floor(oy + Math.sin(a) * s) & (W - 1);
        scuff[y * W + x] = Math.max(scuff[y * W + x], 0.5 + rng() * 0.5);
      }
    }
  }

  // a few darker stains and handling smudges
  for (let k = 0; k < 10; k++) {
    const cx = rng() * W, cy = rng() * W, rad = 40 + rng() * 160, amt = 0.03 + rng() * 0.05;
    for (let y = -rad; y < rad; y++) for (let x = -rad; x < rad; x++) {
      const d = Math.hypot(x, y) / rad;
      if (d >= 1) continue;
      const i = (((Math.floor(cy + y) % W) + W) % W) * W + (((Math.floor(cx + x) % W) + W) % W);
      lum[i] -= amt * (1 - d * d) * (0.7 + 0.3 * vnoise((cx + x) / 30, (cy + y) / 30, 1 << 20, seed + k));
    }
  }
  // creases: long faint folds (darker groove with a light lip)
  for (let k = 0; k < 7; k++) {
    let x = rng() * W, y = rng() * W;
    let a = rng() * Math.PI;
    const len = 300 + rng() * 900;
    for (let s = 0; s < len; s++) {
      a += (rng() - 0.5) * 0.06;
      x += Math.cos(a); y += Math.sin(a);
      for (let o = -8; o <= 8; o++) {
        const px = ((Math.floor(x - Math.sin(a) * o) % W) + W) % W, py = ((Math.floor(y + Math.cos(a) * o) % W) + W) % W;
        const i = py * W + px;
        const prof = Math.exp(-o * o / 18);
        lum[i] -= 0.018 * prof;
        hgt[i] -= 0.8 * prof;
      }
    }
  }
  const base = [200, 160, 106]; // #C8A06A
  const cc = canvas(W, W);
  const cctx = cc.getContext("2d")!;
  const cimg = cctx.createImageData(W, W);
  const rc = canvas(W, W);
  const rctx = rc.getContext("2d")!;
  const rimg = rctx.createImageData(W, W);
  for (let i = 0; i < W * W; i++) {
    const l = 1 + lum[i] * 0.5 + scuff[i] * 0.07;
    // slightly warmer/less saturated where darker
    cimg.data[i * 4] = Math.min(255, base[0] * l);
    cimg.data[i * 4 + 1] = Math.min(255, base[1] * l);
    cimg.data[i * 4 + 2] = Math.min(255, base[2] * (l * 0.98 + 0.02 * (l - 1) * 2));
    cimg.data[i * 4 + 3] = 255;
    const r = 0.8 + lum[i] * 0.15 + scuff[i] * 0.06;
    rimg.data[i * 4] = rimg.data[i * 4 + 1] = rimg.data[i * 4 + 2] = Math.max(0, Math.min(255, r * 255));
    rimg.data[i * 4 + 3] = 255;
  }
  cctx.putImageData(cimg, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  return {
    color: finish(cc, true),
    rough: finish(rc, false),
    normal: finish(heightToNormal(hgt, W, W, 0.9), false),
  };
};

// Packing tape: #9A7040, longitudinal streaks, small cross wrinkles.
// u = across the tape (0..1), v = along the tape, 1 m per repeat.
export const makeTape = (seed: number) => {
  const rng = mulberry32(seed);
  const W = 128, H = 2048;
  const hgt = new Float32Array(W * H);
  const cc = canvas(W, H);
  const ctx = cc.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const wr: Array<[number, number, number]> = [];
  for (let i = 0; i < 70; i++) wr.push([rng() * H, 1.5 + rng() * 5, (rng() - 0.3) * 0.9]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const streak = vnoise(x / 3, y / 160, 1 << 20, seed) - 0.5;
      let h = streak * 0.3;
      for (const [wy, ww, wa] of wr) {
        const d = (y - wy + (x - W / 2) * wa) / ww;
        if (Math.abs(d) < 3) h += Math.exp(-d * d) * 0.6;
      }
      hgt[y * W + x] = h;
      const l = 1 + streak * 0.12 + (vnoise(x / 1.5, y / 1.5, 1 << 20, seed + 3) - 0.5) * 0.04;
      const i = (y * W + x) * 4;
      img.data[i] = 154 * l; img.data[i + 1] = 112 * l; img.data[i + 2] = 64 * l; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { color: finish(cc, true), normal: finish(heightToNormal(hgt, W, H, 1.4), false) };
};

// Steel roller: faint seam stripe along its length + satin streaks.
// u = around the circumference, v = along the roller.
export const makeRollerTex = (seed: number) => {
  const W = 256, H = 64;
  const c = canvas(W, H);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const seam = Math.exp(-(((x - 40) / 3) ** 2)) * 0.35;
      const lathe = (vnoise(x / 2, y * 0, 1 << 20, seed) - 0.5) * 0.12;
      const l = 1 - seam + lathe;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, 230 * l));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, true);
};

// ---------------------------------------------------------------- decals --
export const ATLAS = 2048;
export interface Region { x: number; y: number; w: number; h: number }
export const REG = {
  labelA: { x: 0, y: 0, w: 600, h: 900 },
  labelB: { x: 600, y: 0, w: 600, h: 900 },
  recycleBox: { x: 1200, y: 0, w: 600, h: 600 },
  recycle: { x: 1200, y: 600, w: 600, h: 600 },
  handling: { x: 0, y: 900, w: 900, h: 300 },
  mini: { x: 0, y: 1200, w: 600, h: 400 },
  labelC: { x: 900, y: 1200, w: 900, h: 600 },
  joint: { x: 1820, y: 0, w: 120, h: 900 },
} satisfies Record<string, Region>;
export type RegionName = keyof typeof REG;

const INK = "rgba(22,20,18,1)";

const randomBarcode = (ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number) => {
  // Invented: random bar/space widths, no symbology.
  ctx.fillStyle = "#111";
  let cx = x;
  while (cx < x + w) {
    const bw = 1 + Math.floor(rng() * 4) * 2;
    const sw = 1 + Math.floor(rng() * 3) * 2;
    if (cx + bw > x + w) break;
    ctx.fillRect(cx, y, bw, h);
    cx += bw + sw;
  }
};

const fillerLines = (ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, n: number, step: number, thick: number) => {
  ctx.fillStyle = "rgba(120,120,120,0.85)";
  for (let i = 0; i < n; i++) ctx.fillRect(x, y + i * step, w * (0.45 + rng() * 0.55), thick);
};

const code = (rng: Rng, n: number) => {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += A[Math.floor(rng() * A.length)];
  return s;
};

const paper = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  ctx.save();
  // soft shadow from the label's slightly lifted, curled edge
  ctx.shadowColor = "rgba(40,25,10,0.45)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#F2F0EA";
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  // faint curl shading on one corner and a slight overall tint gradient
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "rgba(255,255,255,0.0)");
  g.addColorStop(0.85, "rgba(0,0,0,0.0)");
  g.addColorStop(1, "rgba(60,40,20,0.14)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
};

const drawShippingLabel = (ctx: CanvasRenderingContext2D, r: Region, rng: Rng) => {
  const m = 30;
  const x = r.x + m, y = r.y + m, w = r.w - 2 * m, h = r.h - 2 * m;
  paper(ctx, x, y, w, h);
  const s = w / 540;
  ctx.fillStyle = "#111";
  ctx.font = `700 ${150 * s}px Inter`;
  ctx.textBaseline = "top";
  ctx.fillText("1", x + 22 * s, y + 40 * s);
  fillerLines(ctx, rng, x + 140 * s, y + 50 * s, 360 * s, 5, 26 * s, 9 * s);
  ctx.fillStyle = "#222";
  ctx.fillRect(x + 18 * s, y + 210 * s, w - 36 * s, 4 * s);
  fillerLines(ctx, rng, x + 30 * s, y + 240 * s, 300 * s, 4, 28 * s, 10 * s);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 4 * s;
  ctx.strokeRect(x + 370 * s, y + 236 * s, 130 * s, 110 * s);
  ctx.fillStyle = "#222";
  ctx.fillRect(x + 18 * s, y + 380 * s, w - 36 * s, 4 * s);
  ctx.font = `600 ${30 * s}px Inter`;
  ctx.fillText(code(rng, 3) + " " + code(rng, 4), x + 40 * s, y + 405 * s);
  randomBarcode(ctx, rng, x + 40 * s, y + 450 * s, w - 80 * s, 150 * s);
  ctx.fillStyle = "#222";
  ctx.fillRect(x + 18 * s, y + 650 * s, w - 36 * s, 4 * s);
  ctx.font = `700 ${40 * s}px Inter`;
  ctx.fillStyle = "#111";
  ctx.fillText("ID – " + code(rng, 7), x + 40 * s, y + 690 * s);
  ctx.beginPath();
  ctx.arc(x + w - 70 * s, y + 712 * s, 20 * s, 0, Math.PI * 2);
  ctx.lineWidth = 5 * s;
  ctx.stroke();
  fillerLines(ctx, rng, x + 40 * s, y + 770 * s, 300 * s, 2, 24 * s, 8 * s);
};

const drawWideLabel = (ctx: CanvasRenderingContext2D, r: Region, rng: Rng) => {
  const m = 30;
  const x = r.x + m, y = r.y + m, w = r.w - 2 * m, h = r.h - 2 * m;
  paper(ctx, x, y, w, h);
  const s = h / 540;
  ctx.fillStyle = "#111";
  ctx.font = `700 ${140 * s}px Inter`;
  ctx.textBaseline = "top";
  ctx.fillText("1", x + 30 * s, y + 30 * s);
  fillerLines(ctx, rng, x + 150 * s, y + 40 * s, 600 * s, 4, 30 * s, 10 * s);
  ctx.fillRect(x + 20 * s, y + 190 * s, w - 40 * s, 4 * s);
  randomBarcode(ctx, rng, x + 40 * s, y + 230 * s, w * 0.6, 160 * s);
  fillerLines(ctx, rng, x + w * 0.68, y + 235 * s, w * 0.26, 5, 30 * s, 9 * s);
  ctx.fillStyle = "#111";
  ctx.font = `700 ${38 * s}px Inter`;
  ctx.fillText("REF " + code(rng, 8), x + 40 * s, y + 420 * s);
};

const drawMini = (ctx: CanvasRenderingContext2D, r: Region, rng: Rng) => {
  const m = 26;
  const x = r.x + m, y = r.y + m, w = r.w - 2 * m, h = r.h - 2 * m;
  paper(ctx, x, y, w, h);
  fillerLines(ctx, rng, x + 30, y + 30, w * 0.55, 5, 30, 10);
  randomBarcode(ctx, rng, x + 30, y + h - 130, w - 60, 90);
};

// Universal recycling symbol: three chasing arrows round a rounded triangle.
const drawRecycle = (ctx: CanvasRenderingContext2D, r: Region, framed: boolean) => {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2 + 20;
  const R = r.w * 0.33, cr = r.w * 0.07;
  ctx.save();
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  if (framed) {
    ctx.lineWidth = r.w * 0.022;
    const p = r.w * 0.06;
    ctx.strokeRect(r.x + p, r.y + p, r.w - 2 * p, r.h - 2 * p);
  }
  // Rounded triangle perimeter, sampled densely (math coords, y up).
  const pts: Array<[number, number]> = [];
  const inner = R - 2 * cr;
  // the triangle pointing up in screen space has its top vertex at math 90deg
  const flip = (p: [number, number]): [number, number] => [cx + p[0], cy - p[1]];
  const vA = [90, -30, 210].map((d) => (d * Math.PI) / 180);
  const cornerUp = (i: number) => [Math.cos(vA[i]) * inner, Math.sin(vA[i]) * inner] as const;
  for (let i = 0; i < 3; i++) {
    const [ox, oy] = cornerUp(i);
    const a0 = vA[i] + (60 * Math.PI) / 180, a1 = vA[i] - (60 * Math.PI) / 180;
    for (let k = 0; k <= 24; k++) {
      const a = a0 + (a1 - a0) * (k / 24);
      pts.push(flip([ox + Math.cos(a) * cr, oy + Math.sin(a) * cr]));
    }
  }
  pts.push(pts[0]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  const at = (s: number): [number, number, number] => {
    s = ((s % total) + total) % total;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t;
    const y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
    return [x, y, Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])];
  };
  // Side midpoints: each side's straight run lies between corner arcs.
  const sideLen = total / 3;
  // pts[0..24] is the first corner arc, pts[24]->pts[25] the first side.
  const mid0 = (cum[24] + cum[25]) / 2;
  const width = r.w * 0.085, head = r.w * 0.11, gap = r.w * 0.05;
  for (let k = 0; k < 3; k++) {
    const s0 = mid0 + (k - 1) * sideLen + gap / 2;
    const s1 = mid0 + k * sideLen - gap / 2 - head;
    ctx.beginPath();
    const n = 40;
    for (let j = 0; j <= n; j++) {
      const [x, y] = at(s0 + ((s1 - s0) * j) / n);
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = width;
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    ctx.stroke();
    const [hx, hy, ha] = at(s1);
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(ha) * head, hy + Math.sin(ha) * head);
    ctx.lineTo(hx + Math.cos(ha + Math.PI / 2) * width * 1.15, hy + Math.sin(ha + Math.PI / 2) * width * 1.15);
    ctx.lineTo(hx - Math.cos(ha + Math.PI / 2) * width * 1.15, hy - Math.sin(ha + Math.PI / 2) * width * 1.15);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
};

// Handling pictograms: this-way-up arrows, keep-dry umbrella, fragile glass.
const drawHandling = (ctx: CanvasRenderingContext2D, r: Region) => {
  const cell = r.h;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  for (let i = 0; i < 3; i++) {
    const x = r.x + i * cell, y = r.y;
    const p = cell * 0.08;
    ctx.lineWidth = cell * 0.025;
    ctx.strokeRect(x + p, y + p, cell - 2 * p, cell - 2 * p);
    const cx = x + cell / 2, cy = y + cell / 2;
    const u = cell / 100;
    if (i === 0) {
      for (const dx of [-14, 14]) {
        ctx.fillRect(cx + dx * u - 3 * u, cy - 14 * u, 6 * u, 34 * u);
        ctx.beginPath();
        ctx.moveTo(cx + dx * u, cy - 32 * u);
        ctx.lineTo(cx + dx * u - 10 * u, cy - 12 * u);
        ctx.lineTo(cx + dx * u + 10 * u, cy - 12 * u);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillRect(cx - 28 * u, cy + 26 * u, 56 * u, 6 * u);
    } else if (i === 1) {
      ctx.beginPath();
      ctx.moveTo(cx - 32 * u, cy - 4 * u);
      ctx.quadraticCurveTo(cx - 30 * u, cy - 34 * u, cx, cy - 34 * u);
      ctx.quadraticCurveTo(cx + 30 * u, cy - 34 * u, cx + 32 * u, cy - 4 * u);
      for (let k = 0; k < 4; k++) {
        const x0 = cx + 32 * u - k * 16 * u;
        ctx.quadraticCurveTo(x0 - 8 * u, cy - 12 * u, x0 - 16 * u, cy - 4 * u);
      }
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 5 * u;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6 * u);
      ctx.lineTo(cx, cy + 22 * u);
      ctx.arc(cx - 7 * u, cy + 22 * u, 7 * u, 0, Math.PI);
      ctx.stroke();
      // rain drops
      for (const [dx, dy] of [[-24, -42], [-6, -44], [14, -42], [28, -40]]) {
        ctx.fillRect(cx + dx * u, cy + dy * u - 6 * u, 3 * u, 7 * u);
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - 18 * u, cy - 34 * u);
      ctx.lineTo(cx + 18 * u, cy - 34 * u);
      ctx.quadraticCurveTo(cx + 20 * u, cy - 2 * u, cx + 3 * u, cy + 2 * u);
      ctx.lineTo(cx + 3 * u, cy + 24 * u);
      ctx.lineTo(cx + 14 * u, cy + 30 * u);
      ctx.lineTo(cx - 14 * u, cy + 30 * u);
      ctx.lineTo(cx - 3 * u, cy + 24 * u);
      ctx.lineTo(cx - 3 * u, cy + 2 * u);
      ctx.quadraticCurveTo(cx - 20 * u, cy - 2 * u, cx - 18 * u, cy - 34 * u);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
};

export const makeDecalAtlas = (seed: number) => {
  const rng = mulberry32(seed);
  const c = canvas(ATLAS, ATLAS);
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, ATLAS, ATLAS);
  drawShippingLabel(ctx, REG.labelA, rng);
  drawShippingLabel(ctx, REG.labelB, rng);
  drawWideLabel(ctx, REG.labelC, rng);
  drawMini(ctx, REG.mini, rng);
  drawRecycle(ctx, REG.recycleBox, true);
  drawRecycle(ctx, REG.recycle, false);
  drawHandling(ctx, REG.handling);
  // glue joint strip: darker overlapping flap with a fine shadow line
  {
    const r = REG.joint;
    const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    g.addColorStop(0, "rgba(60,38,15,0.0)");
    g.addColorStop(0.08, "rgba(30,18,6,0.55)");
    g.addColorStop(0.16, "rgba(60,38,15,0.22)");
    g.addColorStop(1, "rgba(80,50,20,0.14)");
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  const t = finish(c, true, false);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.premultiplyAlpha = false;
  return t;
};

// Atlas region -> uv rect (flipY: canvas top = v 1).
export const regionUV = (r: Region) => ({
  u0: r.x / ATLAS,
  u1: (r.x + r.w) / ATLAS,
  v0: 1 - (r.y + r.h) / ATLAS,
  v1: 1 - r.y / ATLAS,
});
