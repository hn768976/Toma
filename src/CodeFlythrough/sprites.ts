import * as C from './constants';
import type {FieldElement, Measure} from './field';
import {rgba} from './color';
import {isComment} from './snippets';

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Extra scale applied at draw time on top of the raster. */
  m: number;
  w: number;
  h: number;
}

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

const ctx2d = (c: HTMLCanvasElement) => {
  const g = c.getContext('2d');
  if (!g) throw new Error('2d context unavailable');
  return g;
};

export const fontString = (fontFamily: string, px: number, weight: number) =>
  `${weight} ${px}px "${fontFamily}", "Roboto Mono", ui-monospace, monospace`;

/** Text measurement, used while generating the field. */
export const makeMeasure = (fontFamily: string): Measure => {
  const g = ctx2d(makeCanvas(8, 8));
  return (lines, px, weight) => {
    g.font = fontString(fontFamily, px, weight);
    let w = 0;
    for (const line of lines) w = Math.max(w, g.measureText(line).width);
    return Math.max(w, px);
  };
};

const roundRect = (
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  const rad = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rad, y);
  g.lineTo(x + w - rad, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rad);
  g.lineTo(x + w, y + h - rad);
  g.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  g.lineTo(x + rad, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rad);
  g.lineTo(x, y + rad);
  g.quadraticCurveTo(x, y, x + rad, y);
  g.closePath();
};

/**
 * The chatbot glyph: rounded head, oval eyes, a small curved mouth, an antenna
 * nub and side tabs for ears. Outline only, ~4px stroke at native scale.
 * Drawn centred on the origin inside a 140 x 126 native box.
 */
const drawIcon = (g: CanvasRenderingContext2D, color: string) => {
  g.save();
  g.translate(0, 12.5); // content spans y -67..42, recentre it
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  roundRect(g, -50, -42, 100, 84, 20);
  g.stroke();

  roundRect(g, -58, -11, 8, 22, 3.5);
  g.stroke();
  roundRect(g, 50, -11, 8, 22, 3.5);
  g.stroke();

  g.beginPath();
  g.moveTo(0, -42);
  g.lineTo(0, -55);
  g.stroke();
  g.beginPath();
  g.arc(0, -60, 5.5, 0, Math.PI * 2);
  g.stroke();

  g.beginPath();
  g.ellipse(-21, -8, 9, 12, 0, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.ellipse(21, -8, 9, 12, 0, 0, Math.PI * 2);
  g.stroke();

  g.beginPath();
  g.moveTo(-19, 17);
  g.quadraticCurveTo(0, 29, 19, 17);
  g.stroke();

  g.restore();
};

const drawText = (
  g: CanvasRenderingContext2D,
  el: FieldElement,
  fontFamily: string,
) => {
  const lh = el.fontPx * C.LINE_HEIGHT;
  const top = -(el.lines.length * lh) / 2;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  for (let i = 0; i < el.lines.length; i++) {
    const line = el.lines[i] as string;
    const comment = isComment(line);
    g.font = fontString(fontFamily, el.fontPx, comment ? el.weight + 100 : el.weight);
    g.fillStyle = comment ? el.commentColor : el.color;
    g.globalAlpha = comment ? 1 : 0.66;
    g.fillText(line, -el.w0 / 2, top + (i + 0.5) * lh);
  }
  g.globalAlpha = 1;
};

/** A short bright dash with soft ends, lying along the local x axis. */
const drawStreak = (g: CanvasRenderingContext2D, el: FieldElement) => {
  const half = el.w0 / 2;
  const grad = g.createLinearGradient(-half, 0, half, 0);
  grad.addColorStop(0, rgba(el.color, 0));
  grad.addColorStop(0.16, rgba(el.color, 0.75));
  grad.addColorStop(0.5, rgba(el.color, 1));
  grad.addColorStop(0.84, rgba(el.color, 0.75));
  grad.addColorStop(1, rgba(el.color, 0));
  g.strokeStyle = grad;
  g.lineWidth = el.streakThickness;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-half + el.streakThickness, 0);
  g.lineTo(half - el.streakThickness, 0);
  g.stroke();
};

