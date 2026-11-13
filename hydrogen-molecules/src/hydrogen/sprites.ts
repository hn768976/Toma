/**
 * Pre-rendered glossy "H2" atom sprites (Canvas 2D).
 *
 * A sphere's shading depends only on view + light direction, not on the
 * molecule's own rotation, so a screen-aligned sprite is physically correct
 * for every atom. Labels always face the viewer, like the reference.
 */
import type { Palette } from "./palette";

export type AtomSprite = {
  canvas: HTMLCanvasElement;
  /** atom radius in sprite pixels */
  r: number;
  /** half size of the sprite canvas in sprite pixels */
  half: number;
};

export const FONT_FAMILY = "H2Inter";

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
};

const drawAtom = (ctx: CanvasRenderingContext2D, R: number, pal: Palette) => {
  // --- glass body ---------------------------------------------------------
  const body = ctx.createRadialGradient(0.12 * R, 0.2 * R, 0, 0, 0, R);
  body.addColorStop(0, pal.atomCore);
  body.addColorStop(0.45, pal.atomInner);
  body.addColorStop(0.76, pal.atomMid);
  body.addColorStop(0.9, pal.atomRim);
  body.addColorStop(1, pal.atomEdge);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.clip();

  // refracted inner "lens" disc
  const lens = ctx.createRadialGradient(0.06 * R, 0.1 * R, 0.4 * R, 0.04 * R, 0.06 * R, 0.8 * R);
  lens.addColorStop(0, pal.lensIn);
  lens.addColorStop(0.85, pal.lensIn);
  lens.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = lens;
  ctx.beginPath();
  ctx.arc(0.04 * R, 0.06 * R, 0.8 * R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.lensEdge;
  ctx.lineWidth = 0.025 * R;
  ctx.beginPath();
  ctx.arc(0.04 * R, 0.06 * R, 0.78 * R, 0, Math.PI * 2);
  ctx.stroke();

  // bottom-right caustic glow
  const caustic = ctx.createRadialGradient(0.42 * R, 0.5 * R, 0, 0.42 * R, 0.5 * R, 0.55 * R);
  caustic.addColorStop(0, pal.caustic);
  caustic.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = caustic;
  ctx.fillRect(-R, -R, 2 * R, 2 * R);

  // darker upper shell (sky reflection falls off toward the top edge)
  const shell = ctx.createLinearGradient(0, -R, 0, R);
  shell.addColorStop(0, pal.shellTop);
  shell.addColorStop(0.35, "rgba(0,0,0,0)");
  ctx.fillStyle = shell;
  ctx.fillRect(-R, -R, 2 * R, 2 * R);
  ctx.restore();

  // crisp outline
  ctx.strokeStyle = pal.outline;
  ctx.lineWidth = 0.03 * R;
  ctx.beginPath();
  ctx.arc(0, 0, R - 0.015 * R, 0, Math.PI * 2);
  ctx.stroke();

  // --- specular highlights --------------------------------------------------
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 0.11 * R;
  ctx.beginPath();
  ctx.arc(0, 0, 0.86 * R, (196 * Math.PI) / 180, (262 * Math.PI) / 180);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 0.04 * R;
  ctx.beginPath();
  ctx.arc(0, 0, 0.87 * R, (200 * Math.PI) / 180, (255 * Math.PI) / 180);
  ctx.stroke();
  // window reflections near the top
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 0.022 * R;
  for (const [rr, a0, a1] of [
    [0.9, 268, 296],
    [0.82, 272, 292],
    [0.74, 276, 290],
  ]) {
    ctx.beginPath();
    ctx.arc(0, 0, rr * R, (a0 * Math.PI) / 180, (a1 * Math.PI) / 180);
    ctx.stroke();
  }
  const spot = ctx.createRadialGradient(-0.48 * R, -0.5 * R, 0, -0.48 * R, -0.5 * R, 0.2 * R);
  spot.addColorStop(0, "rgba(255,255,255,0.75)");
  spot.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(-R, -R, 2 * R, 2 * R);
  // small rim light bottom-right
  ctx.strokeStyle = "rgba(225,250,255,0.55)";
  ctx.lineWidth = 0.03 * R;
  ctx.beginPath();
  ctx.arc(0, 0, 0.9 * R, (20 * Math.PI) / 180, (75 * Math.PI) / 180);
  ctx.stroke();

  // --- "H2" label -----------------------------------------------------------
  const big = 0.66 * R;
  const small = 0.42 * R;
  ctx.fillStyle = pal.label;
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${big}px ${FONT_FAMILY}, sans-serif`;
  const wH = ctx.measureText("H").width;
  ctx.font = `700 ${small}px ${FONT_FAMILY}, sans-serif`;
  const w2 = ctx.measureText("2").width;
  const total = wH + 0.04 * R + w2;
  const x0 = -total / 2;
  const baseline = 0.36 * big;
  ctx.font = `700 ${big}px ${FONT_FAMILY}, sans-serif`;
  ctx.fillText("H", x0, baseline);
  ctx.font = `700 ${small}px ${FONT_FAMILY}, sans-serif`;
  ctx.fillText("2", x0 + wH + 0.04 * R, baseline + 0.12 * R);
};

export const makeAtomSprite = (R: number, pal: Palette): AtomSprite => {
  const half = Math.ceil(R * 1.04) + 2;
  const canvas = makeCanvas(half * 2, half * 2);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.translate(half, half);
  drawAtom(ctx, R, pal);
  return { canvas, r: R, half };
};

export type SpriteSet = AtomSprite[];

/** Mip chain: the closest level >= target size is drawn with bilinear filtering. */
const LEVELS = [6, 9, 12, 16, 22, 30, 40, 54, 72, 96, 128, 170, 230, 310];

export const makeSpriteSet = (pal: Palette): SpriteSet => LEVELS.map((r) => makeAtomSprite(r, pal));

export const pickSprite = (set: SpriteSet, rPx: number) => {
  for (const sp of set) if (sp.r >= rPx) return sp;
  return set[set.length - 1];
};
