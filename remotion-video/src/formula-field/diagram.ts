// Structural-drawing engine.
//
// Chemistry skeletal structures and physics diagrams are both described as a
// short list of vector commands in a local coordinate space; this module
// measures that list into a bounding box and paints it. Labels are laid out
// with the same expression engine the equations use, so H₂O in a diagram and
// H₂O in an equation are set identically.

import type { Node } from "./ast";
import { lay } from "./layout";

export type P = [number, number];

export type Anchor = "c" | "l" | "r" | "t" | "b";

export type Cmd =
  | { c: "line"; a: P; b: P; dash?: number[] }
  | { c: "poly"; p: P[]; close?: boolean; dash?: number[] }
  /**
   * A chemical bond. `order` 2 or 3 draws the extra lines; `toward` offsets
   * the second line of a double bond to the inside of a ring, which is the
   * convention skeletal formulae are read with.
   */
  | { c: "bond"; a: P; b: P; order?: 1 | 2 | 3; toward?: P }
  | { c: "arrow"; a: P; b: P; headLen?: number; dash?: number[]; both?: boolean }
  /** Smooth curve through the given points, optionally arrow-headed. */
  | { c: "curve"; p: P[]; arrow?: boolean; dash?: number[] }
  | { c: "circle"; at: P; r: number; fill?: boolean }
  | { c: "rect"; at: P; w: number; h: number }
  | { c: "ellipse"; at: P; rx: number; ry: number }
  | { c: "arc"; at: P; r: number; from: number; to: number; arrow?: boolean }
  /** Helical spring between two points. */
  | { c: "coil"; a: P; b: P; turns: number; amp: number }
  /** Resistor zigzag between two points. */
  | { c: "zig"; a: P; b: P; teeth: number; amp: number }
  /** Battery / cell symbol centred on `at`, plates perpendicular to `dir`. */
  | { c: "cell"; at: P; dir: "h" | "v"; size: number }
  /** A laid-out expression placed in the drawing. */
  | {
      c: "lbl";
      at: P;
      e: Node;
      size?: number;
      anchor?: Anchor;
      /** Clear the strokes behind the label — how atom labels sit on a vertex. */
      knock?: boolean;
    };

export const DIAGRAM_STROKE = 4.6;
export const DIAGRAM_LABEL = 46;

const dist = (a: P, b: P) => Math.hypot(b[0] - a[0], b[1] - a[1]);

const unitNormal = (a: P, b: P): P => {
  const d = dist(a, b) || 1;
  return [-(b[1] - a[1]) / d, (b[0] - a[0]) / d];
};

const arrowHead = (
  ctx: CanvasRenderingContext2D,
  from: P,
  to: P,
  len: number,
) => {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const spread = 0.38;
  ctx.beginPath();
  ctx.moveTo(to[0] - len * Math.cos(ang - spread), to[1] - len * Math.sin(ang - spread));
  ctx.lineTo(to[0], to[1]);
  ctx.lineTo(to[0] - len * Math.cos(ang + spread), to[1] - len * Math.sin(ang + spread));
  ctx.stroke();
};

/** Catmull-Rom through the points, emitted as cubic beziers. */
const smooth = (ctx: CanvasRenderingContext2D, p: P[]) => {
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  if (p.length === 2) {
    ctx.lineTo(p[1][0], p[1][1]);
    return;
  }
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[0],
      p2[1],
    );
  }
};

type Box = { x0: number; y0: number; x1: number; y1: number };

const grow = (b: Box, x: number, y: number) => {
  b.x0 = Math.min(b.x0, x);
  b.y0 = Math.min(b.y0, y);
  b.x1 = Math.max(b.x1, x);
  b.y1 = Math.max(b.y1, y);
};

type LabelPlan = {
  cmd: Extract<Cmd, { c: "lbl" }>;
  laid: ReturnType<typeof lay>;
  x: number;
  yb: number;
  box: Box;
};

const anchorOffset = (
  anchor: Anchor,
  at: P,
  w: number,
  a: number,
  d: number,
): { x: number; yb: number } => {
  const h = a + d;
  switch (anchor) {
    case "l":
      return { x: at[0], yb: at[1] + h / 2 - d };
    case "r":
      return { x: at[0] - w, yb: at[1] + h / 2 - d };
    case "t":
      return { x: at[0] - w / 2, yb: at[1] + a };
    case "b":
      return { x: at[0] - w / 2, yb: at[1] - d };
    default:
      return { x: at[0] - w / 2, yb: at[1] + h / 2 - d };
  }
};

