import * as C from './constants';
import type {FieldElement} from './field';
import {fontString, type Sprite} from './sprites';
import type {Variant} from './variant';

export interface Scratch {
  small: HTMLCanvasElement;
  bloomA: HTMLCanvasElement;
  bloomB: HTMLCanvasElement;
  vignette: HTMLCanvasElement;
}

const mod1 = (n: number) => ((n % 1) + 1) % 1;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Maps a hero's crossing clock to its crossing distance.
 *
 * Velocity is a smoothstep of how far the clock is from the middle: zero
 * across the stop window, rising smoothly to a peak at either end. That peak
 * lands on the wrap, where the hero is off frame, so the fast part is never
 * seen and the slow part is the whole readable pass.
 *
 * The closed form is the integral of that velocity, normalised so a full
 * crossing still advances exactly 1. That last property is what keeps the loop
 * exact - the stop redistributes time within a crossing without adding or
 * removing any.
 */
const heroEase = (u: number, dwell: number) => {
  const half = 0.5 - dwell;
  if (half <= 0) return u;
  const past = u >= 0.5;
  const t = clamp01(((past ? u - 0.5 : 0.5 - u) - dwell) / half);
  const advance = t * t * t - (t * t * t * t) / 2;
  return past ? 0.5 + advance : 0.5 - advance;
};

/**
 * Position along the wrap, 1 at the entry edge falling to 0 at the exit edge.
 *
 * Ordinary elements drift at a constant rate. Heroes run on their own clock so
 * they can stop mid-frame; `phase` is 0 for them, which is what puts the stop
 * at frame centre.
 */
const progressFor = (el: FieldElement, f: number, v: Variant) => {
  if (el.kind !== 'hero') {
    return mod1(el.phase - (el.speed * f) / el.travel);
  }
  const u = mod1(f / v.durationInFrames + el.timeOffset);
  return {prog: mod1(el.phase - heroEase(u, el.dwell)), u};
};

/**
 * Draws a hero fragment: the same tilt as everything else, its leading lines
 * already written, the rest typing itself out as the fragment crosses frame.
 *
 * `u` is the crossing clock, running 0 -> 1 across one pass. Deriving the
 * typing from that instead of from the frame number is what keeps it inside the
 * loop: at frame 540 the fragment is back at its frame-0 crossing position and
 * so shows its frame-0 characters.
 */
const drawHero = (
  g: CanvasRenderingContext2D,
  el: FieldElement,
  x: number,
  y: number,
  scale: number,
  f: number,
  u: number,
  fontFamily: string,
  v: Variant,
) => {
  // Keyed on the crossing clock rather than on position, so the writing keeps
  // its steady rate straight through the stop instead of freezing with it.
  const typed = clamp01((u - C.HERO_TYPE_START) / C.HERO_TYPE_SPAN);

  const animated = el.lines.slice(el.staticLines);
  const total = animated.reduce((n, line) => n + line.length, 0);
  let left = Math.floor(typed * total);

  const lh = el.fontPx * C.LINE_HEIGHT;
  const top = -(el.lines.length * lh) / 2;

  g.save();
  g.translate(x, y);
  g.rotate(el.rot);
  g.scale(scale, scale);
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.globalAlpha = el.alpha;

  let caretX: number | null = null;
  let caretY = 0;

  for (let i = 0; i < el.lines.length; i++) {
    const full = el.lines[i] as string;
    const isStatic = i < el.staticLines;
    const lineY = top + (i + 0.5) * lh;

    g.font = fontString(fontFamily, el.fontPx, i === 0 ? el.weight + 100 : el.weight);
    g.fillStyle = (el.lineColors[i] as string) ?? el.color;

    if (!isStatic && left <= 0) {
      // Nothing of this line is written yet. The caret waits at its indent.
      const indent = full.slice(0, full.length - full.trimStart().length);
      caretX = -el.w0 / 2 + g.measureText(indent).width;
      caretY = lineY;
      break;
    }

    const shown = isStatic ? full : full.slice(0, Math.min(left, full.length));
    if (!isStatic) left -= shown.length;

    g.fillText(shown, -el.w0 / 2, lineY);

    if (!isStatic && shown.length < full.length) {
      caretX = -el.w0 / 2 + g.measureText(shown).width;
      caretY = lineY;
      break;
    }
  }

  // A blinking block caret while there is still text to write.
  const blink = mod1((f / v.durationInFrames) * v.caretBlinks) < 0.62;
  if (typed < 1 && caretX !== null && blink) {
    g.globalAlpha = el.alpha * 0.5;
    g.fillStyle = v.palette.codeBright;
    g.fillRect(caretX, caretY - el.fontPx * 0.42, el.fontPx * 0.58, el.fontPx * 0.86);
  }

  g.restore();
  g.globalAlpha = 1;
};

/**
 * Handheld camera: a small drift perpendicular to the diagonal. Both sine
 * terms have periods that divide 540, so the move closes on the loop.
 */
