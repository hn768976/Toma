// Offscreen glyph atlas.
//
// Every notation item is laid out and painted exactly ONCE, into a small set
// of high-resolution offscreen canvases — one per palette tone. The field then
// blits those canvases scaled. Re-laying-out a formula (measuring text,
// positioning subscripts, stroking a ring) on every frame for seventy glyphs
// would dominate the render; this is the whole reason 4K stays affordable.

import type { Notation, Palette, Variant } from "./variant-types";
import { layDiagram } from "./diagram";
import { lay } from "./layout";

/** Font size an equation is laid out at inside its sprite. */
export const BASE_FONT = 88;
/** Slack around the sprite content so the glow is not clipped. */
const GLOW_PAD = 30;
const GLOW_BLUR = 20;

export type Tone = 0 | 1 | 2;

export type Sprite = {
  id: string;
  kind: Notation["kind"];
  /** Index 0 = dim, 1 = mid, 2 = bright. */
  tones: HTMLCanvasElement[];
  /** Full canvas size, glow padding included. */
  w: number;
  h: number;
  /** Multiplier taking sprite pixels to on-screen pixels at unit depth. */
  baseScale: number;
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

const toneColors = (p: Palette): { ink: string; glow: string }[] => [
  { ink: p.dim, glow: p.dim },
  { ink: p.mid, glow: p.mid },
  { ink: p.bright, glow: p.white },
];

/**
 * Paint one notation item at one tone. The content is drawn twice: a wide,
 * low-alpha pass that lays down the glow, then a crisp pass on top.
 */
const paint = (
  canvas: HTMLCanvasElement,
  item: Notation,
  ink: string,
  glow: string,
  contentW: number,
  contentH: number,
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const body = () => {
    if (item.kind === "equation") {
      const laid = lay(ctx, item.e, item.size ?? BASE_FONT);
      laid.draw(ctx, GLOW_PAD, GLOW_PAD + laid.a);
    } else {
      const laid = layDiagram(ctx, item.cmds);
      laid.draw(ctx, GLOW_PAD, GLOW_PAD);
    }
  };

  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.shadowColor = glow;
  ctx.shadowBlur = GLOW_BLUR;
  ctx.globalAlpha = 0.55;
  body();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.shadowColor = glow;
  ctx.shadowBlur = GLOW_BLUR * 0.35;
  ctx.globalAlpha = 1;
  body();
  ctx.restore();

  void contentW;
  void contentH;
};

const measureItem = (ctx: CanvasRenderingContext2D, item: Notation) => {
  if (item.kind === "equation") {
    const laid = lay(ctx, item.e, item.size ?? BASE_FONT);
    return { w: laid.w, h: laid.a + laid.d };
  }
  const laid = layDiagram(ctx, item.cmds);
  return { w: laid.w, h: laid.h };
};

const buildAtlas = (variant: Variant): Sprite[] => {
  const scratch = makeCanvas(8, 8).getContext("2d");
  if (!scratch) return [];
  const colors = toneColors(variant.palette);

  return variant.notation.map((item) => {
    const { w, h } = measureItem(scratch, item);
    const cw = w + GLOW_PAD * 2;
    const ch = h + GLOW_PAD * 2;
    const tones = colors.map(({ ink, glow }) => {
      const c = makeCanvas(cw, ch);
      paint(c, item, ink, glow, w, h);
      return c;
    });
    // Soft normalisation: wide equations stay wider than compact rings, but
    // not by the full 3:1 their raw layouts differ by.
    const baseScale = (variant.targetWidth / Math.max(1, w)) ** 0.6;
    return { id: item.id, kind: item.kind, tones, w: cw, h: ch, baseScale };
  });
};

const cache = new Map<string, Sprite[]>();

/**
 * The atlas for a variant, built on first use and reused for the rest of the
 * render. Callers must only reach this once the notation typeface is ready.
 */
export const getAtlas = (variant: Variant): Sprite[] => {
  const hit = cache.get(variant.key);
  if (hit) return hit;
  const built = buildAtlas(variant);
  cache.set(variant.key, built);
  return built;
};
