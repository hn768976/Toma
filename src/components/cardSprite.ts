import {CARD, CARD_RADIUS} from '../geometry';
import {withAlpha, type Theme} from '../theme';

/** Room around the card for the baked border glow. */
export const CARD_PAD = 62;
export const CARD_BOX = CARD + CARD_PAD * 2;

const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

/** Just the lower and right edges, for the heavier weighted stroke. */
const lowerRightPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
};

/**
 * One rounded-square card: frosted fill, bright glowing border weighted toward
 * the lower and right edges. Built once and blitted for every node.
 */
export const makeCardSprite = (theme: Theme): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = CARD_BOX;
  c.height = CARD_BOX;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  const x = CARD_PAD;
  const y = CARD_PAD;
  const r = CARD_RADIUS;

  // Frosted fill.
  roundRectPath(ctx, x, y, CARD, CARD, r);
  ctx.fillStyle = withAlpha(theme.nodeFill, 0.45);
  ctx.fill();

  // Sheen so the glass reads as lit from the upper left.
  const sheen = ctx.createLinearGradient(x, y, x + CARD, y + CARD);
  sheen.addColorStop(0, withAlpha(theme.nodeBorder, 0.14));
  sheen.addColorStop(0.5, withAlpha(theme.nodeBorder, 0.03));
  sheen.addColorStop(1, withAlpha(theme.nodeFill, 0.22));
  ctx.fillStyle = sheen;
  ctx.fill();

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Outer bloom.
  roundRectPath(ctx, x, y, CARD, CARD, r);
  ctx.shadowColor = withAlpha(theme.nodeBorder, 0.9);
  ctx.shadowBlur = 40;
  ctx.lineWidth = 5;
  ctx.strokeStyle = withAlpha(theme.nodeBorder, 0.55);
  ctx.stroke();
  ctx.stroke();

  // Base border.
  ctx.shadowBlur = 14;
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = theme.nodeBorder;
  ctx.stroke();

  // Heavier lower and right edges.
  lowerRightPath(ctx, x, y, CARD, CARD, r);
  ctx.shadowBlur = 34;
  ctx.lineWidth = 9.5;
  ctx.strokeStyle = theme.nodeBorder;
  ctx.stroke();

  ctx.shadowBlur = 0;
  return c;
};
