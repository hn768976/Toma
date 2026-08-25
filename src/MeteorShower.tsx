import React, {useEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';

// ── Constants ────────────────────────────────────────────────────────────────
const W = 3840;
const H = 2160;
const LOOP = 1020; // frames @ 60fps = 17.0s, seamless
const TAU = Math.PI * 2;

// Static layers are baked with a margin so the ±25px camera drift never
// reveals a layer edge.
const MARGIN = 48;
const SW = W + MARGIN * 2;
const SH = H + MARGIN * 2;

// Nebula geometry (scene-layer coordinates, i.e. margin included).
// A huge spherical dust cloud that nearly fills the frame — its faintly
// brighter round rim arcs across the upper portion of the picture.
const NEB_CX = MARGIN + W * 0.56;
const NEB_CY = MARGIN + H * 0.98;
const NEB_R = W * 0.5;

const GRAIN_TILE = 384;
const GRAIN_TILES = 8;

// Palette
const DEEP_SPACE = '#04060A';
const AMBER: [number, number, number] = [107, 88, 56]; // #6B5838
const RIM: [number, number, number] = [138, 116, 72]; // #8A7448
const TEAL: [number, number, number] = [62, 138, 150]; // #3E8A96
const TEAL_DEEP: [number, number, number] = [26, 74, 85]; // #1A4A55
const STAR_WHITE: [number, number, number] = [232, 238, 245]; // #E8EEF5
const STAR_WARM: [number, number, number] = [245, 231, 205];
const STAR_BLUE: [number, number, number] = [201, 220, 250];
const DUST_GREY: [number, number, number] = [86, 88, 76]; // ambient olive-grey dust
const TEAL_BRIGHT: [number, number, number] = [128, 194, 205]; // edge-glow core

// ── Helpers ──────────────────────────────────────────────────────────────────
const rgba = (c: [number, number, number], a: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) {
    throw new Error('2d context unavailable');
  }
  return {c, ctx};
};

// Deterministic per-pixel PRNG for grain tiles. Seeded exclusively from
// Remotion's random() so renders stay reproducible; Math.random is never used.
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ── Static scene data ────────────────────────────────────────────────────────
type Star = {
  x: number;
  y: number;
  size: number;
  color: [number, number, number];
  baseA: number;
  amp: number; // twinkle amplitude (small)
  k: number; // integer sine cycles per loop → closes at frame 1020
  ph: number;
};

type Meteor = {
  launch: number; // frame within [0, LOOP)
  dur: number; // frames alive
  dirx: number;
  diry: number;
  speed: number; // px per frame
  x0: number;
  y0: number;
  tail: number; // px
  width: number; // px at the head
  bright: number; // 0..1
};

type Statics = {
  nebA: HTMLCanvasElement;
  nebB: HTMLCanvasElement;
  teal: HTMLCanvasElement;
  starBase: HTMLCanvasElement;
  vignette: HTMLCanvasElement;
  grain: CanvasPattern[];
  stars: Star[];
  meteors: Meteor[];
};

// Nebula blobs are baked at half resolution — the final heavy blur erases any
// difference, and it quarters the one-time bake cost.
const NEB_SCALE = 0.5;

const paintBlob = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: [number, number, number],
  alpha: number,
  stretch = 1,
  rot = 0
) => {
  ctx.save();
  ctx.translate(x * NEB_SCALE, y * NEB_SCALE);
  ctx.rotate(rot);
  ctx.scale(stretch, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * NEB_SCALE);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.55, rgba(color, alpha * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * NEB_SCALE, 0, TAU);
  ctx.fill();
  ctx.restore();
};