export type LaidDiagram = {
  w: number;
  h: number;
  /** Paint with the diagram's bounding box top-left placed at (ox, oy). */
  draw: (ctx: CanvasRenderingContext2D, ox: number, oy: number) => void;
};

export const layDiagram = (
  ctx: CanvasRenderingContext2D,
  cmds: Cmd[],
  stroke = DIAGRAM_STROKE,
): LaidDiagram => {
  const b: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const labels: LabelPlan[] = [];

  for (const cmd of cmds) {
    switch (cmd.c) {
      case "line":
      case "bond":
        grow(b, cmd.a[0], cmd.a[1]);
        grow(b, cmd.b[0], cmd.b[1]);
        break;
      case "arrow":
        grow(b, cmd.a[0], cmd.a[1]);
        grow(b, cmd.b[0], cmd.b[1]);
        break;
      case "poly":
      case "curve":
        for (const p of cmd.p) grow(b, p[0], p[1]);
        break;
      case "circle":
        grow(b, cmd.at[0] - cmd.r, cmd.at[1] - cmd.r);
        grow(b, cmd.at[0] + cmd.r, cmd.at[1] + cmd.r);
        break;
      case "arc":
        grow(b, cmd.at[0] - cmd.r, cmd.at[1] - cmd.r);
        grow(b, cmd.at[0] + cmd.r, cmd.at[1] + cmd.r);
        break;
      case "rect":
        grow(b, cmd.at[0] - cmd.w / 2, cmd.at[1] - cmd.h / 2);
        grow(b, cmd.at[0] + cmd.w / 2, cmd.at[1] + cmd.h / 2);
        break;
      case "ellipse":
        grow(b, cmd.at[0] - cmd.rx, cmd.at[1] - cmd.ry);
        grow(b, cmd.at[0] + cmd.rx, cmd.at[1] + cmd.ry);
        break;
      case "coil":
        grow(b, cmd.a[0], cmd.a[1] - cmd.amp);
        grow(b, cmd.b[0], cmd.b[1] + cmd.amp);
        grow(b, cmd.a[0], cmd.a[1] + cmd.amp);
        grow(b, cmd.b[0], cmd.b[1] - cmd.amp);
        break;
      case "zig":
        grow(b, cmd.a[0], cmd.a[1] - cmd.amp);
        grow(b, cmd.b[0], cmd.b[1] + cmd.amp);
        break;
      case "cell":
        grow(b, cmd.at[0] - cmd.size, cmd.at[1] - cmd.size);
        grow(b, cmd.at[0] + cmd.size, cmd.at[1] + cmd.size);
        break;
      case "lbl": {
        const size = cmd.size ?? DIAGRAM_LABEL;
        const laid = lay(ctx, cmd.e, size);
        const { x, yb } = anchorOffset(cmd.anchor ?? "c", cmd.at, laid.w, laid.a, laid.d);
        const lb: Box = { x0: x, y0: yb - laid.a, x1: x + laid.w, y1: yb + laid.d };
        labels.push({ cmd, laid, x, yb, box: lb });
        grow(b, lb.x0, lb.y0);
        grow(b, lb.x1, lb.y1);
        break;
      }
    }
  }

  const pad = stroke * 1.2;
  b.x0 -= pad;
  b.y0 -= pad;
  b.x1 += pad;
  b.y1 += pad;

  const draw = (c: CanvasRenderingContext2D, ox: number, oy: number) => {
    const dx = ox - b.x0;
    const dy = oy - b.y0;
    c.save();
    c.translate(dx, dy);
    c.lineWidth = stroke;
    c.lineCap = "round";
    c.lineJoin = "round";

    for (const cmd of cmds) {
      c.setLineDash([]);
      switch (cmd.c) {
        case "line": {
          if (cmd.dash) c.setLineDash(cmd.dash);
          c.beginPath();
          c.moveTo(cmd.a[0], cmd.a[1]);
          c.lineTo(cmd.b[0], cmd.b[1]);
          c.stroke();
          break;
        }
        case "poly": {
          if (cmd.dash) c.setLineDash(cmd.dash);
          c.beginPath();
          c.moveTo(cmd.p[0][0], cmd.p[0][1]);
          for (let i = 1; i < cmd.p.length; i++) c.lineTo(cmd.p[i][0], cmd.p[i][1]);
          if (cmd.close) c.closePath();
          c.stroke();
          break;
        }
        case "bond": {
          const order = cmd.order ?? 1;
          const nrm = unitNormal(cmd.a, cmd.b);
          const gap = stroke * 2.4;
          if (order === 1) {
            c.beginPath();
            c.moveTo(cmd.a[0], cmd.a[1]);
            c.lineTo(cmd.b[0], cmd.b[1]);
            c.stroke();
          } else if (order === 2) {
            if (cmd.toward) {
              // Inner line of a ring double bond: offset toward the centre
              // and shortened at both ends, as drawn in practice.
              const mid: P = [(cmd.a[0] + cmd.b[0]) / 2, (cmd.a[1] + cmd.b[1]) / 2];
              const sign =
                (cmd.toward[0] - mid[0]) * nrm[0] + (cmd.toward[1] - mid[1]) * nrm[1] >= 0 ? 1 : -1;
              c.beginPath();
              c.moveTo(cmd.a[0], cmd.a[1]);
              c.lineTo(cmd.b[0], cmd.b[1]);
              c.stroke();
              const t = 0.16;
              const ax = cmd.a[0] + (cmd.b[0] - cmd.a[0]) * t + sign * nrm[0] * gap;
              const ay = cmd.a[1] + (cmd.b[1] - cmd.a[1]) * t + sign * nrm[1] * gap;
              const bx = cmd.b[0] - (cmd.b[0] - cmd.a[0]) * t + sign * nrm[0] * gap;
              const by = cmd.b[1] - (cmd.b[1] - cmd.a[1]) * t + sign * nrm[1] * gap;
              c.beginPath();
              c.moveTo(ax, ay);
              c.lineTo(bx, by);
              c.stroke();
            } else {
              for (const sgn of [-1, 1]) {
                c.beginPath();
                c.moveTo(cmd.a[0] + nrm[0] * (gap / 2) * sgn, cmd.a[1] + nrm[1] * (gap / 2) * sgn);
                c.lineTo(cmd.b[0] + nrm[0] * (gap / 2) * sgn, cmd.b[1] + nrm[1] * (gap / 2) * sgn);
                c.stroke();
              }
            }
          } else {
            for (const sgn of [-1, 0, 1]) {
              c.beginPath();
              c.moveTo(cmd.a[0] + nrm[0] * gap * sgn, cmd.a[1] + nrm[1] * gap * sgn);
              c.lineTo(cmd.b[0] + nrm[0] * gap * sgn, cmd.b[1] + nrm[1] * gap * sgn);
              c.stroke();
            }
          }
          break;
        }
        case "arrow": {
          if (cmd.dash) c.setLineDash(cmd.dash);
          c.beginPath();
          c.moveTo(cmd.a[0], cmd.a[1]);
          c.lineTo(cmd.b[0], cmd.b[1]);
          c.stroke();
          c.setLineDash([]);
          const len = cmd.headLen ?? stroke * 4.2;
          arrowHead(c, cmd.a, cmd.b, len);
          if (cmd.both) arrowHead(c, cmd.b, cmd.a, len);
          break;
        }
        case "curve": {
          if (cmd.dash) c.setLineDash(cmd.dash);
          smooth(c, cmd.p);
          c.stroke();
          c.setLineDash([]);
          if (cmd.arrow) {
            const n = cmd.p.length;
            arrowHead(c, cmd.p[n - 2], cmd.p[n - 1], stroke * 4.2);
          }
          break;
        }
        case "circle": {
          c.beginPath();
          c.arc(cmd.at[0], cmd.at[1], cmd.r, 0, Math.PI * 2);
          if (cmd.fill) c.fill();
          else c.stroke();
          break;
        }
        case "arc": {
          c.beginPath();
          c.arc(cmd.at[0], cmd.at[1], cmd.r, cmd.from, cmd.to);
          c.stroke();
          if (cmd.arrow) {
            const t1 = cmd.to;
            const t0 = cmd.to - 0.12 * Math.sign(cmd.to - cmd.from);
            arrowHead(
              c,
              [cmd.at[0] + cmd.r * Math.cos(t0), cmd.at[1] + cmd.r * Math.sin(t0)],
              [cmd.at[0] + cmd.r * Math.cos(t1), cmd.at[1] + cmd.r * Math.sin(t1)],
              stroke * 3.6,
            );
          }
          break;
        }
        case "rect": {
          c.beginPath();
          c.rect(cmd.at[0] - cmd.w / 2, cmd.at[1] - cmd.h / 2, cmd.w, cmd.h);
          c.stroke();
          break;
        }
        case "ellipse": {
          c.beginPath();
          c.ellipse(cmd.at[0], cmd.at[1], cmd.rx, cmd.ry, 0, 0, Math.PI * 2);
          c.stroke();
          break;
        }
        case "coil": {
          const len = dist(cmd.a, cmd.b);
          const ang = Math.atan2(cmd.b[1] - cmd.a[1], cmd.b[0] - cmd.a[0]);
          const steps = Math.max(24, cmd.turns * 16);
          c.beginPath();
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const along = t * len;
            const env = Math.min(1, Math.min(t, 1 - t) * 8);
            const off = Math.sin(t * cmd.turns * Math.PI * 2) * cmd.amp * env;
            const px = cmd.a[0] + Math.cos(ang) * along - Math.sin(ang) * off;
            const py = cmd.a[1] + Math.sin(ang) * along + Math.cos(ang) * off;
            if (i === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
          }
          c.stroke();
          break;
        }
        case "zig": {
          const len = dist(cmd.a, cmd.b);
          const ang = Math.atan2(cmd.b[1] - cmd.a[1], cmd.b[0] - cmd.a[0]);
          const n = cmd.teeth * 2;
          c.beginPath();
          for (let i = 0; i <= n; i++) {
            const t = i / n;
            const off = i === 0 || i === n ? 0 : (i % 2 === 1 ? -1 : 1) * cmd.amp;
            const px = cmd.a[0] + Math.cos(ang) * t * len - Math.sin(ang) * off;
            const py = cmd.a[1] + Math.sin(ang) * t * len + Math.cos(ang) * off;
            if (i === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
          }
          c.stroke();
          break;
        }
        case "cell": {
          const s = cmd.size;
          const [cx, cy] = cmd.at;
          const plates: [number, number][] = [
            [-s * 0.34, s],
            [s * 0.34, s * 0.46],
          ];
          for (const [off, half] of plates) {
            c.beginPath();
            if (cmd.dir === "h") {
              c.moveTo(cx + off, cy - half);
              c.lineTo(cx + off, cy + half);
            } else {
              c.moveTo(cx - half, cy + off);
              c.lineTo(cx + half, cy + off);
            }
            c.stroke();
          }
          break;
        }
        case "lbl":
          break;
      }
    }

    // Labels last: clear the strokes behind each one so the label sits ON the
    // vertex rather than beside it, then paint it.
    c.setLineDash([]);
    for (const l of labels) {
      if (l.cmd.knock !== false) {
        const w = l.box.x1 - l.box.x0;
        const h = l.box.y1 - l.box.y0;
        const prev = c.globalCompositeOperation;
        c.globalCompositeOperation = "destination-out";
        c.beginPath();
        c.ellipse(
          (l.box.x0 + l.box.x1) / 2,
          (l.box.y0 + l.box.y1) / 2,
          w / 2 + stroke * 1.4,
          h / 2 + stroke * 0.4,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
        c.globalCompositeOperation = prev;
      }
      l.laid.draw(c, l.x, l.yb);
    }

    c.restore();
  };

  return { w: b.x1 - b.x0, h: b.y1 - b.y0, draw };
};

// ---------------------------------------------------------------------------
// Ring helper — regular polygons with correct interior angles, which is what
// makes a skeletal structure read as chemistry rather than as decoration.
// ---------------------------------------------------------------------------

/**
 * Set the label size on every label in a command list that has not asked for
 * one of its own. Physics diagrams span roughly twice the width of a skeletal
 * structure, so their labels need to be set larger to read at the same size.
 */
export const withLabelSize = (cmds: Cmd[], size: number): Cmd[] =>
  cmds.map((cmd) => (cmd.c === "lbl" && cmd.size === undefined ? { ...cmd, size } : cmd));

/**
 * Vertices of a regular `n`-gon of circumradius `r` centred on `c`.
 * `rot` is in radians; vertex 0 sits at angle `rot` measured from straight up.
 */
export const ring = (c: P, r: number, n: number, rot = 0): P[] => {
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI * 2) / n;
    out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return out;
};

/** Bonds around a ring, with `dbl` naming which edges carry a double bond. */
export const ringBonds = (v: P[], centre: P, dbl: number[] = []): Cmd[] =>
  v.map((p, i) => ({
    c: "bond",
    a: p,
    b: v[(i + 1) % v.length],
    order: dbl.includes(i) ? 2 : 1,
    toward: dbl.includes(i) ? centre : undefined,
  }));
