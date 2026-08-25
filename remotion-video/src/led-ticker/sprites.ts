// Pre-baked drawing assets. Everything an LED needs — dark body, lit core,
// bloom halo — is rendered once into a small canvas and then stamped, because
// a 4K board holds ~78,000 lattice cells and per-dot gradients are hopeless.

import { random } from "remotion";
import {
  DEAD_LED_COUNT,
  GRAIN_TILE,
  GREEN,
  HEIGHT,
  LED_RADIUS,
  LIT_GREEN,
  LIT_RED,
  LIT_WHITE,
  PITCH,
  RED,
  UNLIT,
  VIGNETTE_ALPHA,
  WHITE,
  WIDTH,
} from "./constants";
import { BOARD_X0, BOARD_W, GRID_Y0, TOTAL_ROWS } from "./transform";

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

const ctxOf = (c: HTMLCanvasElement) =>
  c.getContext("2d") as CanvasRenderingContext2D;

// ── Lit LED stamp ──────────────────────────────────────────────────────────
/** Stamp footprint in board px: core plus two pitches of halo either side. */
export const SPRITE_BOARD = PITCH * 4;
export const SPRITE_HALF = SPRITE_BOARD / 2;
const SS = 2; // supersample, so the core stays crisp under the board scale

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const buildLitSprite = (hex: string, boost: number) => {
  const size = SPRITE_BOARD * SS;
  const c = makeCanvas(size, size);
  const ctx = ctxOf(c);
  const m = size / 2;

  // Additive bloom spilling onto the neighbouring dark LEDs.
  const g = ctx.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, rgba(hex, 0.72 * boost));
  g.addColorStop(0.11, rgba(hex, 0.34 * boost));
  g.addColorStop(0.26, rgba(hex, 0.095 * boost));
  g.addColorStop(0.52, rgba(hex, 0.022 * boost));
  g.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Bright core. Stacked additively so the emitter itself clips to full.
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = hex;
  for (let i = 0; i < (boost > 1 ? 3 : 2); i++) {
    ctx.beginPath();
    ctx.arc(m, m, LED_RADIUS * SS, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
};

let litSprites: HTMLCanvasElement[] | null = null;
let ruleSprite: HTMLCanvasElement | null = null;

/** Indexed by the LIT_* state stored in a band's sampled sprite. */
export const getLitSprite = (state: number) => {
  if (!litSprites) {
    const white = buildLitSprite(WHITE, 1);
    const sprites: HTMLCanvasElement[] = [];
    sprites[LIT_WHITE] = white;
    sprites[LIT_GREEN] = buildLitSprite(GREEN, 1);
    sprites[LIT_RED] = buildLitSprite(RED, 1);
    litSprites = sprites;
  }
  return litSprites[state];
};

/** Separator rules are the brightest thing in the frame. */
export const getRuleSprite = () => {
  if (!ruleSprite) {
    ruleSprite = buildLitSprite(WHITE, 1.45);
  }
  return ruleSprite;
};

// ── Unlit lattice ──────────────────────────────────────────────────────────
// Filled as a pattern under the board transform, so the dark grid tilts with
// the panel and stays visible in every black area between the text.
//
// A CanvasPattern belongs to the context that created it, and there is one
// context per depth-of-field bucket, so they are cached per context.
let darkTile: HTMLCanvasElement | null = null;
const darkPatterns = new WeakMap<
  CanvasRenderingContext2D,
  CanvasPattern
>();

const SS_GRID = 3; // supersample so the dots survive the board scale-up

export const getDarkPattern = (ctx: CanvasRenderingContext2D) => {
  const existing = darkPatterns.get(ctx);
  if (existing) {
    return existing;
  }
  if (!darkTile) {
    const leds = 4;
    const s = SS_GRID;
    const c = makeCanvas(PITCH * leds * s, PITCH * leds * s);
    const g = ctxOf(c);
    g.fillStyle = UNLIT;
    for (let y = 0; y < leds; y++) {
      for (let x = 0; x < leds; x++) {
        g.beginPath();
        g.arc(
          (x * PITCH + PITCH / 2) * s,
          (y * PITCH + PITCH / 2) * s,
          LED_RADIUS * s,
          0,
          Math.PI * 2,
        );
        g.fill();
      }
    }
    darkTile = c;
  }
  const p = ctx.createPattern(darkTile, "repeat") as CanvasPattern;
  p.setTransform(new DOMMatrix([1 / SS_GRID, 0, 0, 1 / SS_GRID, 0, 0]));
  darkPatterns.set(ctx, p);
  return p;
};

// ── Dead emitters ──────────────────────────────────────────────────────────
/** Fixed board positions that stay permanently dark. Every real board has some. */
export const DEAD_LEDS = (() => {
  const cols = Math.floor(BOARD_W / PITCH);
  const out: { x: number; y: number; dim: number }[] = [];
  for (let i = 0; i < DEAD_LED_COUNT; i++) {
    const col = Math.floor(random(`led-dead-${i}-c`) * cols);
    const row = Math.floor(random(`led-dead-${i}-r`) * TOTAL_ROWS);
    out.push({
      x: BOARD_X0 + col * PITCH + PITCH / 2,
      y: GRID_Y0 + row * PITCH + PITCH / 2,
      // A few are fully dead, the rest merely dim.
      dim: 0.55 + random(`led-dead-${i}-d`) * 0.45,
    });
  }
  return out;
})();

export const DEAD_RADIUS = PITCH * 0.95;

let deadSprite: HTMLCanvasElement | null = null;

/** Knocked out with destination-out, so it eats the halo as well as the core. */
export const getDeadSprite = () => {
  if (!deadSprite) {
    const size = Math.ceil(DEAD_RADIUS * 2 * SS);
    const c = makeCanvas(size, size);
    const ctx = ctxOf(c);
    const m = size / 2;
    const g = ctx.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.45, "rgba(0,0,0,0.92)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    deadSprite = c;
  }
  return deadSprite;
};

// ── Focus falloff mask ─────────────────────────────────────────────────────
// Alpha = how much of the frame-wide defocus pass survives. Sharp in the
// upper-left focal band, dissolving toward the lower-right and the edges.
let focusMask: HTMLCanvasElement | null = null;

export const getFocusMask = () => {
  if (!focusMask) {
    const w = 480;
    const h = 270;
    const c = makeCanvas(w, h);
    const ctx = ctxOf(c);

    const lin = ctx.createLinearGradient(0.04 * w, 0.34 * h, 1.12 * w, 0.78 * h);
    lin.addColorStop(0, "rgba(255,255,255,0)");
    lin.addColorStop(0.42, "rgba(255,255,255,0.12)");
    lin.addColorStop(0.75, "rgba(255,255,255,0.55)");
    lin.addColorStop(1, "rgba(255,255,255,1)");
    ctx.fillStyle = lin;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "lighter";
    const rad = ctx.createRadialGradient(
      0.36 * w,
      0.32 * h,
      0,
      0.36 * w,
      0.32 * h,
      1.0 * w,
    );
    rad.addColorStop(0, "rgba(255,255,255,0)");
    rad.addColorStop(0.6, "rgba(255,255,255,0)");
    rad.addColorStop(1, "rgba(255,255,255,0.8)");
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);

    focusMask = c;
  }
  return focusMask;
};

// ── Vignette ───────────────────────────────────────────────────────────────
let vignette: CanvasGradient | null = null;

export const getVignette = (ctx: CanvasRenderingContext2D) => {
  if (!vignette) {
    const cx = WIDTH * 0.42;
    const cy = HEIGHT * 0.38;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, WIDTH * 0.78);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.55, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${VIGNETTE_ALPHA})`);
    vignette = g;
  }
  return vignette;
};

// ── Grain ──────────────────────────────────────────────────────────────────
const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

let grainCanvas: HTMLCanvasElement | null = null;
let grainSeed = -1;

/** Reseeded from frame % 1200, so the grain closes with the loop. */
export const getGrain = (loopFrame: number) => {
  if (!grainCanvas) {
    grainCanvas = makeCanvas(GRAIN_TILE, GRAIN_TILE);
  }
  if (grainSeed !== loopFrame) {
    const ctx = ctxOf(grainCanvas);
    const img = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    const d = img.data;
    const rnd = mulberry32(random(`led-grain-${loopFrame}`) * 4294967296);
    for (let i = 0; i < d.length; i += 4) {
      const v = (rnd() * 255) | 0;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    grainSeed = loopFrame;
  }
  return grainCanvas;
};
