import {clamp, fbm3, smoothstep, TAU} from '../lib/noise';
import {mulberry32, range} from '../lib/rng';
import type {Variant} from './config';

/**
 * Every layer in this file is static for the whole clip (star twinkle is the
 * one exception and is drawn per frame), so each is rasterised once per page
 * into a cached canvas. The cache is keyed purely by variant + size, so it is
 * a pure function of the inputs — safe with Remotion rendering frames out of
 * order across threads.
 */
const cache = new Map<string, HTMLCanvasElement>();

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

const ctxOf = (c: HTMLCanvasElement) => {
  const ctx = c.getContext('2d', {alpha: true});
  if (!ctx) throw new Error('2d context unavailable');
  return ctx;
};

const cached = (
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) => {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = makeCanvas(w, h);
  draw(ctxOf(c));
  cache.set(key, c);
  return c;
};

// ---------------------------------------------------------------------------
// Milky Way band geometry — shared by the band itself and by star density.
// Coordinates are in units of frame *width* so the band keeps its angle at
// any aspect handed to it.
// ---------------------------------------------------------------------------

const P0X = 0.4;
const P0Y = -0.04;
const P1X = 1.06;
const P1Y = 0.31;
const DX = P1X - P0X;
const DY = P1Y - P0Y;
const DLEN2 = DX * DX + DY * DY;
const DLEN = Math.sqrt(DLEN2);

/** Rough 0..1 membership of the Milky Way band, used to bias star density. */
export const bandIntensity = (ux: number, uy: number, seed: number) => {
  const rx = ux - P0X;
  const ry = uy - P0Y;
  const s = (rx * DX + ry * DY) / DLEN2;
  const dist = Math.abs(rx * DY - ry * DX) / DLEN;
  // Irregular edges: the half-width wanders along the band.
  const wobble = fbm3(s * 3.1, 0, 0, seed + 41, 3) - 0.5;
  const halfWidth = 0.125 * (1 + wobble * 0.85);
  const across = 1 - smoothstep(halfWidth * 0.28, halfWidth, dist);
  const along = smoothstep(-0.12, 0.16, s) * (1 - smoothstep(0.82, 1.22, s));
  return across * along;
};

// ---------------------------------------------------------------------------
// Sky gradient + Milky Way + starfield, flattened into one static plate.
// ---------------------------------------------------------------------------

export type Star = {
  x: number;
  y: number;
  r: number;
  b: number;
  color: string;
  cross: boolean;
  /** Integer cycles over the loop, 0 for the static majority. */
  twinkleN: number;
  twinklePh: number;
};

const STAR_COLORS = ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#cfe0ff', '#bcd2ff', '#ffd9a8', '#ffc98a'];

const starCacheList = new Map<string, Star[]>();

export const getStars = (v: Variant, w: number, h: number): Star[] => {
  const key = `stars-${v.id}-${w}x${h}`;
  const hit = starCacheList.get(key);
  if (hit) return hit;

  const rng = mulberry32(v.seed + 991);
  const px = w / 3840; // 1 reference pixel at 4K, in real pixels
  // Landscape variants have no visible sky below the horizon.
  const yMax = v.landscape ? v.horizonY : 1.0;
  const stars: Star[] = [];
  let guard = 0;
  while (stars.length < v.starCount && guard < v.starCount * 40) {
    guard++;
    const x = rng();
    const y = rng() * yMax;
    const band = bandIntensity(x, (y * h) / w, v.seed);
    // Denser inside the band, but never empty outside it.
    if (rng() > 0.5 + 0.5 * band) continue;

    // Brightness heavily weighted toward faint: a handful carry the sky.
    const u = rng();
    const b = Math.pow(u, 3.1);
    const r = (0.5 + b * 1.35 + (rng() < 0.06 ? 0.6 : 0)) * px;
    const twinkles = rng() < 0.09;
    stars.push({
      x,
      y,
      r,
      b: 0.14 + b * 0.86,
      color: STAR_COLORS[Math.floor(rng() * STAR_COLORS.length)],
      cross: false,
      twinkleN: twinkles ? Math.round(range(rng, 1, 4)) : 0,
      twinklePh: rng(),
    });
  }

  // A few anchor stars with a small 4-point diffraction cross.
  const brightest = [...stars].sort((a, b) => b.b - a.b).slice(0, 3);
  for (const s of brightest) {
    s.cross = true;
    s.b = 1;
    s.r = Math.max(s.r, 2.6 * px);
    s.twinkleN = 0;
  }

  starCacheList.set(key, stars);
  return stars;
};