const buildNebulaLayers = (): {nebA: HTMLCanvasElement; nebB: HTMLCanvasElement} => {
  const hw = Math.round(SW * NEB_SCALE);
  const hh = Math.round(SH * NEB_SCALE);
  const layers = [makeCanvas(hw, hh), makeCanvas(hw, hh)];
  layers.forEach(({ctx}) => {
    ctx.globalCompositeOperation = 'lighter';
  });

  // The sphere's centre sits near the bottom edge, so the visible interior is
  // its upper half: angles 180°..360° in canvas coords point up from centre.
  const upAngle = (r: number) => Math.PI + r * Math.PI;

  // The sphere reads as a FILLED disc of dust, not a ring: paint a broad,
  // nearly flat haze across the whole circle on both layers (they add).
  for (let li = 0; li < 2; li++) {
    const {ctx} = layers[li];
    const g = ctx.createRadialGradient(
      NEB_CX * NEB_SCALE,
      NEB_CY * NEB_SCALE,
      0,
      NEB_CX * NEB_SCALE,
      NEB_CY * NEB_SCALE,
      NEB_R * NEB_SCALE
    );
    g.addColorStop(0, rgba(AMBER, 0.034));
    g.addColorStop(0.65, rgba(AMBER, 0.032));
    g.addColorStop(0.93, rgba(AMBER, 0.025));
    g.addColorStop(1, rgba(AMBER, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(NEB_CX * NEB_SCALE, NEB_CY * NEB_SCALE, NEB_R * NEB_SCALE, 0, TAU);
    ctx.fill();
  }

  // Broad base blobs: uneven density over the filled haze.
  for (let i = 0; i < 18; i++) {
    const a = upAngle(random(`neb-base-${i}-a`));
    const d = NEB_R * (0.12 + 0.76 * Math.pow(random(`neb-base-${i}-d`), 0.7));
    const x = NEB_CX + Math.cos(a) * d;
    const y = NEB_CY + Math.sin(a) * d;
    const r = NEB_R * (0.18 + 0.22 * random(`neb-base-${i}-r`));
    const al = 0.028 + 0.028 * random(`neb-base-${i}-al`);
    paintBlob(layers[i % 2].ctx, x, y, r, AMBER, al);
  }

  // Fine mottled dust: seeded value-noise octaves upscaled over the disc.
  // This granular cloudiness — not discrete blobs — is what makes the
  // interior read as filled dust.
  const noiseOctave = (
    seed: string,
    cols: number,
    rows: number,
    color: [number, number, number]
  ) => {
    const {c: nc, ctx: nctx} = makeCanvas(cols, rows);
    const img = nctx.createImageData(cols, rows);
    const prng = mulberry32(Math.floor(random(seed) * 0xffffffff));
    for (let i = 0; i < cols * rows; i++) {
      img.data[i * 4] = color[0];
      img.data[i * 4 + 1] = color[1];
      img.data[i * 4 + 2] = color[2];
      img.data[i * 4 + 3] = Math.floor(255 * Math.pow(prng(), 3));
    }
    nctx.putImageData(img, 0, 0);
    // Mask to the disc, fading out toward the rim.
    const {c: mc, ctx: mctx} = makeCanvas(hw, hh);
    mctx.drawImage(nc, 0, 0, hw, hh);
    mctx.globalCompositeOperation = 'destination-in';
    const mg = mctx.createRadialGradient(
      NEB_CX * NEB_SCALE,
      NEB_CY * NEB_SCALE,
      0,
      NEB_CX * NEB_SCALE,
      NEB_CY * NEB_SCALE,
      NEB_R * NEB_SCALE
    );
    mg.addColorStop(0, 'rgba(0,0,0,1)');
    mg.addColorStop(0.7, 'rgba(0,0,0,0.9)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    mctx.fillStyle = mg;
    mctx.fillRect(0, 0, hw, hh);
    return mc;
  };
  for (let li = 0; li < 2; li++) {
    const {ctx} = layers[li];
    const octaves: [HTMLCanvasElement, number][] = [
      [noiseOctave(`neb-noise-${li}-0`, 20, 12, AMBER), 0.1],
      [noiseOctave(`neb-noise-${li}-1`, 64, 36, li === 0 ? AMBER : DUST_GREY), 0.085],
      [noiseOctave(`neb-noise-${li}-2`, 192, 108, DUST_GREY), 0.065],
    ];
    for (const [oc, strength] of octaves) {
      ctx.save();
      ctx.globalAlpha = strength;
      ctx.drawImage(oc, 0, 0);
      ctx.restore();
    }
  }

  // Ambient mottling outside the sphere so no part of the frame is flat black.
  for (let i = 0; i < 14; i++) {
    const x = random(`neb-amb-${i}-x`) * SW;
    const y = random(`neb-amb-${i}-y`) * SH;
    const r = NEB_R * (0.12 + 0.2 * random(`neb-amb-${i}-r`));
    const al = 0.025 + 0.03 * random(`neb-amb-${i}-al`);
    paintBlob(layers[i % 2].ctx, x, y, r, i % 3 === 0 ? AMBER : DUST_GREY, al);
  }

  // Rim: the faintly brighter round edge where the dust thins, arcing across
  // the upper frame. A heavily blurred soft ring plus irregular blobs so it
  // never reads as a drawn stroke.
  for (let li = 0; li < 2; li++) {
    const {ctx} = layers[li];
    ctx.save();
    ctx.strokeStyle = rgba(RIM, 0.022);
    ctx.lineWidth = NEB_R * (0.11 + 0.04 * li) * NEB_SCALE;
    ctx.beginPath();
    ctx.arc(
      NEB_CX * NEB_SCALE,
      NEB_CY * NEB_SCALE,
      NEB_R * (0.955 + 0.02 * li) * NEB_SCALE,
      Math.PI,
      TAU
    );
    ctx.stroke();
    ctx.restore();
  }
  for (let i = 0; i < 16; i++) {
    const a = (190 + 150 * random(`neb-rim-${i}-a`)) * (Math.PI / 180);
    const d = NEB_R * (0.88 + 0.13 * random(`neb-rim-${i}-d`));
    const x = NEB_CX + Math.cos(a) * d;
    const y = NEB_CY + Math.sin(a) * d;
    const r = NEB_R * (0.05 + 0.07 * random(`neb-rim-${i}-r`));
    const al = 0.022 + 0.03 * random(`neb-rim-${i}-al`);
    paintBlob(layers[i % 2].ctx, x, y, r, RIM, al);
  }

  // A few brighter elongated filaments.
  for (let i = 0; i < 6; i++) {
    const a = upAngle(random(`neb-fil-${i}-a`));
    const d = NEB_R * 0.65 * random(`neb-fil-${i}-d`);
    const x = NEB_CX + Math.cos(a) * d;
    const y = NEB_CY + Math.sin(a) * d;
    const r = NEB_R * (0.05 + 0.06 * random(`neb-fil-${i}-r`));
    const stretch = 2.4 + 1.6 * random(`neb-fil-${i}-s`);
    const rot = random(`neb-fil-${i}-rot`) * TAU;
    paintBlob(layers[i % 2].ctx, x, y, r, RIM, 0.055, stretch, rot);
  }

  // Darker voids punched into the dust.
  for (let i = 0; i < 5; i++) {
    const {ctx} = layers[i % 2];
    const a = upAngle(random(`neb-void-${i}-a`));
    const d = NEB_R * 0.7 * random(`neb-void-${i}-d`);
    const x = (NEB_CX + Math.cos(a) * d) * NEB_SCALE;
    const y = (NEB_CY + Math.sin(a) * d) * NEB_SCALE;
    const r = NEB_R * (0.13 + 0.12 * random(`neb-void-${i}-r`)) * NEB_SCALE;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Directional shading: the side away from the teal light — the lower-left —
  // is a little darker. Erase the dust proportionally toward that corner.
  for (let li = 0; li < 2; li++) {
    const {ctx} = layers[li];
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const sh = ctx.createLinearGradient(0, hh, hw * 0.85, hh * 0.1);
    sh.addColorStop(0, 'rgba(0,0,0,0.5)');
    sh.addColorStop(0.45, 'rgba(0,0,0,0.22)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, 0, hw, hh);
    ctx.restore();
  }

  // Final blur softens every edge while keeping the fine dust mottling
  // (14px at half res ≈ 28px at 4K). Blit back to full scene size.
  const finish = (src: HTMLCanvasElement) => {
    const {c, ctx} = makeCanvas(SW, SH);
    ctx.filter = 'blur(14px)';
    ctx.drawImage(src, 0, 0, SW, SH);
    ctx.filter = 'none';
    return c;
  };

  return {nebA: finish(layers[0].c), nebB: finish(layers[1].c)};
};

const buildTealLayer = (): HTMLCanvasElement => {
  const hw = Math.round(SW * NEB_SCALE);
  const hh = Math.round(SH * NEB_SCALE);
  const half = makeCanvas(hw, hh);
  const ctx = half.ctx;
  ctx.globalCompositeOperation = 'lighter';

  const glow = (
    x: number,
    y: number,
    r: number,
    color: [number, number, number],
    alpha: number,
    mid: [number, number, number] = TEAL_DEEP
  ) => {
    const g = ctx.createRadialGradient(
      x * NEB_SCALE,
      y * NEB_SCALE,
      0,
      x * NEB_SCALE,
      y * NEB_SCALE,
      r * NEB_SCALE
    );
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(0.45, rgba(mid, alpha * 0.5));
    g.addColorStop(1, rgba(mid, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, hw, hh);
  };

  // Off-screen light source past the right edge: a broad wash brightest at
  // the upper-right, with a bright cyan core hugging the edge itself.
  glow(SW + 300, SH * 0.1, 3300, TEAL, 0.5);
  glow(SW + 120, SH * 0.04, 1700, TEAL_BRIGHT, 0.42);
  // A soft vertical band so the whole right edge reads lit.
  const band = ctx.createLinearGradient(hw, 0, hw - 720 * NEB_SCALE, 0);
  band.addColorStop(0, rgba(TEAL, 0.3));
  band.addColorStop(0.5, rgba(TEAL_DEEP, 0.12));
  band.addColorStop(1, rgba(TEAL_DEEP, 0));
  ctx.fillStyle = band;
  ctx.fillRect(hw - 720 * NEB_SCALE, 0, 720 * NEB_SCALE, hh);
  // Much fainter answering wash at the very bottom-left.
  glow(-160, SH + 160, 1500, TEAL, 0.12);

  const {c, ctx: fctx} = makeCanvas(SW, SH);
  fctx.filter = 'blur(20px)';
  fctx.drawImage(half.c, 0, 0, SW, SH);
  fctx.filter = 'none';
  return c;
};

const buildStars = (): Star[] => {
  const stars: Star[] = [];

  const tryAdd = (seed: string, x: number, y: number) => {
    const d = Math.hypot(x - NEB_CX, y - NEB_CY);
    let dim = 1;
    if (d < NEB_R) {
      // Dust obscures stars: keep fewer over the dense interior, and dim
      // the survivors. This is what sells the nebula as volumetric.
      // The sphere now covers most of the frame, so the dust only thins the
      // stars rather than wiping them out.
      const rel = d / NEB_R;
      const keep = 0.55 + 0.35 * rel * rel;
      if (random(`${seed}-keep`) > keep) {
        return;
      }
      dim = 0.78 + 0.22 * rel;
    }

    const size = 1.5 + 3.5 * Math.pow(random(`${seed}-size`), 3);
    let baseA = (0.18 + 0.24 * Math.pow(random(`${seed}-a`), 1.5)) * dim;
    let sz = size;
    if (random(`${seed}-bright`) < 0.055) {
      baseA = (0.6 + 0.32 * random(`${seed}-ba`)) * dim;
      sz = Math.min(5, size + 1.4);
    }

    const cr = random(`${seed}-col`);
    const color = cr < 0.84 ? STAR_WHITE : cr < 0.92 ? STAR_WARM : STAR_BLUE;

    const amp = baseA * (0.08 + 0.09 * random(`${seed}-amp`));
    const k = 2 + Math.floor(random(`${seed}-k`) * 6); // 2..7 cycles/loop
    const ph = random(`${seed}-ph`) * TAU;
    stars.push({x, y, size: sz, color, baseA, amp, k, ph});
  };

  for (let i = 0; i < 1250; i++) {
    tryAdd(`star-${i}`, random(`star-${i}-x`) * SW, random(`star-${i}-y`) * SH);
  }
  // Extra density in the emptier upper-left.
  for (let i = 0; i < 240; i++) {
    tryAdd(
      `star-ul-${i}`,
      random(`star-ul-${i}-x`) * SW * 0.52,
      random(`star-ul-${i}-y`) * SH * 0.46
    );
  }
  return stars;
};

const buildStarBase = (stars: Star[]): HTMLCanvasElement => {
  const {c, ctx} = makeCanvas(SW, SH);
  ctx.globalCompositeOperation = 'lighter';
  for (const s of stars) {
    const a = Math.max(0, s.baseA - s.amp); // twinkle overlay adds the rest
    // Moderate bloom on the brightest stars only.
    if (s.baseA > 0.62 && s.size > 2.6) {
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 4.5);
      g.addColorStop(0, rgba(s.color, s.baseA * 0.28));
      g.addColorStop(1, rgba(s.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 4.5, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = rgba(s.color, a * 0.3);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size * 0.85, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(s.color, a);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size * 0.5, 0, TAU);
    ctx.fill();
  }
  return c;
};

const buildVignette = (): HTMLCanvasElement => {
  const {c, ctx} = makeCanvas(W, H);
  const corner = Math.hypot(W / 2, H / 2);
  const g = ctx.createRadialGradient(
    W / 2,
    H / 2,
    corner * 0.42,
    W / 2,
    H / 2,
    corner * 1.02
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.2)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  return c;
};

const buildGrain = (ctx: CanvasRenderingContext2D): CanvasPattern[] => {
  const patterns: CanvasPattern[] = [];
  for (let t = 0; t < GRAIN_TILES; t++) {
    const {c, ctx: tctx} = makeCanvas(GRAIN_TILE, GRAIN_TILE);
    const img = tctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    const prng = mulberry32(Math.floor(random(`grain-tile-${t}`) * 0xffffffff));
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(prng() * 256);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
    const p = ctx.createPattern(c, 'repeat');
    if (p) {
      patterns.push(p);
    }
  }
  return patterns;
};

const buildMeteors = (): Meteor[] => {
  // ~64 events, stratified across the loop so 3–6 are visible at any moment
  // without clumping into a meteor "rain".
  const N = 64;
  const slot = LOOP / N;
  const meteors: Meteor[] = [];
  for (let i = 0; i < N; i++) {
    const launch =
      (i * slot + (random(`m-${i}-jit`) - 0.5) * slot * 0.9 + LOOP) % LOOP;
    const dur = 38 + 34 * random(`m-${i}-dur`);
    // Common radiant: 28° below horizontal, ±3° per meteor.
    const ang = ((28 + (random(`m-${i}-ang`) * 6 - 3)) * Math.PI) / 180;
    const speed = 26 + 34 * random(`m-${i}-spd`);
    // Brightness heavily skewed faint; a handful are large and bright.
    const bright = 0.12 + 0.88 * Math.pow(random(`m-${i}-b`), 2.4);
    const tail = 300 + 600 * (0.3 * random(`m-${i}-tl`) + 0.7 * bright);
    const width = 2 + 8 * bright;
    // Start across the upper-left two-thirds, including off-frame, so
    // meteors enter from the top and left edges.
    const x0 = -600 + random(`m-${i}-x0`) * (W * 0.66 + 600);
    const y0 = -400 + random(`m-${i}-y0`) * (H * 0.55 + 400);
    meteors.push({
      launch,
      dur,
      dirx: Math.cos(ang),
      diry: Math.sin(ang),
      speed,
      x0,
      y0,
      tail,
      width,
      bright,
    });
  }
  return meteors;
};

// ── Per-frame drawing ────────────────────────────────────────────────────────
const drawMeteor = (ctx: CanvasRenderingContext2D, m: Meteor, f: number) => {
  const age = (f - m.launch + LOOP) % LOOP;
  if (age >= m.dur) {
    return;
  }
  const p = age / m.dur;
  // Quick fade-in, gentler fade-out: nothing ever pops in or out.
  const env = smooth(p / 0.14) * smooth((1 - p) / 0.28);
  const a = m.bright * env;
  if (a < 0.004) {
    return;
  }

  const hx = m.x0 + m.dirx * m.speed * age;
  const hy = m.y0 + m.diry * m.speed * age;
  const tx = hx - m.dirx * m.tail;
  const ty = hy - m.diry * m.tail;
  // Cull meteors entirely outside the frame.
  const pad = m.tail + 100;
  if (
    Math.max(hx, tx) < -pad ||
    Math.min(hx, tx) > W + pad ||
    Math.max(hy, ty) < -pad ||
    Math.min(hy, ty) > H + pad
  ) {
    return;
  }

  const px = -m.diry;
  const py = m.dirx;

  // Tapered tail: a triangle from full head width to nothing, filled with a
  // white→transparent gradient, plus a narrower brighter core.
  const tri = (hw: number, len: number, headA: number, midA: number) => {
    const ex = hx - m.dirx * len;
    const ey = hy - m.diry * len;
    const g = ctx.createLinearGradient(hx, hy, ex, ey);
    g.addColorStop(0, `rgba(255,255,255,${headA})`);
    g.addColorStop(0.25, `rgba(255,255,255,${midA})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(hx + px * hw, hy + py * hw);
    ctx.lineTo(hx - px * hw, hy - py * hw);
    ctx.lineTo(ex, ey);
    ctx.closePath();
    ctx.fill();
  };

  tri(m.width * 0.5, m.tail, a * 0.85, a * 0.32);
  tri(m.width * 0.22, m.tail * 0.55, a, a * 0.45);

  // Soft bloom around the head only.
  const br = m.width * 7 + 12;
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, br);
  g.addColorStop(0, `rgba(255,255,255,${a * 0.8})`);
  g.addColorStop(0.3, `rgba(255,255,255,${a * 0.22})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(hx, hy, br, 0, TAU);
  ctx.fill();

  // Concentrated point of light at the leading end.
  ctx.fillStyle = `rgba(255,255,255,${Math.min(1, a * 1.15)})`;
  ctx.beginPath();
  ctx.arc(hx, hy, Math.max(1.5, m.width * 0.55), 0, TAU);
  ctx.fill();
};

const drawFrame = (ctx: CanvasRenderingContext2D, S: Statics, f: number) => {
  const t = f / LOOP;

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = DEEP_SPACE;
  ctx.fillRect(0, 0, W, H);

  // Camera: extremely slow drift on a closed path. No zoom, no rotation.
  const camX = 22 * Math.sin(TAU * t);
  const camY = 15 * Math.sin(2 * TAU * t + 1.3);
  ctx.save();
  ctx.translate(camX, camY);

  // Nebula: two pre-baked layers, counter-phased micro-rotations (<2° total)
  // plus tiny closed-path offsets — a faint internal churn, nearly still.
  const cx = NEB_CX - MARGIN;
  const cy = NEB_CY - MARGIN;
  const layers: [HTMLCanvasElement, number, number, number][] = [
    [
      S.nebA,
      ((0.8 * Math.PI) / 180) * Math.sin(TAU * t),
      5 * Math.sin(TAU * t + 0.5),
      5 * Math.cos(TAU * t + 0.5),
    ],
    [
      S.nebB,
      ((0.6 * Math.PI) / 180) * Math.sin(TAU * t + 2.4),
      7 * Math.sin(TAU * t + 3.6),
      7 * Math.cos(TAU * t + 3.6),
    ],
  ];
  ctx.globalCompositeOperation = 'lighter';
  for (const [layer, rot, ox, oy] of layers) {
    ctx.save();
    ctx.translate(cx + ox, cy + oy);
    ctx.rotate(rot);
    ctx.drawImage(layer, -NEB_CX, -NEB_CY, SW, SH);
    ctx.restore();
  }

  // Teal edge glow, breathing ±8% on a one-cycle sine.
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.92 + 0.08 * Math.sin(TAU * t);
  ctx.drawImage(S.teal, -MARGIN, -MARGIN, SW, SH);
  ctx.globalAlpha = 1;

  // Starfield base (baked), then the per-frame twinkle on top.
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(S.starBase, -MARGIN, -MARGIN);
  for (const s of S.stars) {
    const add = s.amp * (1 + Math.sin(TAU * s.k * t + s.ph));
    if (add < 0.006) {
      continue;
    }
    ctx.fillStyle = rgba(s.color, add);
    ctx.beginPath();
    ctx.arc(s.x - MARGIN, s.y - MARGIN, s.size * 0.5, 0, TAU);
    ctx.fill();
  }

  // Meteors — the subject of the piece.
  for (const m of S.meteors) {
    drawMeteor(ctx, m, f);
  }

  ctx.restore();

  // Vignette — strong, this is deep space.
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(S.vignette, 0, 0);

  // Fine grain, seeded on frame % LOOP so the loop closes.
  if (S.grain.length > 0) {
    const gi = Math.floor(random(`grain-pick-${f}`) * S.grain.length);
    const ox = Math.floor(random(`grain-ox-${f}`) * GRAIN_TILE);
    const oy = Math.floor(random(`grain-oy-${f}`) * GRAIN_TILE);
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.translate(-ox, -oy);
    ctx.fillStyle = S.grain[gi];
    ctx.fillRect(0, 0, W + GRAIN_TILE, H + GRAIN_TILE);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
};

// ── Component ────────────────────────────────────────────────────────────────
export const MeteorShower: React.FC = () => {
  const frame = useCurrentFrame();
  const f = frame % LOOP;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The nebula and starfield are baked ONCE to offscreen canvases and blitted
  // each frame — only meteors and twinkle need per-frame work.
  const statics = useMemo<Statics | null>(() => {
    if (typeof document === 'undefined') {
      return null;
    }
    const {nebA, nebB} = buildNebulaLayers();
    const stars = buildStars();
    // Grain patterns need a context to create against; use a throwaway one.
    const {ctx} = makeCanvas(1, 1);
    return {
      nebA,
      nebB,
      teal: buildTealLayer(),
      starBase: buildStarBase(stars),
      vignette: buildVignette(),
      grain: buildGrain(ctx),
      stars,
      meteors: buildMeteors(),
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !statics) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    drawFrame(ctx, statics, f);
  }, [f, statics]);

  return (
    <AbsoluteFill style={{backgroundColor: DEEP_SPACE}}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{width: '100%', height: '100%'}}
      />
    </AbsoluteFill>
  );
};