const drawAccent = (g: CanvasRenderingContext2D, el: FieldElement) => {
  const s = el.squareSize;
  g.fillStyle = el.color;
  g.fillRect(-s / 2, -s / 2, s, s);
};

const drawContent = (
  g: CanvasRenderingContext2D,
  el: FieldElement,
  fontFamily: string,
) => {
  switch (el.kind) {
    case 'code':
    case 'binary':
      drawText(g, el, fontFamily);
      break;
    case 'icon':
      drawIcon(g, el.color);
      break;
    case 'streak':
      drawStreak(g, el);
      break;
    case 'accent':
      drawAccent(g, el);
      break;
  }
};

/** Keeps the largest sprites from blowing up memory. */
const MAX_SPRITE_AREA = 1_150_000;

/**
 * Motion-blur sample weights, brightest at the leading edge.
 *
 * WEIGHTS[n - 1] is the set for an n-sample smear. They are normalised to sum
 * a little above 1 so the smear keeps some presence instead of just dimming.
 */
const RAW_W = [1, 0.72, 0.5, 0.34, 0.22];
export const WEIGHTS: number[][] = RAW_W.map((_, i) => {
  const raw = RAW_W.slice(0, i + 1);
  const sum = raw.reduce((a, b) => a + b, 0);
  const target = i === 0 ? 1 : 1.55;
  return raw.map((v) => (v / sum) * target);
});

/**
 * Smears a finished sprite along the direction of travel.
 *
 * The element's speed never changes, so the smear is a fixed offset pattern
 * and can be composited into the sprite once instead of costing three to five
 * large scaled draws on every one of the 540 frames.
 */
const smear = (core: HTMLCanvasElement, el: FieldElement, m: number): Sprite => {
  const weights = WEIGHTS[el.steps - 1] as number[];
  // Offsets are in screen px; divide by m to express them in sprite px.
  const reach = (el.speed * 0.5) / m;
  const padX = Math.ceil(Math.abs(C.MOTION_X) * reach) + 1;
  const padY = Math.ceil(Math.abs(C.MOTION_Y) * reach) + 1;

  const out = makeCanvas(core.width + padX * 2, core.height + padY * 2);
  const g = ctx2d(out);
  // Tail first, so the leading sample lands on top.
  for (let i = el.steps - 1; i >= 0; i--) {
    const t = 0.5 - i / (el.steps - 1);
    g.globalAlpha = weights[i] as number;
    g.drawImage(
      core,
      padX + (C.MOTION_X * el.speed * t) / m,
      padY + (C.MOTION_Y * el.speed * t) / m,
    );
  }
  g.globalAlpha = 1;
  core.width = 0;
  core.height = 0;
  return {canvas: out, m, w: out.width, h: out.height};
};

/**
 * Rasterises one element once, with its rotation and depth blur already baked
 * in. Only its position changes over the 540 frames, so this never has to be
 * redone; per frame the element costs a handful of drawImage calls.
 */
