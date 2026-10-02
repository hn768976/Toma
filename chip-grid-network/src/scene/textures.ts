import * as THREE from "three";
import { mulberry32, Rng } from "../lib/random";

// ---------------------------------------------------------------------------
// Self-made textures, drawn into canvases with seeded randomness.
// Every texture is built once per page and cached at module level.
// ---------------------------------------------------------------------------

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");
  return { c, ctx };
};

/** Tileable value noise on a `cells` x `cells` lattice. */
const makeValueNoise = (rng: Rng, cells: number) => {
  const lattice = new Float32Array(cells * cells);
  for (let k = 0; k < lattice.length; k++) lattice[k] = rng();
  const at = (x: number, y: number) =>
    lattice[(((y % cells) + cells) % cells) * cells + (((x % cells) + cells) % cells)];
  return (u: number, v: number) => {
    // u, v in [0, 1)
    const x = u * cells;
    const y = v * cells;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
};

const toTexture = (c: HTMLCanvasElement, srgb: boolean, repeat = true) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};

// ---------------------------------------------------------------------------
// Floor: slate tiles. The texture covers 4 x 4 grid cells (16 world units).
// Main seams every cell (4 units), a finer seam at half a cell, and a faint
// sub-grid every unit. Returns colour + roughness maps.
// ---------------------------------------------------------------------------
export const FLOOR_TEXTURE_UNITS = 16;
let floorCache: { map: THREE.Texture; rough: THREE.Texture; normal: THREE.Texture } | null = null;
export const getFloorTextures = () => {
  if (floorCache) return floorCache;
  const SIZE = 2048;
  const PX_PER_UNIT = SIZE / FLOOR_TEXTURE_UNITS; // 128
  const rng = mulberry32(0xf100_4a11);
  const nLow = makeValueNoise(rng, 8);
  const nMid = makeValueNoise(rng, 32);
  const nHigh = makeValueNoise(rng, 256);
  // per half-cell tile tone (8 x 8 tiles in the texture)
  const TILES = 8;
  const tone = new Float32Array(TILES * TILES);
  const gloss = new Float32Array(TILES * TILES);
  for (let k = 0; k < tone.length; k++) {
    tone[k] = (rng() - 0.5) * 0.09;
    gloss[k] = (rng() - 0.5) * 0.12;
  }
  const col = makeCanvas(SIZE, SIZE);
  const rough = makeCanvas(SIZE, SIZE);
  const cImg = col.ctx.createImageData(SIZE, SIZE);
  const rImg = rough.ctx.createImageData(SIZE, SIZE);
  // Seams sit half a cell away from node centres (node centres are at
  // multiples of 4 units; the texture is offset by 2 units in the floor uv).
  const seam = (p: number, period: number, halfWidth: number) => {
    const m = ((p % period) + period) % period;
    const d = Math.min(m, period - m);
    return Math.max(0, 1 - d / halfWidth);
  };
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const tile = Math.floor((x / SIZE) * TILES) + Math.floor((y / SIZE) * TILES) * TILES;
      const main = Math.max(seam(x, 4 * PX_PER_UNIT, 3.2), seam(y, 4 * PX_PER_UNIT, 3.2));
      const half = Math.max(seam(x, 2 * PX_PER_UNIT, 2.4), seam(y, 2 * PX_PER_UNIT, 2.4));
      const fine = Math.max(seam(x, PX_PER_UNIT, 1.1), seam(y, PX_PER_UNIT, 1.1));
      const mott = nLow(u, v) * 0.5 + nMid(u, v) * 0.35 + nHigh(u, v) * 0.15;
      // base slate blue-grey (sRGB)
      let r = 0.23 + tone[tile] + (mott - 0.5) * 0.045;
      let g = 0.27 + tone[tile] + (mott - 0.5) * 0.045;
      let b = 0.335 + tone[tile] + (mott - 0.5) * 0.05;
      const seamDark = Math.max(main * 0.85, half * 0.7, fine * 0.12);
      r *= 1 - seamDark;
      g *= 1 - seamDark;
      b *= 1 - seamDark * 0.95;
      const o = (y * SIZE + x) * 4;
      cImg.data[o] = Math.round(Math.min(1, Math.max(0, r)) * 255);
      cImg.data[o + 1] = Math.round(Math.min(1, Math.max(0, g)) * 255);
      cImg.data[o + 2] = Math.round(Math.min(1, Math.max(0, b)) * 255);
      cImg.data[o + 3] = 255;
      // roughness: semi-gloss tiles with mottling, rough seams
      let ro = 0.4 + gloss[tile] + (nMid(u + 0.37, v + 0.11) - 0.5) * 0.1 + (nHigh(v, u) - 0.5) * 0.05;
      ro = ro + Math.max(main, half) * 0.5;
      const rv = Math.round(Math.min(1, Math.max(0, ro)) * 255);
      rImg.data[o] = rv;
      rImg.data[o + 1] = rv;
      rImg.data[o + 2] = rv;
      rImg.data[o + 3] = 255;
    }
  }
  col.ctx.putImageData(cImg, 0, 0);
  rough.ctx.putImageData(rImg, 0, 0);

  // Normal map from a height field: tiles are flat with bevelled edges
  // falling into the seams.
  const bevel = (p: number, period: number, w: number) => {
    const m = ((p % period) + period) % period;
    const d = Math.min(m, period - m);
    return Math.min(1, d / w);
  };
  const height = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const hx = Math.min(bevel(x, 2 * PX_PER_UNIT, 7), bevel(x, 4 * PX_PER_UNIT, 9));
      const hy = Math.min(bevel(y, 2 * PX_PER_UNIT, 7), bevel(y, 4 * PX_PER_UNIT, 9));
      const h = Math.min(hx, hy);
      height[y * SIZE + x] = Math.sqrt(h);
    }
  }
  const nrm = makeCanvas(SIZE, SIZE);
  const nImg = nrm.ctx.createImageData(SIZE, SIZE);
  const STRENGTH = 2.2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const hl = height[y * SIZE + ((x + SIZE - 1) % SIZE)];
      const hr = height[y * SIZE + ((x + 1) % SIZE)];
      const hu = height[((y + SIZE - 1) % SIZE) * SIZE + x];
      const hd = height[((y + 1) % SIZE) * SIZE + x];
      let nx = (hl - hr) * STRENGTH;
      let ny = (hd - hu) * STRENGTH;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const o = (y * SIZE + x) * 4;
      nImg.data[o] = Math.round((nx * 0.5 + 0.5) * 255);
      nImg.data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nImg.data[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nImg.data[o + 3] = 255;
    }
  }
  nrm.ctx.putImageData(nImg, 0, 0);
  floorCache = { map: toTexture(col.c, true), rough: toTexture(rough.c, false), normal: toTexture(nrm.c, false) };
  return floorCache;
};

