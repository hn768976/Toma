import { DrawFn } from "../lib/CanvasLook";
import { MONO } from "../lib/fonts";
import { periodicNoise } from "../lib/noise";
import { cyc, digits, hash3, hashF, holdBucket, loopFrame, mulberry32, smoothstep, TAU } from "../lib/random";

export type NebulaHudProps = {
  bg: string;
  grid: string;
  violet: [number, number, number];
  magenta: [number, number, number];
  deep: [number, number, number];
  dots: string[]; // white, lavender, cyan, pink
  text: string;
  line: string;
  accent: string;
};

// ----------------------------------------------------- tileable nebula --
// Seeded value noise on a lattice that wraps in x, so the texture tiles
// horizontally. Built once per (size, seed) and cached; at render time it is
// only translated by exactly one tile width per loop.
const texCache = new Map<string, HTMLCanvasElement>();
const scratchCache = new Map<string, HTMLCanvasElement>();
const scratch = (name: string, w: number, h: number) => {
  const key = `${name}:${w}x${h}`;
  let c = scratchCache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    scratchCache.set(key, c);
  }
  return c;
};
/**
 * Dot-matrix text: rasterise the lines at a tiny size (one texel per LED cell),
 * threshold, then draw each lit cell as a square on the cell grid.
 */
const dotText = (
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  cell: number,
  glyph: number, // font size in cells
  color: string,
  alphas: number[] = [],
) => {
  const lineH = Math.round(glyph * 1.15);
  const tw = Math.ceil(Math.max(...lines.map((l) => l.length)) * glyph * 0.62) + 2;
  const th = lines.length * lineH + 2;
  const t = scratch("dot", tw, th);
  const tc = t.getContext("2d", { willReadFrequently: true })!;
  tc.clearRect(0, 0, tw, th);
  tc.fillStyle = "#fff";
  tc.font = `500 ${glyph}px ${MONO}`;
  tc.textBaseline = "top";
  lines.forEach((l, i) => tc.fillText(l, 1, 1 + i * lineH));
  const d = tc.getImageData(0, 0, tw, th).data;
  const x0 = Math.floor(x / cell) * cell;
  const y0 = Math.floor(y / cell) * cell;
  const sz = Math.max(1, cell - Math.max(1, Math.round(cell * 0.22)));
  ctx.fillStyle = color;
  for (let j = 0; j < th; j++) {
    ctx.globalAlpha = alphas[Math.min(lines.length - 1, Math.floor(j / lineH))] ?? 1;
    for (let i = 0; i < tw; i++) if (d[(j * tw + i) * 4 + 3] > 110) ctx.fillRect(x0 + i * cell, y0 + j * cell, sz, sz);
  }
  ctx.globalAlpha = 1;
};

