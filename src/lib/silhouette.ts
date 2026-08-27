import {random} from 'remotion';
import type {Rect} from './layout';
import type {DensityRule, PathRef, Silhouette} from '../variants';

/**
 * The core technique.
 *
 * 1. The subject's silhouette is filled once into an offscreen canvas.
 * 2. Its outline and the variant's interior CREASE LINES are stroked into a
 *    second offscreen canvas.
 * 3. A chamfer distance transform turns that line raster into a distance field:
 *    for every pixel, how far is the nearest edge or crease.
 * 4. Particle positions are rejection-sampled against the filled mask, with an
 *    acceptance probability that falls off exponentially with that distance.
 *
 * The result is a field that crowds the edges and creases and thins out across
 * flat interior panels - which is what makes the subject legible instead of a
 * blob. Nothing is placed by hand.
 */

const RASTER_W = 860;

export type Field = {
  rw: number;
  rh: number;
  inside: Uint8Array;
  dist: Float32Array; // distance in raster px to nearest edge/crease
  /** path-space -> 4K stage transform */
  scale: number;
  ox: number;
  oy: number;
  /** raster-space scale relative to path space */
  rscale: number;
};

/** A path may carry a scale+translate so one path string can serve twice. */
export const applyXform = (ctx: CanvasRenderingContext2D, p: PathRef) => {
  if (p.t) ctx.transform(p.t[0], 0, 0, p.t[1], p.t[2], p.t[3]);
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** Two-pass chamfer distance transform (1 / sqrt2 weights). */
const chamfer = (mask: Uint8Array, w: number, h: number): Float32Array => {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : INF;
  const D = 1;
  const DD = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + D);
      if (y > 0) v = Math.min(v, d[i - w] + D);
      if (x > 0 && y > 0) v = Math.min(v, d[i - w - 1] + DD);
      if (x < w - 1 && y > 0) v = Math.min(v, d[i - w + 1] + DD);
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + D);
      if (y < h - 1) v = Math.min(v, d[i + w] + D);
      if (x < w - 1 && y < h - 1) v = Math.min(v, d[i + w + 1] + DD);
      if (x > 0 && y < h - 1) v = Math.min(v, d[i + w - 1] + DD);
      d[i] = v;
    }
  }
  return d;
};

export const buildField = (sil: Silhouette, stage: Rect): Field => {
  const [vw, vh] = sil.vb;
  const rscale = RASTER_W / vw;
  const rw = Math.round(vw * rscale);
  const rh = Math.round(vh * rscale);

  // 1. filled silhouette
  const fillC = makeCanvas(rw, rh);
  const fc = fillC.getContext('2d', {willReadFrequently: true})!;
  fc.fillStyle = 'rgb(0,0,0)';
  fc.fillRect(0, 0, rw, rh);
  fc.fillStyle = 'rgb(255,255,255)';
  for (const p of sil.fills) {
    fc.setTransform(rscale, 0, 0, rscale, 0, 0);
    applyXform(fc, p);
    fc.fill(new Path2D(p.d));
  }
  fc.setTransform(1, 0, 0, 1, 0, 0);
  const fillData = fc.getImageData(0, 0, rw, rh).data;
  const inside = new Uint8Array(rw * rh);
  for (let i = 0; i < inside.length; i++) inside[i] = fillData[i * 4] > 127 ? 1 : 0;

  // 2. outline + creases stroked into the line raster
  const lineC = makeCanvas(rw, rh);
  const lc = lineC.getContext('2d', {willReadFrequently: true})!;
  lc.fillStyle = 'rgb(0,0,0)';
  lc.fillRect(0, 0, rw, rh);
  lc.strokeStyle = 'rgb(255,255,255)';
  lc.lineJoin = 'round';
  lc.lineCap = 'round';
  for (const p of sil.lines) {
    lc.setTransform(rscale, 0, 0, rscale, 0, 0);
    applyXform(lc, p);
    lc.lineWidth = sil.creaseW;
    lc.stroke(new Path2D(p.d));
  }
  lc.setTransform(1, 0, 0, 1, 0, 0);
  const lineData = lc.getImageData(0, 0, rw, rh).data;
  const lines = new Uint8Array(rw * rh);
  for (let i = 0; i < lines.length; i++) lines[i] = lineData[i * 4] > 100 ? 1 : 0;

  // 3. distance field
  const dist = chamfer(lines, rw, rh);

  // 4. path-space -> stage transform (contain-fit on the content region)
  const [fx, fy, fw, fh] = sil.fit ?? [0, 0, vw, vh];
  const scale = Math.min(stage.w / fw, stage.h / fh);
  const ox = stage.x + (stage.w - fw * scale) / 2 - fx * scale;
  const oy = stage.y + (stage.h - fh * scale) / 2 - fy * scale;

  return {rw, rh, inside, dist, scale, ox, oy, rscale};
};

export type ParticleSet = {
  n: number;
  x: Float32Array;
  y: Float32Array;
  size: Float32Array;
  bright: Float32Array;
  hot: Float32Array; // 0 = palette colour, 1 = white-hot
  twP: Float32Array;
  twPh: Float32Array;
  sx: Float32Array;
  sy: Float32Array;
  axis: Float32Array; // 0..1 along the variant's sweep axis
  px: Float32Array; // path-space x (used by the propagate graph)
  py: Float32Array;
};

/** Twinkle periods, all exact divisors of 600 so the loop closes. */
const TW_PERIODS = [40, 50, 60, 75, 100, 120, 150];

