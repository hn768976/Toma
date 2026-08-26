import { BAR_BLUE, SHADOW_COLOR } from "./constants";
import type { BadgeArt, BubbleArt, Icon } from "./icons";

export type Sprite = {
  canvas: HTMLCanvasElement;
  /** Offset from the sprite's top-left to the icon body's centre. */
  anchorX: number;
  anchorY: number;
};

const createCanvas = (w: number, h: number) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
  return canvas;
};

// Shadow geometry, as a fraction of the icon's leading dimension. The reference
// icons sit on a soft, slightly offset shadow — it is what lifts them off the
// blue rather than any glow.
const SHADOW_OFFSET_X = 0.02;
const SHADOW_OFFSET_Y = 0.06;
const SHADOW_BLUR = 0.05;

const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
};

/**
 * Body and tail as one continuous path. The tail hangs off the bottom-right
 * corner and leans a little further right — that is the shape the reference
 * uses on every legible bubble, so it is not varied per icon here.
 */
const traceBubble = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  art: BubbleArt,
) => {
  const { bodyWidth: w, bodyHeight: h, cornerRadius: r, tailWidth, tailHeight, tailOut } = art;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);

  // Tail, then the rest of the bottom edge travelling right to left.
  ctx.lineTo(x + w + tailOut, y + h + tailHeight);
  ctx.lineTo(Math.max(x + r, x + w - r - tailWidth), y + h);

  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

/**
 * The "like" glyph, laid out in a unit box and scaled to the badge. Three
 * rounded blocks — cuff, palm, and the thumb rising off the palm's left — union
 * into the silhouette because they are filled opaque in the same pass.
 */
const traceThumb = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: number,
) => {
  const u = (v: number) => v * side;
  roundRectPath(ctx, x + u(0), y + u(0.46), u(0.25), u(0.54), u(0.05));
  ctx.fill();
  roundRectPath(ctx, x + u(0.34), y + u(0.42), u(0.66), u(0.58), u(0.09));
  ctx.fill();
  roundRectPath(ctx, x + u(0.38), y + u(0), u(0.25), u(0.48), u(0.12));
  ctx.fill();
};

const drawBars = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  art: BubbleArt,
) => {
  const { bars, barThickness, barGap, padX, padTop, bodyWidth } = art;
  const innerWidth = bodyWidth - padX * 2;

  ctx.fillStyle = BAR_BLUE;
  let barY = y + padTop;
  for (const bar of bars) {
    // Square ends, hard edges — these are filled bars in the reference, not
    // round-capped strokes.
    ctx.fillRect(x + padX, barY, Math.max(1, innerWidth * bar.width), barThickness);
    barY += barThickness + barGap;
  }
};

/** Lay the soft offset shadow down first, under whatever traces the shape. */
const withShadow = (
  ctx: CanvasRenderingContext2D,
  size: number,
  trace: () => void,
) => {
  ctx.save();
  ctx.filter = `blur(${Math.max(0.5, size * SHADOW_BLUR)}px)`;
  ctx.translate(size * SHADOW_OFFSET_X, size * SHADOW_OFFSET_Y);
  trace();
  ctx.fillStyle = SHADOW_COLOR;
  ctx.fill();
  ctx.restore();
};

const paintBubble = (
  ctx: CanvasRenderingContext2D,
  icon: Icon,
  art: BubbleArt,
  x: number,
  y: number,
) => {
  withShadow(ctx, art.bodyWidth, () => traceBubble(ctx, x, y, art));
  traceBubble(ctx, x, y, art);
  ctx.fillStyle = icon.white;
  ctx.fill();
  drawBars(ctx, x, y, art);
};

const paintBadge = (
  ctx: CanvasRenderingContext2D,
  icon: Icon,
  art: BadgeArt,
  x: number,
  y: number,
) => {
  const r = art.diameter / 2;
  const traceDisc = () => {
    ctx.beginPath();
    ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
    ctx.closePath();
  };

  withShadow(ctx, art.diameter, traceDisc);
  traceDisc();
  ctx.fillStyle = icon.white;
  ctx.fill();

  const side = art.diameter * 0.52;
  ctx.fillStyle = BAR_BLUE;
  traceThumb(ctx, x + r - side / 2, y + r - side / 2 + art.diameter * 0.02, side);
};

const shadowPad = (size: number) =>
  Math.ceil(size * (SHADOW_OFFSET_Y + SHADOW_BLUR * 2));

/**
 * Each unique icon is rasterised once, at its final on-screen size, with both
 * its shadow and its depth blur baked in. Per frame we only blit the result
 * under a transform — re-tracing 36 icons at 4K every frame would be far too
 * slow, and neither the blur nor the shadow changes over the loop.
 */
export const buildIconSprite = (icon: Icon): Sprite | null => {
  const leading = icon.kind === "bubble" ? icon.art.bodyWidth : icon.art.diameter;
  const pad = Math.ceil(icon.blur * 3) + shadowPad(leading) + 4;

  const contentW =
    icon.kind === "bubble" ? icon.art.bodyWidth + icon.art.tailOut : icon.art.diameter;
  const contentH =
    icon.kind === "bubble"
      ? icon.art.bodyHeight + icon.art.tailHeight
      : icon.art.diameter;

  const w = contentW + pad * 2;
  const h = contentH + pad * 2;

  const canvas = createCanvas(w, h);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const anchorX =
    pad + (icon.kind === "bubble" ? icon.art.bodyWidth / 2 : icon.art.diameter / 2);
  const anchorY =
    pad + (icon.kind === "bubble" ? icon.art.bodyHeight / 2 : icon.art.diameter / 2);

  const paint = (target: CanvasRenderingContext2D) => {
    if (icon.kind === "bubble") paintBubble(target, icon, icon.art, pad, pad);
    else paintBadge(target, icon, icon.art, pad, pad);
  };

  if (icon.blur <= 0.01) {
    paint(ctx);
    return { canvas, anchorX, anchorY };
  }

  // Blur the composed icon, not each fill separately — otherwise the bars and
  // the glyph bleed through the body edge.
  const crisp = createCanvas(w, h);
  if (!crisp) return null;
  const crispCtx = crisp.getContext("2d");
  if (!crispCtx) return null;
  paint(crispCtx);

  ctx.filter = `blur(${icon.blur}px)`;
  ctx.drawImage(crisp, 0, 0);
  ctx.filter = "none";

  return { canvas, anchorX, anchorY };
};
