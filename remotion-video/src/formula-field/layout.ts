// A miniature TeX-style layout engine.
//
// `lay()` measures a Node and returns its box together with a closure that
// paints it at a given baseline. Measuring and painting share one traversal
// so the two can never drift apart, and because a glyph is only ever laid
// out once (into its offscreen sprite) the closure allocation is free.

import type { Fence, Node } from "./ast";
import {
  AXIS,
  RADICAL_HOOK,
  SYMBOLS,
  bigOpMetrics,
  drawBigOp,
  drawFence,
  drawRadical,
  fenceWidth,
  strokeFor,
} from "./symbols";
import { FONT_FAMILY, FONT_WEIGHT } from "./fonts";

/** Nominal ascent / descent of the font, as multiples of the font size. */
const ASC = 0.74;
const DESC = 0.24;
/** Sub- and superscripts are set at 60% of the base character size. */
export const SCRIPT = 0.6;
const SUB_DROP = 0.21;
const SUP_RISE = 0.47;

export type Laid = {
  w: number;
  /** Extent above the baseline. */
  a: number;
  /** Extent below the baseline. */
  d: number;
  draw: (ctx: CanvasRenderingContext2D, x: number, yb: number) => void;
};

const fontString = (s: number, it: boolean) =>
  `${it ? "italic " : ""}${FONT_WEIGHT} ${s}px "${FONT_FAMILY}", "Helvetica Neue", Arial, sans-serif`;

const EMPTY: Laid = { w: 0, a: 0, d: 0, draw: () => undefined };

