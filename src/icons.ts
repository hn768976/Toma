import type {IconId} from './workflows';

/**
 * Line-art icons drawn on a 100x100 grid. Each function only issues path
 * commands; stroke style, glow and colour are applied by <NodeIcon>.
 */
export type IconDraw = (ctx: CanvasRenderingContext2D) => void;

const rr = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
};

/** A page with a folded corner. */
const page = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  const fold = w * 0.28;
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - fold, y);
  ctx.lineTo(x + w, y + fold);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.moveTo(x + w - fold, y);
  ctx.lineTo(x + w - fold, y + fold);
  ctx.lineTo(x + w, y + fold);
};

const rules = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, rows: number, gap: number) => {
  for (let i = 0; i < rows; i++) {
    ctx.moveTo(x, y + i * gap);
    ctx.lineTo(x + w, y + i * gap);
  }
};

const check = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  ctx.moveTo(x, y);
  ctx.lineTo(x + s * 0.36, y + s * 0.38);
  ctx.lineTo(x + s, y - s * 0.42);
};

export const ICONS: Record<IconId, IconDraw> = {
  magnifierDoc: (ctx) => {
    page(ctx, 8, 10, 48, 62);
    rules(ctx, 18, 32, 22, 3, 11);
    ctx.moveTo(90, 62);
    ctx.arc(72, 62, 18, 0, Math.PI * 2);
    ctx.moveTo(85, 75);
    ctx.lineTo(97, 87);
  },

  robotHead: (ctx) => {
    ctx.moveTo(50, 8);
    ctx.lineTo(50, 20);
    ctx.moveTo(54, 8);
    ctx.arc(50, 8, 4, 0, Math.PI * 2);
    rr(ctx, 20, 20, 60, 52, 14);
    ctx.moveTo(41, 42);
    ctx.arc(37, 42, 4, 0, Math.PI * 2);
    ctx.moveTo(67, 42);
    ctx.arc(63, 42, 4, 0, Math.PI * 2);
    ctx.moveTo(38, 58);
    ctx.lineTo(62, 58);
    ctx.moveTo(20, 36);
    ctx.lineTo(10, 36);
    ctx.lineTo(10, 52);
    ctx.lineTo(20, 52);
    ctx.moveTo(80, 36);
    ctx.lineTo(90, 36);
    ctx.lineTo(90, 52);
    ctx.lineTo(80, 52);
    rr(ctx, 36, 78, 28, 14, 5);
  },

  appleChecklist: (ctx) => {
    // apple
    ctx.moveTo(26, 38);
    ctx.bezierCurveTo(13, 38, 7, 51, 11, 64);
    ctx.bezierCurveTo(15, 77, 24, 86, 31, 82);
    ctx.bezierCurveTo(35, 79.5, 39, 79.5, 43, 82);
    ctx.bezierCurveTo(50, 86, 59, 77, 63, 64);
    ctx.bezierCurveTo(67, 51, 61, 38, 48, 38);
    ctx.bezierCurveTo(44, 38, 42, 40, 37, 40);
    ctx.bezierCurveTo(32, 40, 30, 38, 26, 38);
    ctx.moveTo(37, 39);
    ctx.lineTo(37, 23);
    ctx.moveTo(37, 29);
    ctx.bezierCurveTo(45, 21, 54, 21, 57, 23);
    ctx.bezierCurveTo(55, 31, 46, 34, 38, 32);
    // checklist
    rr(ctx, 68, 28, 28, 46, 5);
    for (let i = 0; i < 3; i++) {
      const y = 41 + i * 13;
      check(ctx, 73, y, 6.5);
      ctx.moveTo(84, y - 1);
      ctx.lineTo(92, y - 1);
    }
  },

  personSilhouette: (ctx) => {
    ctx.moveTo(68, 34);
    ctx.arc(50, 34, 18, 0, Math.PI * 2);
    ctx.moveTo(16, 90);
    ctx.bezierCurveTo(16, 66, 32, 58, 50, 58);
    ctx.bezierCurveTo(68, 58, 84, 66, 84, 90);
  },

  docCheck: (ctx) => {
    page(ctx, 6, 10, 48, 60);
    rules(ctx, 16, 30, 24, 3, 11);
    ctx.moveTo(96, 68);
    ctx.arc(75, 68, 21, 0, Math.PI * 2);
    check(ctx, 64, 70, 21);
  },

  docStar: (ctx) => {
    page(ctx, 6, 10, 48, 60);
    rules(ctx, 16, 30, 24, 3, 11);
    const cx = 75;
    const cy = 68;
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 21 : 9;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  },

  docPen: (ctx) => {
    page(ctx, 6, 8, 48, 60);
    rules(ctx, 16, 28, 24, 3, 11);
    ctx.moveTo(54, 92);
    ctx.lineTo(60, 73);
    ctx.lineTo(87, 46);
    ctx.lineTo(96, 55);
    ctx.lineTo(69, 82);
    ctx.closePath();
    ctx.moveTo(81, 52);
    ctx.lineTo(90, 61);
  },

  stackedPages: (ctx) => {
    rr(ctx, 8, 8, 50, 60, 7);
    rr(ctx, 22, 21, 50, 60, 7);
    rr(ctx, 36, 34, 50, 60, 7);
    rules(ctx, 46, 58, 30, 2, 13);
  },

  checkCircle: (ctx) => {
    ctx.moveTo(88, 50);
    ctx.arc(50, 50, 38, 0, Math.PI * 2);
    check(ctx, 32, 52, 36);
  },

  arrowUpBox: (ctx) => {
    ctx.moveTo(14, 56);
    ctx.lineTo(14, 88);
    ctx.lineTo(86, 88);
    ctx.lineTo(86, 56);
    ctx.moveTo(50, 74);
    ctx.lineTo(50, 12);
    ctx.moveTo(28, 34);
    ctx.lineTo(50, 12);
    ctx.lineTo(72, 34);
  },

  barChart: (ctx) => {
    ctx.moveTo(14, 12);
    ctx.lineTo(14, 88);
    ctx.lineTo(92, 88);
    rr(ctx, 26, 58, 15, 28, 3);
    rr(ctx, 48, 38, 15, 48, 3);
    rr(ctx, 70, 22, 15, 64, 3);
  },
};
