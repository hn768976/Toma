// Vector paths for every non-alphabetic symbol in the notation library.
//
// These are drawn rather than taken from the font for two reasons: the
// stroke weight then matches the structural diagrams exactly (a uniform
// hairline), and there is no chance of a missing-glyph box appearing in a
// 4K master because a webfont subset happened not to carry U+222B.
//
// Everything is expressed relative to the current font size `s`, with the
// origin at the text baseline, y increasing downward.

import type { Fence, Sym } from "./ast";

/** Height of the maths axis above the baseline: where −, =, → sit. */
export const AXIS = 0.3;

/** Hairline weight for a given font size, floored so scripts stay visible. */
export const strokeFor = (s: number) => Math.max(2.2, 0.052 * s);

const line = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
};

/** Arrow head at (x, y) pointing along `dir` (+1 right, −1 left). */
const head = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: number,
  len: number,
  barbs: "both" | "upper" | "lower" = "both",
) => {
  const back = len * 0.92;
  const rise = len * 0.42;
  ctx.beginPath();
  if (barbs !== "lower") {
    ctx.moveTo(x - dir * back, y - rise);
    ctx.lineTo(x, y);
  }
  if (barbs !== "upper") {
    ctx.moveTo(x - dir * back, y + rise);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
};

export type SymbolSpec = {
  /** Advance width, including side bearings, as a multiple of font size. */
  w: number;
  /** Extent above the baseline, as a multiple of font size. */
  a: number;
  /** Extent below the baseline, as a multiple of font size. */
  d: number;
  draw: (ctx: CanvasRenderingContext2D, x: number, yb: number, s: number) => void;
};

/** Binary-operator layout: symbol body centred in its advance width. */
const binary = (
  bodyW: number,
  pad: number,
  a: number,
  d: number,
  body: (ctx: CanvasRenderingContext2D, cx: number, yb: number, s: number, w: number) => void,
): SymbolSpec => ({
  w: bodyW + pad * 2,
  a,
  d,
  draw: (ctx, x, yb, s) => body(ctx, x + pad * s, yb, s, bodyW * s),
});

export const SYMBOLS: Record<Sym, SymbolSpec> = {
  plus: binary(0.5, 0.21, 0.55, 0, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s;
    line(ctx, x, cy, x + w, cy);
    line(ctx, x + w / 2, cy - w / 2, x + w / 2, cy + w / 2);
  }),

  minus: binary(0.5, 0.21, 0.35, 0, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s;
    line(ctx, x, cy, x + w, cy);
  }),

  eq: binary(0.56, 0.2, 0.45, 0, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s;
    const g = 0.1 * s;
    line(ctx, x, cy - g, x + w, cy - g);
    line(ctx, x, cy + g, x + w, cy + g);
  }),

  neq: binary(0.56, 0.2, 0.6, 0.12, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s;
    const g = 0.1 * s;
    line(ctx, x, cy - g, x + w, cy - g);
    line(ctx, x, cy + g, x + w, cy + g);
    line(ctx, x + w * 0.72, cy - 0.3 * s, x + w * 0.28, cy + 0.3 * s);
  }),

  times: binary(0.38, 0.16, 0.48, 0, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s;
    line(ctx, x, cy - w / 2, x + w, cy + w / 2);
    line(ctx, x + w, cy - w / 2, x, cy + w / 2);
  }),

  cdot: binary(0.14, 0.09, 0.36, 0, (ctx, x, yb, s, w) => {
    ctx.beginPath();
    ctx.arc(x + w / 2, yb - AXIS * s, 0.055 * s, 0, Math.PI * 2);
    ctx.fill();
  }),

  pm: binary(0.5, 0.19, 0.55, 0.06, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s - 0.08 * s;
    line(ctx, x, cy, x + w, cy);
    line(ctx, x + w / 2, cy - w / 2, x + w / 2, cy + w / 2);
    line(ctx, x, yb + 0.04 * s, x + w, yb + 0.04 * s);
  }),

  approx: binary(0.56, 0.2, 0.48, 0, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s;
    for (const off of [-0.1 * s, 0.1 * s]) {
      ctx.beginPath();
      ctx.moveTo(x, cy + off);
      ctx.bezierCurveTo(
        x + w * 0.28,
        cy + off - 0.13 * s,
        x + w * 0.5,
        cy + off + 0.13 * s,
        x + w * 0.78,
        cy + off - 0.05 * s,
      );
      ctx.bezierCurveTo(
        x + w * 0.88,
        cy + off - 0.09 * s,
        x + w * 0.95,
        cy + off - 0.09 * s,
        x + w,
        cy + off - 0.06 * s,
      );
      ctx.stroke();
    }
  }),

  lt: binary(0.5, 0.2, 0.5, 0, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s;
    ctx.beginPath();
    ctx.moveTo(x + w, cy - 0.22 * s);
    ctx.lineTo(x, cy);
    ctx.lineTo(x + w, cy + 0.22 * s);
    ctx.stroke();
  }),

  gt: binary(0.5, 0.2, 0.5, 0, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s;
    ctx.beginPath();
    ctx.moveTo(x, cy - 0.22 * s);
    ctx.lineTo(x + w, cy);
    ctx.lineTo(x, cy + 0.22 * s);
    ctx.stroke();
  }),

  leq: binary(0.52, 0.2, 0.52, 0.12, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s - 0.05 * s;
    ctx.beginPath();
    ctx.moveTo(x + w, cy - 0.2 * s);
    ctx.lineTo(x, cy);
    ctx.lineTo(x + w, cy + 0.2 * s);
    ctx.stroke();
    line(ctx, x, cy + 0.34 * s, x + w, cy + 0.34 * s);
  }),

  geq: binary(0.52, 0.2, 0.52, 0.12, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s - 0.05 * s;
    ctx.beginPath();
    ctx.moveTo(x, cy - 0.2 * s);
    ctx.lineTo(x + w, cy);
    ctx.lineTo(x, cy + 0.2 * s);
    ctx.stroke();
    line(ctx, x, cy + 0.34 * s, x + w, cy + 0.34 * s);
  }),

  to: binary(0.82, 0.18, 0.42, 0, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s;
    line(ctx, x, cy, x + w, cy);
    head(ctx, x + w, cy, 1, 0.17 * s);
  }),

  // Reaction arrow — deliberately longer than "to" so a chemical equation
  // reads as two halves rather than a run of terms.
  yields: binary(1.25, 0.24, 0.42, 0, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s;
    line(ctx, x, cy, x + w, cy);
    head(ctx, x + w, cy, 1, 0.19 * s);
  }),

  equil: binary(1.25, 0.24, 0.5, 0.08, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s;
    const g = 0.09 * s;
    line(ctx, x, cy - g, x + w, cy - g);
    head(ctx, x + w, cy - g, 1, 0.19 * s, "upper");
    line(ctx, x, cy + g, x + w, cy + g);
    head(ctx, x, cy + g, -1, 0.19 * s, "lower");
  }),

  propto: binary(0.6, 0.12, 0.42, 0, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s;
    const h = 0.19 * s;
    ctx.beginPath();
    ctx.moveTo(x + w, cy - h);
    ctx.bezierCurveTo(x + w * 0.3, cy - h * 1.5, x, cy - h * 0.8, x + w * 0.12, cy);
    ctx.bezierCurveTo(x + w * 0.24, cy + h * 0.9, x + w * 0.55, cy + h * 0.4, x + w, cy + h);
    ctx.stroke();
  }),

  infty: binary(0.72, 0.11, 0.46, 0, (ctx, x, yb, s, w) => {
    const cy = yb - AXIS * s;
    const h = 0.2 * s;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, cy);
    ctx.bezierCurveTo(x + w * 0.34, cy - h * 1.4, x, cy - h * 1.1, x, cy);
    ctx.bezierCurveTo(x, cy + h * 1.1, x + w * 0.34, cy + h * 1.4, x + w / 2, cy);
    ctx.bezierCurveTo(x + w * 0.66, cy - h * 1.4, x + w, cy - h * 1.1, x + w, cy);
    ctx.bezierCurveTo(x + w, cy + h * 1.1, x + w * 0.66, cy + h * 1.4, x + w / 2, cy);
    ctx.stroke();
  }),

  // ∂ — a bowl with a hooked top, the shape a specialist expects rather
  // than an italic d.
  partial: {
    w: 0.56,
    a: 0.74,
    d: 0.02,
    draw: (ctx, x, yb, s) => {
      const l = x + 0.07 * s;
      const rr = x + 0.5 * s;
      const mid = (l + rr) / 2;
      ctx.beginPath();
      // Top hook, leaning right.
      ctx.moveTo(l + 0.03 * s, yb - 0.56 * s);
      ctx.bezierCurveTo(
        l + 0.1 * s,
        yb - 0.76 * s,
        rr,
        yb - 0.78 * s,
        rr - 0.02 * s,
        yb - 0.5 * s,
      );
      // Right side sweeping down into the bowl.
      ctx.bezierCurveTo(rr - 0.05 * s, yb - 0.28 * s, rr, yb - 0.16 * s, rr - 0.03 * s, yb - 0.1 * s);
      ctx.bezierCurveTo(rr - 0.12 * s, yb + 0.02 * s, l, yb + 0.02 * s, l, yb - 0.18 * s);
      ctx.bezierCurveTo(l, yb - 0.38 * s, mid, yb - 0.46 * s, rr - 0.02 * s, yb - 0.32 * s);
      ctx.stroke();
    },
  },

  nabla: {
    w: 0.66,
    a: 0.68,
    d: 0,
    draw: (ctx, x, yb, s) => {
      ctx.beginPath();
      ctx.moveTo(x + 0.05 * s, yb - 0.66 * s);
      ctx.lineTo(x + 0.61 * s, yb - 0.66 * s);
      ctx.lineTo(x + 0.33 * s, yb - 0.01 * s);
      ctx.closePath();
      ctx.stroke();
    },
  },

  // ℏ — the reduced Planck constant: an h with a bar through the ascender.
  hbar: {
    w: 0.56,
    a: 0.76,
    d: 0,
    draw: (ctx, x, yb, s) => {
      const stem = x + 0.14 * s;
      ctx.beginPath();
      ctx.moveTo(stem, yb - 0.72 * s);
      ctx.lineTo(stem, yb);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(stem, yb - 0.34 * s);
      ctx.bezierCurveTo(
        stem + 0.1 * s,
        yb - 0.48 * s,
        x + 0.46 * s,
        yb - 0.48 * s,
        x + 0.46 * s,
        yb - 0.28 * s,
      );
      ctx.lineTo(x + 0.46 * s, yb);
      ctx.stroke();
      line(ctx, x + 0.01 * s, yb - 0.6 * s, x + 0.34 * s, yb - 0.66 * s);
    },
  },

  prime: {
    w: 0.2,
    a: 0.74,
    d: 0,
    draw: (ctx, x, yb, s) => {
      line(ctx, x + 0.12 * s, yb - 0.72 * s, x + 0.04 * s, yb - 0.44 * s);
    },
  },

  deg: {
    w: 0.28,
    a: 0.72,
    d: 0,
    draw: (ctx, x, yb, s) => {
      ctx.beginPath();
      ctx.arc(x + 0.14 * s, yb - 0.56 * s, 0.1 * s, 0, Math.PI * 2);
      ctx.stroke();
    },
  },

  cdots: {
    w: 0.72,
    a: 0.36,
    d: 0,
    draw: (ctx, x, yb, s) => {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x + (0.16 + i * 0.2) * s, yb - AXIS * s, 0.05 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
};

// ---------------------------------------------------------------------------
// Stretchy fences. `top` and `bot` are distances above / below the baseline.
// ---------------------------------------------------------------------------

/** Advance width of a fence stretched to height h (in px). */
export const fenceWidth = (f: Fence, h: number, s: number) => {
  if (f === "") return 0;
  if (f === "|") return Math.max(0.16 * s, h * 0.06);
  if (f === "{" || f === "}") return Math.max(0.3 * s, h * 0.15);
  if (f === "<" || f === ">") return Math.max(0.26 * s, h * 0.16);
  return Math.max(0.24 * s, h * 0.13);
};

export const drawFence = (
  ctx: CanvasRenderingContext2D,
  f: Fence,
  x: number,
  yb: number,
  top: number,
  bot: number,
  s: number,
) => {
  if (f === "") return;
  const h = top + bot;
  const w = fenceWidth(f, h, s);
  const t = yb - top;
  const b = yb + bot;
  const cy = (t + b) / 2;
  const inset = w * 0.16;

  switch (f) {
    case "|":
      line(ctx, x + w / 2, t, x + w / 2, b);
      return;
    case "(":
    case ")": {
      const dir = f === "(" ? 1 : -1;
      const near = f === "(" ? x + w - inset : x + inset;
      const far = near - dir * (w - inset * 2);
      ctx.beginPath();
      ctx.moveTo(near, t);
      ctx.bezierCurveTo(far, t + h * 0.22, far, b - h * 0.22, near, b);
      ctx.stroke();
      return;
    }
    case "[":
    case "]": {
      const dir = f === "[" ? 1 : -1;
      const spine = f === "[" ? x + inset : x + w - inset;
      const tip = spine + dir * (w - inset * 2);
      ctx.beginPath();
      ctx.moveTo(tip, t);
      ctx.lineTo(spine, t);
      ctx.lineTo(spine, b);
      ctx.lineTo(tip, b);
      ctx.stroke();
      return;
    }
    case "<":
    case ">": {
      const dir = f === "<" ? 1 : -1;
      const tipX = f === "<" ? x + inset : x + w - inset;
      const backX = tipX + dir * (w - inset * 2);
      ctx.beginPath();
      ctx.moveTo(backX, t);
      ctx.lineTo(tipX, cy);
      ctx.lineTo(backX, b);
      ctx.stroke();
      return;
    }
    case "{":
    case "}": {
      const dir = f === "{" ? 1 : -1;
      const tipX = f === "{" ? x + inset : x + w - inset;
      const backX = tipX + dir * (w - inset * 2);
      const midX = (tipX + backX) / 2;
      ctx.beginPath();
      ctx.moveTo(backX, t);
      ctx.bezierCurveTo(midX, t + h * 0.04, midX, t + h * 0.14, midX, cy - h * 0.06);
      ctx.quadraticCurveTo(midX, cy, tipX, cy);
      ctx.quadraticCurveTo(midX, cy, midX, cy + h * 0.06);
      ctx.bezierCurveTo(midX, b - h * 0.14, midX, b - h * 0.04, backX, b);
      ctx.stroke();
      return;
    }
  }
};

// ---------------------------------------------------------------------------
// Big operators, sized to the material they govern.
// ---------------------------------------------------------------------------

export const bigOpMetrics = (op: "int" | "sum" | "prod", s: number) => {
  if (op === "int") return { w: 0.62 * s, a: 1.15 * s, d: 0.42 * s };
  if (op === "sum") return { w: 0.98 * s, a: 0.94 * s, d: 0.26 * s };
  return { w: 0.98 * s, a: 0.92 * s, d: 0.24 * s };
};

export const drawBigOp = (
  ctx: CanvasRenderingContext2D,
  op: "int" | "sum" | "prod",
  x: number,
  yb: number,
  s: number,
) => {
  const m = bigOpMetrics(op, s);
  const top = yb - m.a;
  const bot = yb + m.d;
  if (op === "int") {
    const cx = x + m.w * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + m.w * 0.34, top + s * 0.1);
    ctx.bezierCurveTo(
      cx + m.w * 0.3,
      top - s * 0.06,
      cx - m.w * 0.06,
      top - s * 0.02,
      cx + m.w * 0.02,
      top + s * 0.3,
    );
    ctx.bezierCurveTo(
      cx + m.w * 0.16,
      yb - s * 0.1,
      cx - m.w * 0.16,
      yb + s * 0.1,
      cx - m.w * 0.02,
      bot - s * 0.3,
    );
    ctx.bezierCurveTo(
      cx + m.w * 0.06,
      bot + s * 0.02,
      cx - m.w * 0.3,
      bot + s * 0.06,
      cx - m.w * 0.34,
      bot - s * 0.1,
    );
    ctx.stroke();
    return;
  }
  if (op === "sum") {
    const l = x + m.w * 0.06;
    const rr = x + m.w * 0.94;
    ctx.beginPath();
    ctx.moveTo(rr, top + m.a * 0.22);
    ctx.lineTo(rr, top);
    ctx.lineTo(l, top);
    ctx.lineTo(x + m.w * 0.5, (top + bot) / 2);
    ctx.lineTo(l, bot);
    ctx.lineTo(rr, bot);
    ctx.lineTo(rr, bot - m.d * 0.9 - m.a * 0.12);
    ctx.stroke();
    return;
  }
  // ∏
  const l = x + m.w * 0.1;
  const rr = x + m.w * 0.9;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x + m.w, top);
  ctx.moveTo(l, top);
  ctx.lineTo(l, bot);
  ctx.moveTo(rr, top);
  ctx.lineTo(rr, bot);
  ctx.stroke();
};

/** Radical sign: hook, rising stroke, then an overbar of length `barW`. */
export const drawRadical = (
  ctx: CanvasRenderingContext2D,
  x: number,
  yTop: number,
  yBot: number,
  barW: number,
  s: number,
) => {
  const h = yBot - yTop;
  const hookW = 0.5 * s;
  ctx.beginPath();
  ctx.moveTo(x, yBot - h * 0.42);
  ctx.lineTo(x + hookW * 0.3, yBot - h * 0.32);
  ctx.lineTo(x + hookW * 0.56, yBot);
  ctx.lineTo(x + hookW, yTop);
  ctx.lineTo(x + hookW + barW, yTop);
  ctx.stroke();
};

export const RADICAL_HOOK = 0.5;