export const lay = (ctx: CanvasRenderingContext2D, node: Node, s: number): Laid => {
  switch (node.t) {
    case "row": {
      const parts = node.k.map((c) => lay(ctx, c, s));
      const w = parts.reduce((acc, p) => acc + p.w, 0);
      const a = Math.max(0, ...parts.map((p) => p.a));
      const d = Math.max(0, ...parts.map((p) => p.d));
      return {
        w,
        a,
        d,
        draw: (c, x, yb) => {
          let cx = x;
          for (const p of parts) {
            p.draw(c, cx, yb);
            cx += p.w;
          }
        },
      };
    }

    case "txt": {
      const it = node.it ?? false;
      ctx.font = fontString(s, it);
      const w = ctx.measureText(node.s).width;
      return {
        w,
        a: ASC * s,
        d: DESC * s,
        draw: (c, x, yb) => {
          c.font = fontString(s, it);
          c.textAlign = "left";
          c.textBaseline = "alphabetic";
          c.fillText(node.s, x, yb);
        },
      };
    }

    case "sym": {
      const spec = SYMBOLS[node.s];
      return {
        w: spec.w * s,
        a: spec.a * s,
        d: spec.d * s,
        draw: (c, x, yb) => {
          c.lineWidth = strokeFor(s);
          spec.draw(c, x, yb, s);
        },
      };
    }

    case "sub": {
      const b = lay(ctx, node.b, s);
      const sc = lay(ctx, node.s, s * SCRIPT);
      const drop = SUB_DROP * s;
      const kern = 0.015 * s;
      return {
        w: b.w + kern + sc.w,
        a: b.a,
        d: Math.max(b.d, drop + sc.d),
        draw: (c, x, yb) => {
          b.draw(c, x, yb);
          sc.draw(c, x + b.w + kern, yb + drop);
        },
      };
    }

    case "sup": {
      const b = lay(ctx, node.b, s);
      const sc = lay(ctx, node.p, s * SCRIPT);
      const rise = SUP_RISE * s;
      const kern = 0.015 * s;
      return {
        w: b.w + kern + sc.w,
        a: Math.max(b.a, rise + sc.a),
        d: b.d,
        draw: (c, x, yb) => {
          b.draw(c, x, yb);
          sc.draw(c, x + b.w + kern, yb - rise);
        },
      };
    }

    case "subsup": {
      const b = lay(ctx, node.b, s);
      const lo = lay(ctx, node.s, s * SCRIPT);
      const hi = lay(ctx, node.p, s * SCRIPT);
      const drop = SUB_DROP * s;
      const rise = SUP_RISE * s;
      const kern = 0.015 * s;
      return {
        w: b.w + kern + Math.max(lo.w, hi.w),
        a: Math.max(b.a, rise + hi.a),
        d: Math.max(b.d, drop + lo.d),
        draw: (c, x, yb) => {
          b.draw(c, x, yb);
          lo.draw(c, x + b.w + kern, yb + drop);
          hi.draw(c, x + b.w + kern, yb - rise);
        },
      };
    }

    case "frac": {
      const nu = lay(ctx, node.n, s);
      const de = lay(ctx, node.d, s);
      const axis = AXIS * s;
      const gap = 0.13 * s;
      const rule = Math.max(2.2, 0.05 * s);
      const pad = 0.14 * s;
      const w = Math.max(nu.w, de.w) + pad * 2;
      return {
        w,
        a: axis + gap + nu.d + nu.a,
        d: -axis + gap + rule + de.a + de.d,
        draw: (c, x, yb) => {
          const inner = w - pad * 2;
          nu.draw(c, x + pad + (inner - nu.w) / 2, yb - axis - gap - nu.d);
          de.draw(c, x + pad + (inner - de.w) / 2, yb - axis + gap + rule + de.a);
          c.lineWidth = rule;
          c.beginPath();
          c.moveTo(x + pad * 0.35, yb - axis);
          c.lineTo(x + w - pad * 0.35, yb - axis);
          c.stroke();
        },
      };
    }

    case "sqrt": {
      const b = lay(ctx, node.b, s);
      const hook = RADICAL_HOOK * s;
      const overhang = 0.12 * s;
      const bearing = 0.08 * s;
      const lift = 0.2 * s;
      const a = b.a + lift;
      const d = b.d + 0.04 * s;
      return {
        w: bearing + hook + b.w + overhang,
        a,
        d,
        draw: (c, x, yb) => {
          c.lineWidth = strokeFor(s);
          drawRadical(c, x + bearing, yb - a, yb + d, b.w + overhang, s);
          b.draw(c, x + bearing + hook + overhang * 0.4, yb);
        },
      };
    }

    case "big": {
      const m = bigOpMetrics(node.op, s);
      const ss = s * SCRIPT;
      const lo = node.lo ? lay(ctx, node.lo, ss) : EMPTY;
      const hi = node.hi ? lay(ctx, node.hi, ss) : EMPTY;
      if (node.side) {
        const limW = Math.max(lo.w, hi.w);
        const gap = 0.05 * s;
        return {
          w: m.w + gap + limW + 0.1 * s,
          a: Math.max(m.a, m.a - 0.1 * s + hi.a),
          d: Math.max(m.d, m.d - 0.05 * s + lo.d),
          draw: (c, x, yb) => {
            c.lineWidth = strokeFor(s) * 1.05;
            drawBigOp(c, node.op, x, yb, s);
            hi.draw(c, x + m.w + gap, yb - m.a + 0.16 * s);
            lo.draw(c, x + m.w + gap, yb + m.d - 0.02 * s);
          },
        };
      }
      const w = Math.max(m.w, lo.w, hi.w);
      const gap = 0.11 * s;
      return {
        w: w + 0.1 * s,
        a: m.a + (node.hi ? gap + hi.d + hi.a : 0),
        d: m.d + (node.lo ? gap + lo.a + lo.d : 0),
        draw: (c, x, yb) => {
          const cx = x + 0.05 * s;
          c.lineWidth = strokeFor(s) * 1.05;
          drawBigOp(c, node.op, cx + (w - m.w) / 2, yb, s);
          if (node.hi) hi.draw(c, cx + (w - hi.w) / 2, yb - m.a - gap - hi.d);
          if (node.lo) lo.draw(c, cx + (w - lo.w) / 2, yb + m.d + gap + lo.a);
        },
      };
    }

    case "fence": {
      const b = lay(ctx, node.b, s);
      const top = Math.max(b.a, ASC * s) + 0.06 * s;
      const bot = Math.max(b.d, DESC * s) + 0.06 * s;
      const h = top + bot;
      const ow = fenceWidth(node.o, h, s);
      const cw = fenceWidth(node.c, h, s);
      const gap = 0.05 * s;
      return {
        w: ow + (ow ? gap : 0) + b.w + (cw ? gap : 0) + cw,
        a: top,
        d: bot,
        draw: (c, x, yb) => {
          c.lineWidth = strokeFor(s);
          drawFence(c, node.o, x, yb, top, bot, s);
          b.draw(c, x + ow + (ow ? gap : 0), yb);
          drawFence(c, node.c, x + ow + (ow ? gap : 0) + b.w + (cw ? gap : 0), yb, top, bot, s);
        },
      };
    }

    case "mat": {
      const cs = s * 0.94;
      const cells = node.rows.map((row) => row.map((cell) => lay(ctx, cell, cs)));
      const cols = Math.max(...cells.map((row) => row.length));
      const colW: number[] = [];
      for (let i = 0; i < cols; i++) {
        colW.push(Math.max(...cells.map((row) => row[i]?.w ?? 0)));
      }
      const rowA = cells.map((row) => Math.max(0, ...row.map((c) => c.a)));
      const rowD = cells.map((row) => Math.max(0, ...row.map((c) => c.d)));
      const colGap = 0.44 * s;
      const rowGap = 0.3 * s;
      const bodyW = colW.reduce((acc, w) => acc + w, 0) + colGap * (cols - 1);
      const bodyH =
        rowA.reduce((acc, v, i) => acc + v + rowD[i], 0) + rowGap * (cells.length - 1);
      const axis = AXIS * s;
      const top = bodyH / 2 + axis + 0.08 * s;
      const bot = bodyH / 2 - axis + 0.08 * s;
      const ow = fenceWidth(node.o, top + bot, s);
      const cw = fenceWidth(node.c, top + bot, s);
      const pad = 0.12 * s;
      return {
        w: ow + pad + bodyW + pad + cw,
        a: top,
        d: bot,
        draw: (c, x, yb) => {
          c.lineWidth = strokeFor(s);
          drawFence(c, node.o, x, yb, top, bot, s);
          let cy = yb - bodyH / 2 - axis + 0.08 * s;
          cells.forEach((row, ri) => {
            cy += rowA[ri];
            let cx = x + ow + pad;
            row.forEach((cell, ci) => {
              cell.draw(c, cx + (colW[ci] - cell.w) / 2, cy);
              cx += colW[ci] + colGap;
            });
            cy += rowD[ri] + rowGap;
          });
          drawFence(c, node.c, x + ow + pad + bodyW + pad, yb, top, bot, s);
        },
      };
    }

    case "cases": {
      const cs = s * 0.9;
      const left = node.rows.map(([e]) => lay(ctx, e, cs));
      const right = node.rows.map(([, cnd]) => lay(ctx, cnd, cs));
      const lw = Math.max(...left.map((l) => l.w));
      const rowGap = 0.34 * s;
      const heights = node.rows.map((_, i) =>
        Math.max(left[i].a, right[i].a) + Math.max(left[i].d, right[i].d),
      );
      const bodyH = heights.reduce((a, b) => a + b, 0) + rowGap * (node.rows.length - 1);
      const axis = AXIS * s;
      const top = bodyH / 2 + axis + 0.06 * s;
      const bot = bodyH / 2 - axis + 0.06 * s;
      const bw = fenceWidth("{", top + bot, s);
      const colGap = 0.5 * s;
      const rw = Math.max(...right.map((l) => l.w));
      return {
        w: bw + 0.16 * s + lw + colGap + rw,
        a: top,
        d: bot,
        draw: (c, x, yb) => {
          c.lineWidth = strokeFor(s);
          drawFence(c, "{", x, yb, top, bot, s);
          let cy = yb - bodyH / 2 - axis + 0.06 * s;
          node.rows.forEach((_, i) => {
            cy += Math.max(left[i].a, right[i].a);
            left[i].draw(c, x + bw + 0.16 * s, cy);
            right[i].draw(c, x + bw + 0.16 * s + lw + colGap, cy);
            cy += Math.max(left[i].d, right[i].d) + rowGap;
          });
        },
      };
    }

    case "acc": {
      const b = lay(ctx, node.b, s);
      const lift = b.a + 0.11 * s;
      const extra = node.a === "vec" ? 0.2 * s : 0.16 * s;
      return {
        w: b.w,
        a: b.a + extra,
        d: b.d,
        draw: (c, x, yb) => {
          b.draw(c, x, yb);
          c.lineWidth = strokeFor(s) * 0.9;
          const y = yb - lift;
          const w = Math.max(b.w, 0.3 * s);
          const cx = x + b.w / 2;
          if (node.a === "vec") {
            c.beginPath();
            c.moveTo(cx - w / 2, y);
            c.lineTo(cx + w / 2, y);
            c.stroke();
            c.beginPath();
            c.moveTo(cx + w / 2 - 0.11 * s, y - 0.07 * s);
            c.lineTo(cx + w / 2, y);
            c.lineTo(cx + w / 2 - 0.11 * s, y + 0.07 * s);
            c.stroke();
          } else if (node.a === "bar") {
            c.beginPath();
            c.moveTo(cx - w / 2, y);
            c.lineTo(cx + w / 2, y);
            c.stroke();
          } else {
            c.beginPath();
            c.moveTo(cx - w * 0.36, y);
            c.lineTo(cx, y - 0.13 * s);
            c.lineTo(cx + w * 0.36, y);
            c.stroke();
          }
        },
      };
    }

    case "binom": {
      const nu = lay(ctx, node.n, s * 0.94);
      const de = lay(ctx, node.k, s * 0.94);
      const axis = AXIS * s;
      const gap = 0.1 * s;
      const bodyW = Math.max(nu.w, de.w);
      const top = axis + gap + nu.d + nu.a + 0.06 * s;
      const bot = -axis + gap + de.a + de.d + 0.06 * s;
      const fw = fenceWidth("(", top + bot, s);
      const pad = 0.1 * s;
      return {
        w: fw * 2 + pad * 2 + bodyW,
        a: top,
        d: bot,
        draw: (c, x, yb) => {
          c.lineWidth = strokeFor(s);
          drawFence(c, "(", x, yb, top, bot, s);
          nu.draw(c, x + fw + pad + (bodyW - nu.w) / 2, yb - axis - gap - nu.d);
          de.draw(c, x + fw + pad + (bodyW - de.w) / 2, yb - axis + gap + de.a);
          drawFence(c, ")", x + fw + pad * 2 + bodyW, yb, top, bot, s);
        },
      };
    }

    case "under": {
      const b = lay(ctx, node.b, s);
      const u = lay(ctx, node.u, s * SCRIPT);
      const gap = 0.1 * s;
      const w = Math.max(b.w, u.w);
      return {
        w,
        a: b.a,
        d: b.d + gap + u.a + u.d,
        draw: (c, x, yb) => {
          b.draw(c, x + (w - b.w) / 2, yb);
          u.draw(c, x + (w - u.w) / 2, yb + b.d + gap + u.a);
        },
      };
    }

    case "sp":
      return { w: node.w * s, a: 0, d: 0, draw: () => undefined };

    case "sc":
      return lay(ctx, node.b, s * node.f);
  }
};

/** Convenience for callers that only need the outer box. */
export const measure = (ctx: CanvasRenderingContext2D, node: Node, s: number) => {
  const l = lay(ctx, node, s);
  return { w: l.w, h: l.a + l.d, a: l.a, d: l.d };
};

export type { Fence };