const drawStar = (
  ctx: CanvasRenderingContext2D,
  s: Star,
  w: number,
  h: number,
  gain: number,
) => {
  const x = s.x * w;
  const y = s.y * h;
  const b = s.b * gain;
  if (b <= 0.002) return;

  // Soft halo + hard core reads as a point source without looking like a dot.
  const halo = ctx.createRadialGradient(x, y, 0, x, y, s.r * 3.4);
  halo.addColorStop(0, s.color);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = b * 0.5;
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, s.r * 3.4, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = b;
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.arc(x, y, s.r, 0, TAU);
  ctx.fill();

  if (s.cross) {
    const len = s.r * 13;
    ctx.globalAlpha = b * 0.42;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, s.r * 0.42);
    ctx.beginPath();
    ctx.moveTo(x - len, y);
    ctx.lineTo(x + len, y);
    ctx.moveTo(x, y - len);
    ctx.lineTo(x, y + len);
    ctx.stroke();
  }
};

export const drawTwinklers = (
  ctx: CanvasRenderingContext2D,
  v: Variant,
  w: number,
  h: number,
  t: number,
) => {
  const stars = getStars(v, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    if (s.twinkleN === 0) continue;
    const phase = Math.sin(TAU * (s.twinkleN * t + s.twinklePh));
    drawStar(ctx, s, w, h, 0.55 + 0.45 * phase);
  }
  ctx.restore();
};

/** Sky gradient, large-scale mottling, Milky Way and the non-twinkling stars. */
export const getSkyPlate = (v: Variant, w: number, h: number) =>
  cached(`sky-${v.id}-${w}x${h}`, w, h, (ctx) => {
    // 1. Vertical gradient.
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#080e28');
    g.addColorStop(0.18, '#0a1230');
    g.addColorStop(0.52, '#16305c');
    g.addColorStop(0.8, '#22384f');
    g.addColorStop(1, '#2a3a4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 2. Very subtle low-frequency mottling so the ramp is not clinically clean.
    const mw = 200;
    const mh = Math.max(2, Math.round((mw * h) / w));
    const mot = makeCanvas(mw, mh);
    const mctx = ctxOf(mot);
    const img = mctx.createImageData(mw, mh);
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const n = fbm3((x / mw) * 3.0, (y / mh) * 2.0, 0.5, v.seed + 17, 3);
        const i = (y * mw + x) * 4;
        img.data[i] = 120;
        img.data[i + 1] = 140;
        img.data[i + 2] = 190;
        img.data[i + 3] = Math.round(clamp((n - 0.42) * 2.2, 0, 1) * 40);
      }
    }
    mctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mot, 0, 0, w, h);
    ctx.restore();

    // 3. Milky Way: stretched layered noise with dust lanes cut through it.
    const bw = Math.min(1280, w);
    const bh = Math.max(2, Math.round((bw * h) / w));
    const band = makeCanvas(bw, bh);
    const bctx = ctxOf(band);
    const bimg = bctx.createImageData(bw, bh);
    for (let y = 0; y < bh; y++) {
      const uy = (y / bh) * (h / w);
      for (let x = 0; x < bw; x++) {
        const ux = x / bw;
        const m = bandIntensity(ux, uy, v.seed);
        if (m <= 0.001) continue;

        // Stretched along the band axis: high frequency across, low along.
        const along = (ux * DX + uy * DY) / DLEN2;
        const across = (ux * DY - uy * DX) / DLEN;
        const cloud = fbm3(along * 5.5, across * 26, 3.2, v.seed + 63, 5);
        const fine = fbm3(along * 13, across * 61, 8.1, v.seed + 64, 3);
        // Dust lanes: dark filaments carved out of the bright cores.
        const lane = fbm3(along * 4.1, across * 17, 19.7, v.seed + 65, 4);
        const dust = smoothstep(0.4, 0.56, lane);

        let val = m * (0.35 + 0.95 * cloud) * (0.7 + 0.6 * fine);
        val *= 1 - dust * 0.72;
        val = clamp(val, 0, 1);
        const a = Math.pow(val, 1.35);
        if (a <= 0.004) continue;

        // Faint violet-pink cast where the band is brightest.
        const warm = smoothstep(0.45, 0.95, val);
        const i = (y * bw + x) * 4;
        bimg.data[i] = Math.round(178 + warm * 62);
        bimg.data[i + 1] = Math.round(184 + warm * 6);
        bimg.data[i + 2] = Math.round(214 + warm * 26);
        bimg.data[i + 3] = Math.round(a * 168);
      }
    }
    bctx.putImageData(bimg, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.62;
    ctx.imageSmoothingQuality = 'high';
    ctx.filter = `blur(${(w / bw) * 0.6}px)`;
    ctx.drawImage(band, 0, 0, w, h);
    ctx.restore();

    // 4. Static stars.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const stars = getStars(v, w, h);
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      if (s.twinkleN !== 0) continue;
      drawStar(ctx, s, w, h, 1);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  });