// ---------------------------------------------------------------------------
// PCB: dark green board with traces, pads, vias and a silver die frame.
// ---------------------------------------------------------------------------
let pcbCache: THREE.Texture | null = null;
export const getPcbTexture = () => {
  if (pcbCache) return pcbCache;
  const S = 1024;
  const rng = mulberry32(0x9cb0_7ace);
  const { c, ctx } = makeCanvas(S, S);
  // board
  const img = ctx.createImageData(S, S);
  const n = makeValueNoise(rng, 64);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const m = n(x / S, y / S) - 0.5;
      const o = (y * S + x) * 4;
      img.data[o] = Math.round(34 + m * 8);
      img.data[o + 1] = Math.round(104 + m * 14);
      img.data[o + 2] = Math.round(96 + m * 12);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const mid = S / 2;
  const dieFrame = S * 0.19;
  // traces: from the die frame outward, orthogonal with a 45 degree jog
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const sides = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of sides) {
    const count = 11;
    for (let k = 0; k < count; k++) {
      const off = (k - (count - 1) / 2) * (dieFrame * 2 / count) * 0.92;
      const px = mid + dx * (dieFrame + 10) + (dy !== 0 ? off : 0);
      const py = mid + dy * (dieFrame + 10) + (dx !== 0 ? off : 0);
      const len1 = 40 + rng() * 120;
      const jog = (rng() - 0.5) * 120;
      const len2 = 60 + rng() * 220;
      const x1 = px + dx * len1;
      const y1 = py + dy * len1;
      const x2 = x1 + dx * Math.abs(jog) + (dy !== 0 ? jog : 0);
      const y2 = y1 + dy * Math.abs(jog) + (dx !== 0 ? jog : 0);
      const x3 = x2 + dx * len2;
      const y3 = y2 + dy * len2;
      ctx.strokeStyle = "rgba(118, 196, 170, 0.55)";
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.stroke();
      // via / pad at the end
      ctx.fillStyle = "rgba(196, 176, 112, 0.9)";
      ctx.beginPath();
      ctx.arc(x3, y3, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(20, 50, 44, 1)";
      ctx.beginPath();
      ctx.arc(x3, y3, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // scattered SMD parts
  for (let k = 0; k < 46; k++) {
    const x = rng() * S;
    const y = rng() * S;
    if (Math.abs(x - mid) < dieFrame + 70 && Math.abs(y - mid) < dieFrame + 70) continue;
    const w = 10 + rng() * 18;
    const h = 6 + rng() * 8;
    const rot = rng() < 0.5;
    ctx.fillStyle = "rgba(30, 32, 34, 0.95)";
    ctx.fillRect(x, y, rot ? h : w, rot ? w : h);
    ctx.fillStyle = "rgba(210, 205, 190, 0.9)";
    if (rot) {
      ctx.fillRect(x, y, h, 3);
      ctx.fillRect(x, y + w - 3, h, 3);
    } else {
      ctx.fillRect(x, y, 3, h);
      ctx.fillRect(x + w - 3, y, 3, h);
    }
  }
  // die frame (silver) and pin row
  ctx.strokeStyle = "rgba(205, 214, 220, 0.95)";
  ctx.lineWidth = 9;
  ctx.strokeRect(mid - dieFrame, mid - dieFrame, dieFrame * 2, dieFrame * 2);
  ctx.fillStyle = "rgba(190, 196, 200, 0.85)";
  for (let k = 0; k < 16; k++) {
    const t = -dieFrame + 12 + k * ((dieFrame * 2 - 24) / 15);
    ctx.fillRect(mid + t - 2.5, mid - dieFrame - 18, 5, 10);
    ctx.fillRect(mid + t - 2.5, mid + dieFrame + 8, 5, 10);
    ctx.fillRect(mid - dieFrame - 18, mid + t - 2.5, 10, 5);
    ctx.fillRect(mid + dieFrame + 8, mid + t - 2.5, 10, 5);
  }
  // board edge
  ctx.strokeStyle = "rgba(12, 40, 36, 1)";
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, S - 14, S - 14);
  pcbCache = toTexture(c, true, false);
  return pcbCache;
};

// ---------------------------------------------------------------------------
// Inner wall circuit lines: white-on-black emissive mask. u = around the
// perimeter (texture repeats twice per node), v = height.
// ---------------------------------------------------------------------------
let linesCache: THREE.Texture | null = null;
export const getInnerLinesTexture = () => {
  if (linesCache) return linesCache;
  const W = 1024;
  const H = 256;
  const rng = mulberry32(0x1a5e_0001);
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.lineCap = "square";
  // 4 faces per repeat; draw an H-like trace group in each face
  const faces = 4;
  const fw = W / faces;
  for (let f = 0; f < faces; f++) {
    const x0 = f * fw;
    const groups = 3 + Math.floor(rng() * 2);
    for (let g = 0; g < groups; g++) {
      const cx = x0 + fw * (0.2 + 0.6 * ((g + 0.5) / groups)) + (rng() - 0.5) * 8;
      const yTop = H * (0.12 + rng() * 0.2);
      const yBot = H * (0.7 + rng() * 0.22);
      const yJog = yTop + (yBot - yTop) * (0.3 + rng() * 0.4);
      const jog = (rng() - 0.5) * 22;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, yTop);
      ctx.lineTo(cx, yJog);
      ctx.lineTo(cx + jog, yJog + Math.abs(jog));
      ctx.lineTo(cx + jog, yBot);
      ctx.stroke();
      // pads
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.fillRect(cx - 4, yTop - 4, 8, 8);
      ctx.fillRect(cx + jog - 4, yBot - 4, 8, 8);
      // short horizontal bridge to next group
      if (rng() < 0.6) {
        const yb = yTop + (yBot - yTop) * rng();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath();
        ctx.moveTo(cx, yb);
        ctx.lineTo(cx + fw / groups * 0.5, yb);
        ctx.stroke();
      }
    }
    // faint frame lines near the face edges
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0 + 6, H * 0.06);
    ctx.lineTo(x0 + 6, H * 0.94);
    ctx.moveTo(x0 + fw - 6, H * 0.06);
    ctx.lineTo(x0 + fw - 6, H * 0.94);
    ctx.stroke();
  }
  linesCache = toTexture(c, false);
  return linesCache;
};

