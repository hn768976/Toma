import { BUBBLE_WHITE } from "./constants";
import type { Bubble, Speck } from "./bubbles";

export type Sprite = {
  canvas: HTMLCanvasElement;
  /** Offset from the sprite's top-left to the bubble body's centre. */
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

/**
 * One continuous path for the rounded body *and* its tail, so the outline
 * style can stroke the silhouette without drawing an internal seam where the
 * tail meets the body.
 */
const traceBubble = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  bodyH: number,
  r: number,
  tailSide: "left" | "right",
  tailW: number,
  tailH: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + bodyH - r);
  ctx.quadraticCurveTo(x + w, y + bodyH, x + w - r, y + bodyH);

  // Bottom edge, travelling right to left, interrupted by the tail.
  if (tailSide === "right") {
    ctx.lineTo(x + w, y + bodyH + tailH);
    ctx.lineTo(Math.max(x + r, x + w - r - tailW), y + bodyH);
  } else {
    ctx.lineTo(Math.min(x + w - r, x + r + tailW), y + bodyH);
    ctx.lineTo(x, y + bodyH + tailH);
  }

  ctx.lineTo(x + r, y + bodyH);
  ctx.quadraticCurveTo(x, y + bodyH, x, y + bodyH - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawTextLines = (
  ctx: CanvasRenderingContext2D,
  bubble: Bubble,
  x: number,
  y: number,
  stroke: string,
) => {
  const { bodyHeight, bodyWidth, lines, lineThickness, padX } = bubble;
  const gap = lineThickness * 1.15;
  const total = lines.length * lineThickness + (lines.length - 1) * gap;
  const innerWidth = bodyWidth - padX * 2;

  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineThickness;
  ctx.lineCap = "round";

  let lineY = y + (bodyHeight - total) / 2 + lineThickness / 2;
  for (const line of lines) {
    const length = Math.max(lineThickness, innerWidth * line.width);
    ctx.beginPath();
    ctx.moveTo(x + padX, lineY);
    ctx.lineTo(x + padX + length, lineY);
    ctx.stroke();
    lineY += lineThickness + gap;
  }
};

// One fill style throughout: flat blue with white text lines. Depth alone
// separates the bubbles — near ones deep, distant ones pale.
const paintBubble = (ctx: CanvasRenderingContext2D, bubble: Bubble, pad: number) => {
  const { bodyWidth, bodyHeight, cornerRadius, tailSide, tailWidth, tailHeight, color } =
    bubble;

  traceBubble(
    ctx,
    pad,
    pad,
    bodyWidth,
    bodyHeight,
    cornerRadius,
    tailSide,
    tailWidth,
    tailHeight,
  );
  ctx.fillStyle = color;
  ctx.fill();
  drawTextLines(ctx, bubble, pad, pad, BUBBLE_WHITE);
};

/**
 * Each unique bubble is rasterised once, at its final on-screen size, with its
 * depth blur baked in. Per frame we only blit the result under a transform —
 * re-tracing the rounded rect, tail and text lines 38 times a frame at 4K
 * would be far too slow, and the blur is constant per bubble anyway.
 */
export const buildBubbleSprite = (bubble: Bubble): Sprite | null => {
  const pad = Math.ceil(bubble.blur * 3) + 4;
  const w = bubble.bodyWidth + pad * 2;
  const h = bubble.bodyHeight + bubble.tailHeight + pad * 2;

  const canvas = createCanvas(w, h);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const anchorX = pad + bubble.bodyWidth / 2;
  const anchorY = pad + bubble.bodyHeight / 2;

  if (bubble.blur <= 0.01) {
    paintBubble(ctx, bubble, pad);
    return { canvas, anchorX, anchorY };
  }

  // Blur the composed silhouette, not each fill/stroke separately — otherwise
  // the text lines bleed through the body edge.
  const crisp = createCanvas(w, h);
  if (!crisp) return null;
  const crispCtx = crisp.getContext("2d");
  if (!crispCtx) return null;
  paintBubble(crispCtx, bubble, pad);

  ctx.filter = `blur(${bubble.blur}px)`;
  ctx.drawImage(crisp, 0, 0);
  ctx.filter = "none";

  return { canvas, anchorX, anchorY };
};

export const buildSpeckSprite = (speck: Speck): Sprite | null => {
  const pad = Math.ceil(speck.blur * 3) + 3;
  const size = speck.size;
  const side = size + pad * 2;

  const canvas = createCanvas(side, side);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const paint = (target: CanvasRenderingContext2D) => {
    const r = speck.radius;
    target.beginPath();
    target.moveTo(pad + r, pad);
    target.lineTo(pad + size - r, pad);
    target.quadraticCurveTo(pad + size, pad, pad + size, pad + r);
    target.lineTo(pad + size, pad + size - r);
    target.quadraticCurveTo(pad + size, pad + size, pad + size - r, pad + size);
    target.lineTo(pad + r, pad + size);
    target.quadraticCurveTo(pad, pad + size, pad, pad + size - r);
    target.lineTo(pad, pad + r);
    target.quadraticCurveTo(pad, pad, pad + r, pad);
    target.closePath();
    target.fillStyle = speck.color;
    target.fill();
  };

  if (speck.blur <= 0.01) {
    paint(ctx);
    return { canvas, anchorX: side / 2, anchorY: side / 2 };
  }

  const crisp = createCanvas(side, side);
  if (!crisp) return null;
  const crispCtx = crisp.getContext("2d");
  if (!crispCtx) return null;
  paint(crispCtx);

  ctx.filter = `blur(${speck.blur}px)`;
  ctx.drawImage(crisp, 0, 0);
  ctx.filter = "none";

  return { canvas, anchorX: side / 2, anchorY: side / 2 };
};
