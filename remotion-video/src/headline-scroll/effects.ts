// Everything that is baked once and only blitted per frame: the glitch
// schedule, the centre-word sprites, the vignette, and the grain tiles.

import { random } from "remotion";
import {
  CENTER_X,
  CENTER_Y,
  DURATION_IN_FRAMES,
  GLITCH_DURATION,
  GLITCH_FIRST_FRAME,
  GLITCH_GAP,
  GLITCH_SLICE_COUNT,
  GLITCH_SLICE_HEIGHT,
  GLITCH_SLICE_SHIFT,
  GLITCH_TAIL_GUARD,
  GRAIN_TILE_COUNT,
  GRAIN_TILE_SIZE,
  HEIGHT,
  VIGNETTE_INNER_STOP,
  VIGNETTE_STRENGTH,
  WIDTH,
  WORD_CAP_HEIGHT_RATIO,
} from "./constants";
import { SANS_FAMILY } from "./fonts";
import { createCanvas } from "./lines";
import { type Theme, withAlpha } from "./theme";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const context2d = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("HeadlineScroll: 2D canvas context unavailable");
  return ctx;
};

// ---------------------------------------------------------------- glitch ---

export type GlitchSlice = { y: number; height: number; shift: number };
export type GlitchEvent = {
  start: number;
  duration: number;
  slices: GlitchSlice[];
};

/**
 * Irregular but seeded, and entirely a function of the frame within the loop.
 * The first event starts well after frame 0 and the last one ends before the
 * tail guard, so the wrap point is always clean.
 */
export const buildGlitches = (seed: string): GlitchEvent[] => {
  const events: GlitchEvent[] = [];
  let frame = Math.round(
    lerp(GLITCH_FIRST_FRAME[0], GLITCH_FIRST_FRAME[1], random(`${seed}-g-first`)),
  );
  for (let n = 0; frame <= DURATION_IN_FRAMES - GLITCH_TAIL_GUARD; n++) {
    const duration = Math.round(
      lerp(GLITCH_DURATION[0], GLITCH_DURATION[1], random(`${seed}-g-dur-${n}`)),
    );
    const sliceCount = Math.round(
      lerp(
        GLITCH_SLICE_COUNT[0],
        GLITCH_SLICE_COUNT[1],
        random(`${seed}-g-count-${n}`),
      ),
    );
    const slices = Array.from({ length: sliceCount }, (_, s): GlitchSlice => {
      const height = lerp(
        GLITCH_SLICE_HEIGHT[0],
        GLITCH_SLICE_HEIGHT[1],
        random(`${seed}-g-h-${n}-${s}`),
      );
      const magnitude = lerp(
        GLITCH_SLICE_SHIFT[0],
        GLITCH_SLICE_SHIFT[1],
        random(`${seed}-g-s-${n}-${s}`),
      );
      return {
        y: Math.round(random(`${seed}-g-y-${n}-${s}`) * (HEIGHT - height)),
        height: Math.round(height),
        shift:
          Math.round(magnitude) *
          (random(`${seed}-g-dir-${n}-${s}`) < 0.5 ? -1 : 1),
      };
    });
    events.push({ start: frame, duration, slices });
    frame += Math.round(
      lerp(GLITCH_GAP[0], GLITCH_GAP[1], random(`${seed}-g-gap-${n}`)),
    );
  }
  return events;
};

export const glitchAt = (
  events: GlitchEvent[],
  loopFrame: number,
): GlitchEvent | null =>
  events.find(
    (e) => loopFrame >= e.start && loopFrame < e.start + e.duration,
  ) ?? null;

// ------------------------------------------------------------ centre word ---

export type WordSprite = {
  white: HTMLCanvasElement;
  red: HTMLCanvasElement;
  cyan: HTMLCanvasElement;
  /** Top-left blit position that lands the ink box dead centre. */
  x: number;
  y: number;
};

