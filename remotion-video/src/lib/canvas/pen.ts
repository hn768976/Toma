/**
 * Drawing primitives for line icons, authored in a normalised 0..1 box.
 *
 * Every icon is authored in a normalised 0..1 box and scaled to whatever pixel
 * size a node needs, so one definition serves every size in the frame and the
 * same icon can be re-rendered crisply rather than upscaled from a bitmap.
 *
 * The caller owns strokeStyle / lineWidth / lineCap; primitives never set a
 * colour, which is what lets one icon set serve three palettes. Icons are
 * stroke-only by construction — the only fill primitive is `dot`, for pupils
 * and rivets.
 */

export type Pen = {
  /** Normalised x -> pixels. */
  X: (u: number) => number;
  /** Normalised y -> pixels. */
  Y: (v: number) => number;
  /** Normalised length -> pixels (uses the box size). */
  S: (u: number) => number;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  poly: (points: readonly [number, number][], close?: boolean) => void;
  rect: (x: number, y: number, w: number, h: number) => void;
  rrect: (x: number, y: number, w: number, h: number, r: number) => void;
  circle: (cx: number, cy: number, r: number) => void;
  ellipse: (cx: number, cy: number, rx: number, ry: number) => void;
  arc: (
    cx: number,
    cy: number,
    r: number,
    from: number,
    to: number,
  ) => void;
  /** Filled disc, for the few solid accents an outline icon needs. */
  dot: (cx: number, cy: number, r: number) => void;
  /** Samples `f(t)` for t in [0,1] as a polyline — for helices and traces. */
  curve: (
    f: (t: number) => [number, number],
    steps?: number,
    close?: boolean,
  ) => void;
  /** Escape hatch for shapes that need raw bezier control. */
  shape: (build: (p: ShapePen) => void, close?: boolean) => void;
};

export type ShapePen = {
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  quadTo: (cx: number, cy: number, x: number, y: number) => void;
  curveTo: (
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    x: number,
    y: number,
  ) => void;
};

/** Builds a pen that maps the normalised 0..1 icon box onto an `s`-px square. */
export const pen = (ctx: CanvasRenderingContext2D, s: number): Pen => {
  const X = (u: number) => u * s;
  const Y = (v: number) => v * s;
  const S = (u: number) => u * s;

  const strokeShape = (build: (p: ShapePen) => void, close = false) => {
    ctx.beginPath();
    build({
      moveTo: (x, y) => ctx.moveTo(X(x), Y(y)),
      lineTo: (x, y) => ctx.lineTo(X(x), Y(y)),
      quadTo: (cx, cy, x, y) => ctx.quadraticCurveTo(X(cx), Y(cy), X(x), Y(y)),
      curveTo: (c1x, c1y, c2x, c2y, x, y) =>
        ctx.bezierCurveTo(X(c1x), Y(c1y), X(c2x), Y(c2y), X(x), Y(y)),
    });
    if (close) ctx.closePath();
    ctx.stroke();
  };

  return {
    X,
    Y,
    S,
    line: (x1, y1, x2, y2) =>
      strokeShape((p) => {
        p.moveTo(x1, y1);
        p.lineTo(x2, y2);
      }),
    poly: (points, close = false) =>
      strokeShape((p) => {
        points.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
      }, close),
    rect: (x, y, w, h) => {
      ctx.beginPath();
      ctx.rect(X(x), Y(y), S(w), S(h));
      ctx.stroke();
    },
    rrect: (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.roundRect(X(x), Y(y), S(w), S(h), S(r));
      ctx.stroke();
    },
    circle: (cx, cy, r) => {
      ctx.beginPath();
      ctx.arc(X(cx), Y(cy), S(r), 0, Math.PI * 2);
      ctx.stroke();
    },
    ellipse: (cx, cy, rx, ry) => {
      ctx.beginPath();
      ctx.ellipse(X(cx), Y(cy), S(rx), S(ry), 0, 0, Math.PI * 2);
      ctx.stroke();
    },
    arc: (cx, cy, r, from, to) => {
      ctx.beginPath();
      ctx.arc(X(cx), Y(cy), S(r), from, to);
      ctx.stroke();
    },
    dot: (cx, cy, r) => {
      ctx.beginPath();
      ctx.arc(X(cx), Y(cy), S(r), 0, Math.PI * 2);
      ctx.fill();
    },
    curve: (f, steps = 48, close = false) =>
      strokeShape((p) => {
        for (let i = 0; i <= steps; i++) {
          const [x, y] = f(i / steps);
          if (i === 0) p.moveTo(x, y);
          else p.lineTo(x, y);
        }
      }, close),
    shape: strokeShape,
  };
};

/** An icon: pure geometry, drawn into an `s`-px box with the caller's stroke. */
export type IconDraw = (ctx: CanvasRenderingContext2D, s: number) => void;