// ---------------------------------------------------------------------------
// Brushed aluminium: fine streaks along u. Used as colour + roughness.
// ---------------------------------------------------------------------------
let brushedCache: { map: THREE.Texture; rough: THREE.Texture } | null = null;
export const getBrushedTextures = () => {
  if (brushedCache) return brushedCache;
  const S = 512;
  const rng = mulberry32(0xb245_4ed0);
  const rows = new Float32Array(S);
  for (let y = 0; y < S; y++) rows[y] = rng();
  const n = makeValueNoise(rng, 16);
  const col = makeCanvas(S, S);
  const ro = makeCanvas(S, S);
  const ci = col.ctx.createImageData(S, S);
  const ri = ro.ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // streaks: row value smeared with a long horizontal noise
      const streak = rows[y] * 0.6 + rows[(y + 1) % S] * 0.2 + rows[(y + S - 1) % S] * 0.2;
      const lo = n(x / S, y / S);
      const v = 0.78 + (streak - 0.5) * 0.12 + (lo - 0.5) * 0.06;
      const o = (y * S + x) * 4;
      const cv = Math.round(Math.min(1, Math.max(0, v)) * 255);
      ci.data[o] = cv;
      ci.data[o + 1] = cv;
      ci.data[o + 2] = Math.min(255, cv + 4);
      ci.data[o + 3] = 255;
      const rv = Math.round(Math.min(1, Math.max(0, 0.4 + (streak - 0.5) * 0.18)) * 255);
      ri.data[o] = rv;
      ri.data[o + 1] = rv;
      ri.data[o + 2] = rv;
      ri.data[o + 3] = 255;
    }
  }
  col.ctx.putImageData(ci, 0, 0);
  ro.ctx.putImageData(ri, 0, 0);
  brushedCache = { map: toTexture(col.c, true), rough: toTexture(ro.c, false) };
  return brushedCache;
};

// ---------------------------------------------------------------------------
// Frosted top: soft speckle for the white glowing inset.
// ---------------------------------------------------------------------------
let frostCache: THREE.Texture | null = null;
export const getFrostTexture = () => {
  if (frostCache) return frostCache;
  const S = 256;
  const rng = mulberry32(0xf205_7ed0);
  const n1 = makeValueNoise(rng, 8);
  const n2 = makeValueNoise(rng, 64);
  const { c, ctx } = makeCanvas(S, S);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      // brighter centre, slight rim darkening, speckle
      const dx = u - 0.5;
      const dy = v - 0.5;
      const rim = Math.max(Math.abs(dx), Math.abs(dy));
      const val = 0.8 + n1(u, v) * 0.12 + n2(u, v) * 0.08 - Math.max(0, rim - 0.38) * 1.6;
      const o = (y * S + x) * 4;
      const cv = Math.round(Math.min(1, Math.max(0, val)) * 255);
      img.data[o] = cv;
      img.data[o + 1] = cv;
      img.data[o + 2] = cv;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  frostCache = toTexture(c, true, false);
  return frostCache;
};