const tinted = (source: HTMLCanvasElement, color: string) => {
  const canvas = createCanvas(source.width, source.height);
  const ctx = context2d(canvas);
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
};

export const buildWordSprite = (word: string, theme: Theme): WordSprite => {
  const probeCtx = context2d(createCanvas(8, 8));

  // Size from the face's cap height, not from the word's own ascender, so the
  // "11% of frame height" holds whatever word is passed in.
  const probe = 400;
  probeCtx.font = `900 ${probe}px "${SANS_FAMILY}"`;
  const capRatio = probeCtx.measureText("H").actualBoundingBoxAscent / probe;
  const fontSize = (WORD_CAP_HEIGHT_RATIO * HEIGHT) / capRatio;

  const font = `900 ${fontSize}px "${SANS_FAMILY}"`;
  probeCtx.font = font;
  const m = probeCtx.measureText(word);
  const left = m.actualBoundingBoxLeft;
  const right = m.actualBoundingBoxRight;
  const ascent = m.actualBoundingBoxAscent;
  const descent = m.actualBoundingBoxDescent;

  const pad = Math.ceil(fontSize * 0.12);
  const inkWidth = right + left;
  const inkHeight = ascent + descent;
  const white = createCanvas(inkWidth + pad * 2, inkHeight + pad * 2);
  const ctx = context2d(white);
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = theme.word;
  ctx.fillText(word, pad + left, pad + ascent);

  return {
    white,
    red: tinted(white, theme.fringeRed),
    cyan: tinted(white, theme.fringeCyan),
    // Integer position: the one element in the frame that must stay pin sharp.
    x: Math.round(CENTER_X - (pad + inkWidth / 2)),
    y: Math.round(CENTER_Y - (pad + inkHeight / 2)),
  };
};

// --------------------------------------------------------------- vignette ---

/**
 * Baked full-frame. The gradient is drawn in a squashed space so the falloff is
 * an ellipse matching the 16:9 frame: the end stop lands on the mid-points of
 * all four edges, and the corners sit past it, held at the final colour. That
 * is what makes the edges actually reach black rather than just dim.
 */
export const buildVignette = (theme: Theme): HTMLCanvasElement => {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = context2d(canvas);
  const radius = WIDTH / 2;

  ctx.translate(CENTER_X, CENTER_Y);
  ctx.scale(1, HEIGHT / WIDTH);

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  const stops = 16;
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const ramp = Math.max(
      0,
      (t - VIGNETTE_INNER_STOP) / (1 - VIGNETTE_INNER_STOP),
    );
    gradient.addColorStop(
      t,
      withAlpha(theme.vignette, ramp ** 1.6 * VIGNETTE_STRENGTH),
    );
  }
  ctx.fillStyle = gradient;
  // Past `radius` the gradient holds its last stop, so this covers the corners.
  ctx.fillRect(-WIDTH, -WIDTH, WIDTH * 2, WIDTH * 2);
  return canvas;
};

// ------------------------------------------------------------------ grain ---

/**
 * A handful of noise tiles, pre-baked. The count divides the loop length, so
 * the grain pattern returns to tile 0 exactly at the wrap.
 */
export const buildGrainTiles = (
  theme: Theme,
  seed: string,
): HTMLCanvasElement[] =>
  Array.from({ length: GRAIN_TILE_COUNT }, (_, t) => {
    const canvas = createCanvas(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const ctx = context2d(canvas);
    const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const [r, g, b] = [theme.grain]
      .map((hex) => parseInt(hex.slice(1), 16))
      .flatMap((int) => [(int >> 16) & 255, (int >> 8) & 255, int & 255]);
    // One string seed per tile; per-pixel seeds are numeric offsets from it so
    // baking stays fast while remaining fully deterministic.
    const base = Math.floor(random(`${seed}-grain-${t}`) * 1e6);
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = Math.round(random(base + i) * 255);
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  });