export const cameraOffset = (f: number, v: Variant) =>
  C.CAM_A * Math.sin((2 * Math.PI * f) / v.durationInFrames) +
  C.CAM_B * Math.sin((4 * Math.PI * f) / v.durationInFrames + C.CAM_PHASE);

/**
 * Two-stop bloom.
 *
 * The frame is first downscaled unfiltered, and only then does the bright-pass
 * and blur run - on a surface an eighth the size. Filtering during the 4K
 * downscale instead would force a full-resolution filtered intermediate, which
 * dominates the frame budget in software rasterisation.
 */
const bloom = (
  g: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  s: Scratch,
  w: number,
  h: number,
) => {
  const gs = s.small.getContext('2d');
  const ga = s.bloomA.getContext('2d');
  const gb = s.bloomB.getContext('2d');
  if (!gs || !ga || !gb) return;

  gs.filter = 'none';
  gs.globalCompositeOperation = 'copy';
  gs.drawImage(source, 0, 0, s.small.width, s.small.height);
  gs.globalCompositeOperation = 'source-over';

  ga.filter = 'contrast(2.4) brightness(1.18) blur(3px)';
  ga.globalCompositeOperation = 'copy';
  ga.drawImage(s.small, 0, 0);
  ga.filter = 'none';
  ga.globalCompositeOperation = 'source-over';

  gb.filter = 'blur(2.5px)';
  gb.globalCompositeOperation = 'copy';
  gb.drawImage(s.bloomA, 0, 0, s.bloomB.width, s.bloomB.height);
  gb.filter = 'none';
  gb.globalCompositeOperation = 'source-over';

  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.22;
  g.drawImage(s.bloomA, 0, 0, w, h);
  g.globalAlpha = 0.15;
  g.drawImage(s.bloomB, 0, 0, w, h);
  g.restore();
};

const grainPass = (
  g: CanvasRenderingContext2D,
  tiles: HTMLCanvasElement[],
  f: number,
  w: number,
  h: number,
  rand: (seed: string) => number,
) => {
  if (tiles.length === 0) return;
  const tile = tiles[f % tiles.length] as HTMLCanvasElement;
  const pattern = g.createPattern(tile, 'repeat');
  if (!pattern) return;
  const ox = Math.floor(rand(`grain-ox-${f}`) * C.GRAIN_TILE_PX);
  const oy = Math.floor(rand(`grain-oy-${f}`) * C.GRAIN_TILE_PX);
  g.save();
  g.globalAlpha = C.GRAIN_ALPHA;
  g.translate(-ox, -oy);
  g.fillStyle = pattern;
  g.fillRect(0, 0, w + C.GRAIN_TILE_PX, h + C.GRAIN_TILE_PX);
  g.restore();
};

export interface DrawArgs {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  field: FieldElement[];
  sprites: Sprite[];
  order: number[];
  grain: HTMLCanvasElement[];
  scratch: Scratch;
  frame: number;
  width: number;
  height: number;
  rand: (seed: string) => number;
  fontFamily: string;
  variant: Variant;
}

/**
 * Draws one frame. Pure in the frame number: given the same `frame` it emits
 * the same pixels, and frame 540 is identical to frame 0.
 *
 * Every element is a single blit. Its rotation, depth blur and motion smear
 * were all baked into its sprite when the field was built, so nothing here
 * lays out text, filters, or re-rasterises anything.
 */
export const drawFrame = ({
  ctx,
  canvas,
  field,
  sprites,
  order,
  grain,
  scratch,
  frame,
  width,
  height,
  rand,
  fontFamily,
  variant: v,
}: DrawArgs) => {
  const n = v.durationInFrames;
  const f = ((frame % n) + n) % n;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';

  ctx.fillStyle = v.palette.bg;
  ctx.fillRect(0, 0, width, height);

  const cam = cameraOffset(f, v);
  const sx = width / C.WIDTH;
  const sy = height / C.HEIGHT;

  for (const idx of order) {
    const el = field[idx] as FieldElement;
    const sp = sprites[idx] as Sprite;

    const p = progressFor(el, f, v);
    const prog = typeof p === 'number' ? p : p.prog;
    const along = (prog - 0.5) * el.travel;
    const perp = el.perp + cam;

    const x = (C.CX + v.ax * along + v.px * perp) * sx;
    const y = (C.CY + v.ay * along + v.py * perp) * sy;

    if (typeof p !== 'number') {
      drawHero(ctx, el, x, y, el.scale * sx, f, p.u, fontFamily, v);
      continue;
    }

    const dw = sp.w * sp.m * sx;
    const dh = sp.h * sp.m * sy;

    if (
      x + dw / 2 < 0 ||
      x - dw / 2 > width ||
      y + dh / 2 < 0 ||
      y - dh / 2 > height
    ) {
      continue;
    }

    ctx.globalAlpha = el.alpha;
    ctx.drawImage(sp.canvas, x - dw / 2, y - dh / 2, dw, dh);
  }

  ctx.globalAlpha = 1;

  bloom(ctx, canvas, scratch, width, height);
  ctx.drawImage(scratch.vignette, 0, 0, width, height);
  grainPass(ctx, grain, f, width, height, rand);

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