const buildNebula = (tw: number, th: number, seed: number, p: NebulaHudProps, specks: number) => {
  const key = `${tw}x${th}:${seed}:${p.violet}:${p.magenta}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = tw;
  cv.height = th;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(tw, th);
  const oct = [0, 1, 2, 3, 4].map((o) => {
    const cx = 4 << o; // cells across the tile (integer → periodic)
    const cy = Math.max(2, Math.round((cx * th * 5.5) / tw)); // strongly stretched → horizontal streaks
    return { n: periodicNoise(seed * 7 + o, cx, cy), cx, cy, amp: 0.5 ** o };
  });
  const warp = periodicNoise(seed * 13 + 99, 6, 4);
  let k = 0;
  for (let y = 0; y < th; y++) {
    const v = y / th;
    // soft horizontal band mask (baked into alpha)
    const band = Math.exp(-(((v - 0.5) / 0.23) ** 2));
    for (let x = 0; x < tw; x++, k += 4) {
      const u = x / tw;
      const wv = warp(u * 6, v * 4) - 0.5;
      let s = 0;
      let norm = 0;
      for (const o of oct) {
        s += o.n(u * o.cx, (v + wv * 0.12) * o.cy) * o.amp;
        norm += o.amp;
      }
      s /= norm;
      const dens = smoothstep(0.3, 0.72, s) * band;
      const hue = oct[1].n(u * 8 + 3.3, v * 3) ; // violet ↔ magenta mix
      const r = p.deep[0] + (p.violet[0] - p.deep[0]) * dens + (p.magenta[0] - p.violet[0]) * hue * dens;
      const g = p.deep[1] + (p.violet[1] - p.deep[1]) * dens + (p.magenta[1] - p.violet[1]) * hue * dens;
      const b = p.deep[2] + (p.violet[2] - p.deep[2]) * dens + (p.magenta[2] - p.violet[2]) * hue * dens;
      img.data[k] = r;
      img.data[k + 1] = g;
      img.data[k + 2] = b;
      img.data[k + 3] = 255 * Math.min(1, dens * 1.5 + band * 0.22);
    }
  }
  ctx.putImageData(img, 0, 0);
  // bright specks, concentrated in the band
  const r = mulberry32(seed + 5);
  for (let i = 0; i < specks; i++) {
    const x = r() * tw;
    const y = th * (0.5 + (r() + r() + r() - 1.5) * 0.28);
    const s = r() < 0.85 ? 1 : 2;
    ctx.fillStyle = r() < 0.5 ? "rgba(255,230,255,0.85)" : "rgba(210,180,255,0.7)";
    for (const dx of [0, -tw, tw]) ctx.fillRect(Math.round(x + dx), Math.round(y), s, s);
  }
  texCache.set(key, cv);
  return cv;
};

// ------------------------------------------------------- sphere data --
const sphereNoise = periodicNoise(0x2757, 24, 12);
const PATCHES = (() => {
  const r = mulberry32(0x27571);
  return Array.from({ length: 9 }, () => ({
    u: r() * 1.6 - 0.8,
    v: r() * 1.6 - 0.8,
    w: 0.1 + r() * 0.25,
    h: 0.05 + r() * 0.14,
    hold: [4, 5, 6, 8, 10][Math.floor(r() * 5)],
    gate: [50, 60, 75, 100][Math.floor(r() * 4)],
    off: Math.floor(r() * 600),
  }));
})();

// circuit polylines (fractions of w, h)
const CIRCUITS: [number, number][][] = [
  [[0.0, 0.07], [0.12, 0.07], [0.15, 0.04], [0.33, 0.04]],
  [[0.19, 0.04], [0.21, 0.07], [0.31, 0.07], [0.31, 0.2], [0.36, 0.2]],
  [[0.08, 0.12], [0.2, 0.12], [0.22, 0.15], [0.3, 0.15]],
  [[1.0, 0.09], [0.86, 0.09], [0.84, 0.06], [0.68, 0.06]],
  [[0.62, 0.72], [0.78, 0.72], [0.8, 0.69], [0.97, 0.69]],
];
const GLITCH = [61, 178, 289, 403, 537];

const rgb = (c: [number, number, number], a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export const drawNebulaHud: DrawFn<NebulaHudProps> = (ctx, w, h, frame, c) => {
  const f = loopFrame(frame);
  const R = Math.round;
  const X = (v: number) => R(v * w);
  const Y = (v: number) => R(v * h);
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);

  // ---------------------------------------------------------- nebula --
  const cell = Math.max(3, R(0.0075 * h)); // LED cell, integer pixels
  const tcell = Math.max(2, R(0.0042 * h)); // dot-matrix text cell
  const bandH = R(0.5 * h);
  const bandY = R(0.4 * h - bandH / 2);
  const texW1 = Math.min(1920, w);
  const tex1 = buildNebula(texW1, R(texW1 * (bandH / w)), 1, c, 2600);
  const tex2 = buildNebula(R(texW1 / 2), R((texW1 / 2) * (bandH / (w / 2)) / 1.3), 2, c, 900);
  // Draw both layers into a low-res buffer (one texel per LED cell), then
  // blow it up with nearest-neighbour so the band reads as a dot matrix.
  const lw = Math.ceil(w / cell);
  const lh = Math.ceil(h / cell);
  const low = scratch("neb", lw, lh);
  const lctx = low.getContext("2d")!;
  lctx.clearRect(0, 0, lw, lh);
  lctx.imageSmoothingEnabled = true;
  lctx.imageSmoothingQuality = "high";
  const k = 1 / cell;
  // slow layer: tile width w/2, moves one tile per loop
  lctx.globalCompositeOperation = "source-over";
  lctx.globalAlpha = 0.6;
  const t2 = w / 2;
  const o2 = cyc(f, 1) * t2;
  for (let i = -1; i <= 2; i++) lctx.drawImage(tex2, (i * t2 - o2) * k, (bandY + bandH * 0.08) * k, t2 * k, bandH * 0.84 * k);
  // main layer: tile width w, moves one tile per loop
  lctx.globalAlpha = 1;
  lctx.globalCompositeOperation = "screen";
  const o1 = cyc(f, 1) * w;
  for (let i = -1; i <= 1; i++) lctx.drawImage(tex1, (i * w - o1) * k, bandY * k, w * k, bandH * k);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "screen";
  ctx.drawImage(low, 0, 0, lw * cell, lh * cell);
  ctx.restore();

  // ------------------------------------------------- grid + vignette --
  const gap = Math.max(1, R(cell * 0.18));
  ctx.fillStyle = c.bg;
  ctx.globalAlpha = 0.55;
  for (let gx = 0; gx < w; gx += cell) ctx.fillRect(gx, 0, gap, h);
  for (let gy = 0; gy < h; gy += cell) ctx.fillRect(0, gy, w, gap);
  ctx.fillStyle = c.grid;
  ctx.globalAlpha = 0.2;
  for (let gx = 0; gx < w; gx += cell * 3) ctx.fillRect(gx, 0, 1, h);
  for (let gy = 0; gy < h; gy += cell * 3) ctx.fillRect(0, gy, w, 1);
  ctx.globalAlpha = 1;
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
  vg.addColorStop(0, "rgba(6,2,16,0)");
  vg.addColorStop(1, "rgba(4,1,12,0.85)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // ------------------------------------------------- scanner sphere --
  const scx = 0.47 * w;
  const scy = 0.46 * h;
  const rad = 0.29 * h;
  const step = (2 * rad) / 106; // ≈ 8.8k dots in the disc
  const ds = Math.max(1, R(step * 0.5));
  const rot = TAU * cyc(f, 1);
  const lx = -0.45, ly = -0.55, lz = 0.7;
  const n = 106;
  for (let j = 0; j < n; j++) {
    const v = (j + 0.5) / n * 2 - 1;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n * 2 - 1;
      const rr = u * u + v * v;
      if (rr > 1) continue;
      const z = Math.sqrt(1 - rr);
      const id = j * n + i;
      const shade = Math.max(0, u * lx + v * ly + z * lz) * 0.75 + 0.25;
      const lon = Math.atan2(u, z) + rot;
      const lat = Math.asin(v);
      const ln = sphereNoise((((lon / TAU) % 1) + 1) % 1 * 24, (lat / Math.PI + 0.5) * 12);
      const land = smoothstep(0.45, 0.62, ln);
      const meridian = Math.abs(((lon / TAU) * 16 % 1 + 1) % 1 - 0.5) > 0.46 ? 0.35 : 0;
      let b = shade * (0.3 + 0.55 * land) + meridian * shade * 0.6;
      const noiseDot = hashF(id, holdBucket(f, 6, id % 6), 23);
      b *= noiseDot < 0.3 ? 0.1 : 0.45 + 0.45 * noiseDot;
      const hsh = hash3(id, 17);
      let col = c.dots[hsh % 100 < 60 ? 0 : hsh % 100 < 90 ? 1 : hsh % 100 < 96 ? 2 : 3];
      // scramble patches
      for (let p = 0; p < PATCHES.length; p++) {
        const P = PATCHES[p];
        if (Math.abs(u - P.u) > P.w || Math.abs(v - P.v) > P.h) continue;
        const gateOn = (f + P.off) % P.gate < P.gate * 0.45;
        if (!gateOn) continue;
        const hb = holdBucket(f, P.hold, P.off % P.hold);
        const q = hashF(id, hb, p);
        b = q < 0.35 ? 0.05 : 0.5 + q * 0.7;
        col = c.dots[hash3(id, hb, 9) % 4];
      }
      if (b < 0.04) continue;
      ctx.globalAlpha = Math.min(1, b);
      ctx.fillStyle = col;
      ctx.fillRect(R(scx + u * rad - ds / 2), R(scy + v * rad - ds / 2), ds, ds);
    }
  }
  ctx.globalAlpha = 1;

  // ring, brackets, tags
  ctx.save();
  ctx.translate(scx, scy);
  ctx.rotate(TAU * cyc(f, -1) / 6); // 60-dash ring: 10 dashes back per loop
  ctx.beginPath();
  const rr2 = rad * 1.12;
  ctx.arc(0, 0, rr2, 0, TAU);
  ctx.setLineDash([(TAU * rr2) / 60 * 0.4, (TAU * rr2) / 60 * 0.6]);
  ctx.strokeStyle = c.line;
  ctx.lineWidth = Math.max(1, 0.0016 * h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(scx, scy, rad * 1.42, Math.PI * 1.15, Math.PI * 1.85);
  ctx.strokeStyle = c.line;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
  const br = rad * 1.25;
  const bl = rad * 0.09;
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = c.line;
  ctx.lineWidth = Math.max(1, 0.0018 * h);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(scx + sx * br, scy + sy * br - sy * bl);
    ctx.lineTo(scx + sx * br, scy + sy * br);
    ctx.lineTo(scx + sx * br - sx * bl, scy + sy * br);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tagSize = R(0.0125 * h);
  ctx.font = `500 ${tagSize}px ${MONO}`;
  ctx.textAlign = "center";
  ctx.fillStyle = c.text;
  ctx.fillText(`SCAN ${digits(3, 31, 0, holdBucket(f, 12))}.${digits(2, 32, 0, holdBucket(f, 6))}  LAT ${digits(2, 33, 0, holdBucket(f, 30))}°`, R(scx), R(scy - rad * 1.32));
  ctx.fillText(`OBJ-${digits(4, 34)}  ▸ ${digits(5, 35, 0, holdBucket(f, 20, 3))}`, R(scx), R(scy + rad * 1.36));
  ctx.textAlign = "left";

  // ---------------------------------------------------- circuits --
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(1, 0.0014 * h);
  const dotR = Math.max(1.2, 0.0035 * h);
  CIRCUITS.forEach((pl, ci) => {
    ctx.beginPath();
    pl.forEach(([x, y], i) => (i ? ctx.lineTo(X(x) + 0.5, Y(y) + 0.5) : ctx.moveTo(X(x) + 0.5, Y(y) + 0.5)));
    ctx.stroke();
    pl.slice(1).forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(X(x) + 0.5, Y(y) + 0.5, dotR, 0, TAU);
      ctx.fill();
    });
    // travelling dot (whole passes per loop)
    const lens = pl.slice(1).map(([x, y], i) => Math.hypot((x - pl[i][0]) * w, (y - pl[i][1]) * h));
    const total = lens.reduce((a, b) => a + b, 0);
    let d = cyc(f, 2 + (ci % 3), ci * 0.17) * total;
    for (let i = 0; i < lens.length; i++) {
      if (d <= lens[i]) {
        const t = d / lens[i];
        const px = (pl[i][0] + (pl[i + 1][0] - pl[i][0]) * t) * w;
        const py = (pl[i][1] + (pl[i + 1][1] - pl[i][1]) * t) * h;
        ctx.fillStyle = c.accent;
        ctx.fillRect(R(px - dotR), R(py - dotR), R(dotR * 2), R(dotR * 2));
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        break;
      }
      d -= lens[i];
    }
  });

  // ---------------------------------------------------- data text --
  const tiny = Math.max(7, R(0.0135 * h));
  dotText(
    ctx,
    Array.from({ length: 8 }, (_, r) => `${digits(4, 100 + r, 0, holdBucket(f, [6, 8, 10, 12, 15, 20, 8, 10][r], r))} ${digits(5, 110 + r)} ${digits(6, 120 + r, 0, holdBucket(f, 12, r))}`),
    X(0.006), Y(0.07), tcell, 5, c.dots[0], [1, 0.6, 0.85, 0.5, 0.9, 0.65, 0.8, 0.55],
  );
  dotText(
    ctx,
    Array.from({ length: 8 }, (_, r) => `${digits(3, 180 + r, 0, holdBucket(f, [10, 12, 15, 20, 24, 30, 12, 15][r], r))}${digits(3, 190 + r)} ${digits(8, 195 + r, 0, holdBucket(f, 20, r))}`),
    X(0.006), Y(0.54), tcell, 5, c.text, [0.9, 0.7, 0.9, 0.6, 0.8, 0.7, 0.85, 0.6],
  );
  ctx.font = `400 ${tiny}px ${MONO}`;
  ctx.fillStyle = c.text;
  for (let r = 0; r < 0; r++) {
    const yy = 0.18 + r * 0.024;
    ctx.globalAlpha = 0.6 + 0.4 * ((r * 37) % 5) / 4;
    ctx.fillText(`${digits(4, 100 + r, 0, holdBucket(f, [6, 8, 10, 12, 15, 20][r], r))} ${digits(6, 110 + r)} ${digits(3, 120 + r, 0, holdBucket(f, 24, r * 3))}`, X(0.012), Y(yy));
  }
  ctx.globalAlpha = 1;
  // right column text
  dotText(ctx, Array.from({ length: 5 }, (_, r) => digits(6, 160 + r, 0, holdBucket(f, [8, 12, 20, 30, 40][r], r))), X(0.745), Y(0.28), tcell, 6, c.text, [0.9, 0.6, 0.8, 0.6, 0.9]);
  for (let r = 0; r < 5; r++) {
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = c.text;
    const yy = 0.28 + (r * 7 + 3) * (tcell / h);
    ctx.fillRect(X(0.84), R(yy * h), X(0.03 + 0.08 * hashF(r, 61)), Math.max(1, tcell - 1));
  }
  ctx.globalAlpha = 1;
  ctx.font = `400 ${tiny}px ${MONO}`;
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(X(0.74) + 0.5, Y(0.265) + 0.5);
  ctx.lineTo(X(0.97) + 0.5, Y(0.265) + 0.5);
  ctx.moveTo(X(0.8) + 0.5, Y(0.62) + 0.5);
  ctx.lineTo(X(0.97) + 0.5, Y(0.62) + 0.5);
  ctx.lineTo(X(0.99) + 0.5, Y(0.66) + 0.5);
  ctx.stroke();

  // code panel (lower left): a lit cyan dot-matrix bar
  {
    const x0 = Math.floor(X(0.2) / tcell) * tcell, y0 = Math.floor(Y(0.79) / tcell) * tcell;
    const cols = Math.round(X(0.11) / tcell), rows = 5;
    const sz = Math.max(1, tcell - Math.max(1, R(tcell * 0.22)));
    ctx.fillStyle = c.dots[2];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const on = hashF(i, j, holdBucket(f, 4, 1)) < 0.82;
        ctx.globalAlpha = on ? 0.9 : 0.25;
        ctx.fillRect(x0 + i * tcell, y0 + j * tcell, sz, sz);
      }
    ctx.globalAlpha = 1;
  }

  // segmented bar block (lower right)
  const bx0 = 0.755, by0 = 0.885;
  for (let row = 0; row < 2; row++) {
    const nSeg = 14;
    const lvl = 0.5 + 0.5 * Math.sin(TAU * cyc(f, row + 1, row * 0.3));
    const on = Math.round(lvl * nSeg);
    for (let s = 0; s < nSeg; s++) {
      ctx.fillStyle = s < on ? (row ? c.dots[2] : c.dots[1]) : c.grid;
      ctx.globalAlpha = s < on ? 0.6 : 0.45;
      ctx.fillRect(X(bx0 + s * 0.016), Y(by0 + row * 0.035), X(0.0135), Y(0.02));
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalAlpha = 1;

  // ----------------------------------- mosaic tile clusters in the band --
  {
    const sz = Math.max(1, tcell - Math.max(1, R(tcell * 0.22)));
    for (let k = 0; k < 9; k++) {
      // cluster anchors drift with the band (one width per loop)
      const left = k < 5;
      const ax = ((hashF(k, 1, 91) * 0.24 + (left ? 0.0 : 0.72) - cyc(f, 1) * 0) % 1) * w;
      const ay = bandY + bandH * (0.25 + 0.45 * hashF(k, 2, 91));
      const cols = 6 + (hash3(k, 3, 91) % 14), rows = 2 + (hash3(k, 4, 91) % 4);
      const col = left ? (k % 2 ? c.dots[0] : c.dots[1]) : k % 2 ? c.dots[3] : c.dots[1];
      const hb = holdBucket(f, [5, 6, 8, 10][k % 4], k % 5);
      ctx.fillStyle = col;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const q = hashF(k * 1000 + j * 50 + i, hb, 92);
          if (q < 0.3) continue;
          ctx.globalAlpha = 0.25 + 0.5 * q;
          ctx.fillRect(Math.floor(ax / tcell + i) * tcell, Math.floor(ay / tcell + j) * tcell, sz, sz);
        }
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------ grid crosses at intersections --
  ctx.fillStyle = c.line;
  ctx.globalAlpha = 0.18;
  const cs = Math.max(1, R(cell * 0.6));
  for (let gy = cell * 6; gy < h; gy += cell * 6)
    for (let gx = cell * 6; gx < w; gx += cell * 6) {
      ctx.fillRect(gx - cs, gy, cs * 2 + 1, 1);
      ctx.fillRect(gx, gy - cs, 1, cs * 2 + 1);
    }
  ctx.globalAlpha = 1;

  // ------------------------------------------------- nested sphere rings --
  ctx.strokeStyle = c.line;
  [0.32, 0.55, 0.8].forEach((rf, i) => {
    ctx.save();
    ctx.translate(scx, scy);
    ctx.rotate(TAU * cyc(f, i % 2 ? 1 : -1) / [4, 6, 8][i]);
    ctx.beginPath();
    ctx.arc(0, 0, rad * rf, 0, TAU);
    const n = [24, 36, 48][i];
    ctx.setLineDash([((TAU * rad * rf) / n) * 0.35, ((TAU * rad * rf) / n) * 0.65]);
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = Math.max(1, 0.0012 * h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  });
  ctx.globalAlpha = 1;

  // ------------------------------------------- sparkles in the band --
  for (let i = 0; i < 700; i++) {
    const sx0 = hashF(i, 1, 77);
    const x = ((sx0 - cyc(f, 1) + 1) % 1) * w; // drift with the nebula
    const y = bandY + bandH * (0.5 + (hashF(i, 2, 77) + hashF(i, 3, 77) - 1) * 0.42);
    const tw = hashF(i, holdBucket(f, [6, 8, 10, 12][i % 4], i % 6), 78);
    if (tw < 0.45) continue;
    ctx.globalAlpha = (tw - 0.45) * 1.6;
    ctx.fillStyle = i % 5 === 0 ? c.dots[3] : c.dots[0];
    const sz = Math.max(1, R(h * (i % 7 === 0 ? 0.003 : 0.0016)));
    ctx.fillRect(R(x), R(y), sz, sz);
  }
  ctx.globalAlpha = 1;

  // ------------------------------------------- scattered glitch blocks --
  for (let i = 0; i < 14; i++) {
    const hb = holdBucket(f, [3, 4, 5, 6][i % 4], i % 3);
    if (hashF(i, hb, 81) < 0.55) continue;
    const gx = Math.floor((hashF(i, hb, 82) * w) / tcell) * tcell;
    const gy = Math.floor(((0.15 + hashF(i, hb, 83) * 0.7) * h) / tcell) * tcell;
    const gw = Math.round((0.01 + hashF(i, hb, 84) * 0.05) * w / tcell) * tcell;
    const gh = tcell * (1 + (hash3(i, hb, 85) % 4));
    ctx.globalAlpha = 0.25 + 0.35 * hashF(i, hb, 86);
    ctx.fillStyle = c.dots[hash3(i, hb, 87) % 4];
    ctx.fillRect(gx, gy, gw, gh);
  }
  ctx.globalAlpha = 1;

  // ------------------------------------------------------------ bloom --
  {
    const bw = Math.ceil(w / 4), bh = Math.ceil(h / 4);
    const bl = scratch("bloom", bw, bh);
    const bc = bl.getContext("2d")!;
    bc.filter = "none";
    bc.clearRect(0, 0, bw, bh);
    bc.drawImage(ctx.canvas, 0, 0, bw, bh);
    const bl2 = scratch("bloom2", bw, bh);
    const bc2 = bl2.getContext("2d")!;
    bc2.clearRect(0, 0, bw, bh);
    bc2.filter = `contrast(3) brightness(0.55) blur(${Math.max(1, bh * 0.006)}px)`;
    bc2.drawImage(bl, 0, 0);
    bc2.filter = "none";
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.55;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bl2, 0, 0, w, h);
    ctx.restore();
  }

  // -------------------------------------------------- scan line --
  const sy = cyc(f, 3) * h * 1.1 - h * 0.05;
  const sg = ctx.createLinearGradient(0, sy - 0.06 * h, 0, sy);
  sg.addColorStop(0, "rgba(200,170,255,0)");
  sg.addColorStop(1, "rgba(200,170,255,0.12)");
  ctx.fillStyle = sg;
  ctx.fillRect(0, R(sy - 0.06 * h), w, R(0.06 * h));
  ctx.fillStyle = "rgba(230,215,255,0.22)";
  ctx.fillRect(0, R(sy), w, Math.max(1, R(0.0012 * h)));

  // ----------------------------------------------------- glitches --
  const gi = GLITCH.indexOf(f);
  if (gi >= 0) {
    for (let s = 0; s < 4; s++) {
      const y0 = R(hashF(gi, s, 1) * h * 0.9);
      const hh = R((0.01 + hashF(gi, s, 2) * 0.05) * h);
      const dx = R((hashF(gi, s, 3) - 0.5) * 0.04 * w);
      ctx.drawImage(ctx.canvas, 0, y0, w, hh, dx, y0, w, hh);
    }
  }
};

export const nebulaRgb = rgb;