const buildSprite = (el: FieldElement, fontFamily: string): Sprite => {
  // Heroes retype themselves every frame, so there is nothing to cache.
  if (el.kind === 'hero') {
    return {canvas: makeCanvas(1, 1), m: 1, w: 1, h: 1};
  }

  const sharpness = 1 / (1 + el.blur / 10);
  let rs = Math.min(
    el.scale,
    C.MIN_RENDER_SCALE + (C.MAX_RENDER_SCALE - C.MIN_RENDER_SCALE) * sharpness,
  );
  rs = Math.max(0.3, rs);

  const cos = Math.abs(Math.cos(el.rot));
  const sin = Math.abs(Math.sin(el.rot));
  const rotW = el.w0 * cos + el.h0 * sin;
  const rotH = el.w0 * sin + el.h0 * cos;

  // Second pass: if the raster would be huge, back the render scale off.
  const areaAt = (s: number) => {
    const b = (el.blur / (el.scale / s)) * 3 + 4;
    return (rotW * s + 2 * b) * (rotH * s + 2 * b);
  };
  if (areaAt(rs) > MAX_SPRITE_AREA) {
    rs = Math.max(0.3, rs * Math.sqrt(MAX_SPRITE_AREA / areaAt(rs)));
  }

  const m = el.scale / rs;
  const spriteBlur = el.blur / m + (el.kind === 'streak' ? 1.4 : 0);
  const pad = Math.ceil(spriteBlur * 3 + 4);
  const w = rotW * rs + pad * 2;
  const h = rotH * rs + pad * 2;

  const sharp = makeCanvas(w, h);
  const sg = ctx2d(sharp);
  sg.translate(sharp.width / 2, sharp.height / 2);
  sg.rotate(el.rot);
  sg.scale(rs, rs);
  drawContent(sg, el, fontFamily);

  if (spriteBlur <= 0.05) {
    return el.steps > 1
      ? smear(sharp, el, m)
      : {canvas: sharp, m, w: sharp.width, h: sharp.height};
  }

  // Blur as a separate identity-transform pass so the radius is unambiguous.
  const soft = makeCanvas(w, h);
  const bg = ctx2d(soft);
  bg.filter = `blur(${spriteBlur.toFixed(2)}px)`;
  bg.drawImage(sharp, 0, 0);
  bg.filter = 'none';
  sharp.width = 0;
  sharp.height = 0;

  return el.steps > 1
    ? smear(soft, el, m)
    : {canvas: soft, m, w: soft.width, h: soft.height};
};

export const buildSprites = (
  field: FieldElement[],
  fontFamily: string,
): Sprite[] => field.map((el) => buildSprite(el, fontFamily));

/** Seeded grain tiles, generated once and cycled by frame. */
export const buildGrainTiles = (
  rand: (seed: string) => number,
): HTMLCanvasElement[] => {
  const tiles: HTMLCanvasElement[] = [];
  const n = C.GRAIN_TILE_PX;
  for (let t = 0; t < C.GRAIN_TILES; t++) {
    const c = makeCanvas(n, n);
    const g = ctx2d(c);
    const img = g.createImageData(n, n);
    const d = img.data;
    for (let i = 0; i < n * n; i++) {
      const v = rand(`grain-${t}-${i}`);
      const tone = 90 + v * 165;
      d[i * 4] = tone;
      d[i * 4 + 1] = tone;
      d[i * 4 + 2] = tone;
      d[i * 4 + 3] = Math.floor(v * 255);
    }
    g.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
};

/**
 * The vignette never changes, so it is painted once into a full-size layer and
 * blitted each frame rather than re-evaluating an 8-megapixel radial gradient
 * 540 times.
 */
const makeVignette = (w: number, h: number) => {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  g.translate(w / 2, h / 2);
  g.scale(w / h, 1);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, h * 0.722);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.42, 'rgba(0,0,0,0.03)');
  grad.addColorStop(0.68, 'rgba(0,0,0,0.2)');
  grad.addColorStop(0.86, 'rgba(0,0,0,0.46)');
  grad.addColorStop(1, 'rgba(0,0,0,0.74)');
  g.fillStyle = grad;
  g.fillRect(-w, -h, w * 2, h * 2);
  return c;
};

/**
 * Working surfaces. Every filtered bloom step happens at eighth or twentieth
 * resolution: a `contrast() blur()` chain over a 4K surface is the single most
 * expensive thing this shot could do per frame.
 */
export const makeScratch = (w: number, h: number) => ({
  /** Plain, unfiltered downscale of the frame. */
  small: makeCanvas(Math.round(w / 8), Math.round(h / 8)),
  /** Bright-pass of `small`. */
  bloomA: makeCanvas(Math.round(w / 8), Math.round(h / 8)),
  /** Wider, softer second halo. */
  bloomB: makeCanvas(Math.round(w / 20), Math.round(h / 20)),
  vignette: makeVignette(w, h),
});