export const sampleParticles = (
  sil: Silhouette,
  rule: DensityRule,
  field: Field,
  seed: string,
): ParticleSet => {
  const {rw, rh, inside, dist, scale, ox, oy, rscale} = field;

  // bounds of the filled mask, in raster px
  let x0 = rw;
  let y0 = rh;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < rh; y++)
    for (let x = 0; x < rw; x++)
      if (inside[y * rw + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const bw = Math.max(1, x1 - x0);
  const bh = Math.max(1, y1 - y0);

  const [lx, ly] = sil.light;
  const llen = Math.hypot(lx, ly) || 1;
  const [ax, ay] = sil.axis;
  const alen = Math.hypot(ax, ay) || 1;

  // clusters in raster space
  const cl = sil.clusters.map((c: {x: number; y: number; r: number; boost: number}) => ({
    x: c.x * rscale,
    y: c.y * rscale,
    r: c.r * rscale,
    boost: c.boost,
  }));

  const target = rule.target;
  const grid = rule.grid;
  const taken = new Set<number>();
  const gx: number[] = [];
  const gy: number[] = [];
  const gb: number[] = [];
  const gd: number[] = [];

  const maxTries = target * 90;
  let i = 0;
  while (gx.length < target && i < maxTries) {
    const s = `${seed}/p${i}`;
    i++;
    const rx = x0 + random(`${s}x`) * bw;
    const ry = y0 + random(`${s}y`) * bh;
    const ix = Math.round(rx);
    const iy = Math.round(ry);
    if (ix < 0 || iy < 0 || ix >= rw || iy >= rh) continue;
    const idx = iy * rw + ix;
    if (!inside[idx]) continue;

    const d = dist[idx];
    let p = rule.flat + (1 - rule.flat) * Math.exp(-d / rule.falloff);

    // bright clusters pull in extra density
    let clusterBoost = 0;
    for (const c of cl) {
      const cd = Math.hypot(rx - c.x, ry - c.y);
      if (cd < c.r) {
        const t = 1 - cd / c.r;
        clusterBoost = Math.max(clusterBoost, t * c.boost);
      }
    }
    p = Math.min(1, p + clusterBoost * 0.85);

    if (random(`${s}a`) > p) continue;

    // snap to the coarse grid so particles align into faint rows
    const fx = ox + (rx / rscale) * scale;
    const fy = oy + (ry / rscale) * scale;
    const cx = Math.round(fx / grid);
    const cy = Math.round(fy / grid);
    const key = cy * 100000 + cx;
    if (taken.has(key)) continue;
    taken.add(key);

    gx.push(cx * grid);
    gy.push(cy * grid);
    gd.push(d);
    gb.push(clusterBoost);
  }

  const n = gx.length;
  const out: ParticleSet = {
    n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    size: new Float32Array(n),
    bright: new Float32Array(n),
    hot: new Float32Array(n),
    twP: new Float32Array(n),
    twPh: new Float32Array(n),
    sx: new Float32Array(n),
    sy: new Float32Array(n),
    axis: new Float32Array(n),
    px: new Float32Array(n),
    py: new Float32Array(n),
  };

  const cxm = ox + ((x0 + bw / 2) / rscale) * scale;
  const cym = oy + ((y0 + bh / 2) / rscale) * scale;
  const projSpan = (Math.abs(ax) * bw + Math.abs(ay) * bh) / alen / rscale * scale;

  for (let k = 0; k < n; k++) {
    const s = `${seed}/a${k}`;
    const X = gx[k];
    const Y = gy[k];
    out.x[k] = X;
    out.y[k] = Y;
    out.px[k] = (X - ox) / scale;
    out.py[k] = (Y - oy) / scale;

    // edge proximity -> brightness; flat interior particles sit back
    const edge = Math.exp(-gd[k] / (rule.falloff * 1.35));

    // lateral brightness gradient supplies the sense of volume
    const g =
      ((X - cxm) * lx + (Y - cym) * ly) / llen / (Math.max(bw, bh) / rscale * scale);
    const grad = rule.gradLo + (rule.gradHi - rule.gradLo) * (0.5 + g);

    const jitter = 0.78 + random(`${s}j`) * 0.34;
    out.bright[k] = Math.min(
      1,
      (0.22 + 0.62 * edge + 0.9 * gb[k]) * Math.max(0.12, grad) * jitter,
    );
    out.hot[k] =
      random(`${s}h`) < 0.1 + 0.42 * edge + 0.5 * gb[k] ? 1 : 0;

    const sz = rule.sizeMin + random(`${s}s`) * (rule.sizeMax - rule.sizeMin);
    out.size[k] = Math.max(2, Math.round(sz));

    out.twP[k] = TW_PERIODS[Math.floor(random(`${s}t`) * TW_PERIODS.length)];
    out.twPh[k] = random(`${s}p`) * Math.PI * 2;

    // assembly scatter origin: a wide ring around the subject centre
    const ang = random(`${s}a1`) * Math.PI * 2;
    const rad = 480 + random(`${s}a2`) * 1250;
    out.sx[k] = cxm + Math.cos(ang) * rad * 1.35;
    out.sy[k] = cym + Math.sin(ang) * rad * 0.72;

    const proj = ((X - cxm) * ax + (Y - cym) * ay) / alen;
    out.axis[k] = Math.max(0, Math.min(1, 0.5 + proj / (projSpan || 1)));
  }

  return out;
};