// ---------------------------------------------------------------------------
// Horizon glow (additive) — V1 / V2 only.
// ---------------------------------------------------------------------------

export const getHorizonGlow = (v: Variant, w: number, h: number) =>
  cached(`glow-${v.id}-${w}x${h}`, w, h, (ctx) => {
    const hy = v.horizonY * h;
    const rise = h * 0.155;

    const g = ctx.createLinearGradient(0, hy, 0, hy - rise);
    g.addColorStop(0.0, 'rgba(245,166,35,0.95)');
    g.addColorStop(0.12, 'rgba(238,150,40,0.72)');
    g.addColorStop(0.3, 'rgba(217,79,26,0.34)');
    g.addColorStop(0.38, 'rgba(200,72,30,0.24)');
    g.addColorStop(0.62, 'rgba(120,70,60,0.09)');
    g.addColorStop(1, 'rgba(60,50,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, hy - rise, w, rise + h * 0.02);

    // Brightest around centre-right, where the ridgeline dips.
    const cx = w * 0.66;
    const r = ctx.createRadialGradient(cx, hy, 0, cx, hy, w * 0.42);
    r.addColorStop(0, 'rgba(255,196,90,0.55)');
    r.addColorStop(0.35, 'rgba(240,140,50,0.22)');
    r.addColorStop(1, 'rgba(200,90,40,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Fill the whole frame: the gradient already fades to zero well before
    // its edge, and clipping it to a band leaves a hard horizontal seam.
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  });

// ---------------------------------------------------------------------------
// Ridgeline — a pure black cutout, no interior detail.
// ---------------------------------------------------------------------------

const ridgeProfile = (v: Variant, w: number, h: number) => {
  const hy = v.horizonY * h;
  const pts: {x: number; y: number}[] = [];
  const step = Math.max(1, w / 900);
  // A few hand-placed features on top of the noise: two jagged spires and a
  // higher mass at the right edge.
  const spires = [
    {x: 0.215, amp: 0.062, wid: 0.016},
    {x: 0.245, amp: 0.038, wid: 0.011},
    {x: 0.505, amp: 0.048, wid: 0.014},
  ];
  for (let x = -step; x <= w + step; x += step) {
    const nx = x / w;
    const hills =
      (fbm3(nx * 3.4, 0.7, 0.3, v.seed + 301, 4) - 0.5) * 0.052 +
      (fbm3(nx * 9.1, 2.3, 1.1, v.seed + 302, 3) - 0.5) * 0.016;
    let y = hy - h * (0.026 + hills);
    for (const s of spires) {
      const d = (nx - s.x) / s.wid;
      y -= h * s.amp * Math.exp(-d * d) * (1 - 0.35 * Math.abs(Math.sin(d * 5)));
    }
    // Rising mass toward the right edge.
    y -= h * 0.058 * smoothstep(0.72, 1.0, nx);
    pts.push({x, y});
  }
  return pts;
};

const ridgeYAt = (pts: {x: number; y: number}[], x: number) => {
  let best = pts[0];
  for (const p of pts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
  return best.y;
};

export const getRidge = (v: Variant, w: number, h: number) =>
  cached(`ridge-${v.id}-${w}x${h}`, w, h, (ctx) => {
    const pts = ridgeProfile(v, w, h);
    ctx.beginPath();
    ctx.moveTo(-w, h + 10);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(w * 2, h + 10);
    ctx.closePath();
    ctx.fillStyle = '#000000';
    ctx.fill();

    // One tiny warm pinpoint light out on the plain.
    const lx = w * 0.372;
    const ly = ridgeYAt(pts, lx) - h * 0.004;
    const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, w * 0.012);
    glow.addColorStop(0, 'rgba(255,196,120,0.95)');
    glow.addColorStop(0.18, 'rgba(255,164,80,0.35)');
    glow.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lx, ly, w * 0.012, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,224,180,1)';
    ctx.beginPath();
    ctx.arc(lx, ly, Math.max(1, w * 0.0008), 0, TAU);
    ctx.fill();
    ctx.restore();
  });

// ---------------------------------------------------------------------------
// Grain + corner falloff.
// ---------------------------------------------------------------------------

const GRAIN_TILE = 512;
const GRAIN_VARIANTS = 4;

const getGrainTile = (i: number) =>
  cached(`grain-${i}`, GRAIN_TILE, GRAIN_TILE, (ctx) => {
    const img = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    const rng = mulberry32(9001 + i * 7717);
    for (let p = 0; p < GRAIN_TILE * GRAIN_TILE; p++) {
      // Box-Muller for gaussian grain; sigma ~13 levels lands at about 2%
      // modulation once blended through `overlay`.
      const u1 = Math.max(1e-6, rng());
      const u2 = rng();
      const gval = Math.sqrt(-2 * Math.log(u1)) * Math.cos(TAU * u2);
      const val = clamp(128 + gval * 13, 0, 255);
      const j = p * 4;
      img.data[j] = val;
      img.data[j + 1] = val;
      img.data[j + 2] = val;
      img.data[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });

/**
 * A flat uniform-noise tile used purely as a dither. `overlay` grain scales
 * with the underlying value and so does nothing in the darkest parts of the
 * sky — exactly where the faint aurora sheets accumulate into one or two code
 * values and contour. This pass adds a sub-level of uniform noise there,
 * which breaks the contour and also gives H.264 something to hold onto.
 */
const getDitherTile = (i: number) =>
  cached(`dither-${i}`, GRAIN_TILE, GRAIN_TILE, (ctx) => {
    const img = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    const rng = mulberry32(4242 + i * 5233);
    for (let p = 0; p < GRAIN_TILE * GRAIN_TILE; p++) {
      const val = Math.floor(rng() * 256);
      const j = p * 4;
      img.data[j] = val;
      img.data[j + 1] = val;
      img.data[j + 2] = val;
      img.data[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });

export const drawDither = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
) => {
  const tile = getDitherTile(frame % GRAIN_VARIANTS);
  const pat = ctx.createPattern(tile, 'repeat');
  if (!pat) return;
  const ox = (frame * 211) % GRAIN_TILE;
  const oy = (frame * 97) % GRAIN_TILE;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.015;
  ctx.translate(ox, oy);
  ctx.fillStyle = pat;
  ctx.fillRect(-ox, -oy, w + GRAIN_TILE, h + GRAIN_TILE);
  ctx.restore();
};

export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
) => {
  const tile = getGrainTile(frame % GRAIN_VARIANTS);
  const pat = ctx.createPattern(tile, 'repeat');
  if (!pat) return;
  // Offsets cycle with the tile set, so the grain loops with the clip.
  const ox = (frame * 137) % GRAIN_TILE;
  const oy = (frame * 191) % GRAIN_TILE;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.5;
  ctx.translate(ox, oy);
  ctx.fillStyle = pat;
  ctx.fillRect(-ox, -oy, w + GRAIN_TILE, h + GRAIN_TILE);
  ctx.restore();
};

export const drawCornerFalloff = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) => {
  const g = ctx.createRadialGradient(
    w / 2,
    h * 0.46,
    Math.min(w, h) * 0.32,
    w / 2,
    h * 0.46,
    Math.max(w, h) * 0.78,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
};
