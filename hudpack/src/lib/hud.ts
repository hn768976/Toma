import { INTER, MONO } from "./fonts";

export type FontKind = "sans" | "mono";

export interface TextOpts {
  font?: FontKind;
  weight?: number;
  align?: CanvasTextAlign;
  alpha?: number;
  baseline?: CanvasTextBaseline;
}

/**
 * Thin-line HUD drawing in a fixed design space (the reference's own pixel
 * grid), scaled to whatever backing size we render at. Static lines are
 * snapped to the device pixel grid so they stay crisp and never crawl;
 * moving lines are left unsnapped so they glide smoothly.
 */
export class Hud {
  readonly k: number; // device px per design unit
  readonly lw: number; // 1 px at 720p, in design units
  private readonly off: number;
  /** Extra dimming for small text (< 5 design units), so it reads mid-grey. */
  smallTextAlpha = 1;
  /** Global multiplier on stroke alpha (lines, rects, polylines, circles). */
  strokeAlpha = 1;

  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly backingW: number,
    readonly designW: number,
    readonly color = "#E8E8E8",
  ) {
    this.k = backingW / designW;
    const lwDev = Math.max(1, Math.round(backingW / 1280));
    this.lw = lwDev / this.k;
    this.off = (lwDev % 2) / 2;
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.lineWidth = this.lw;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
  }

  /** Snap a coordinate so a 1-px line centred on it covers whole pixels. */
  s(v: number) {
    return (Math.round(v * this.k - this.off) + this.off) / this.k;
  }
  /** Snap an edge (for filled rects). */
  e(v: number) {
    return Math.round(v * this.k) / this.k;
  }

  alpha(a: number) {
    this.ctx.globalAlpha = Math.max(0, Math.min(1, a));
  }

  font(size: number, kind: FontKind = "mono", weight = 400) {
    this.ctx.font = `${weight} ${size}px "${kind === "mono" ? MONO : INTER}"`;
  }

  text(str: string, x: number, y: number, size: number, o: TextOpts = {}) {
    const c = this.ctx;
    this.font(size, o.font ?? "mono", o.weight ?? 400);
    c.textAlign = o.align ?? "left";
    c.textBaseline = o.baseline ?? "alphabetic";
    this.alpha((o.alpha ?? 1) * (size < 5 ? this.smallTextAlpha : 1));
    c.fillText(str, x, y);
    c.globalAlpha = 1;
  }

  line(x1: number, y1: number, x2: number, y2: number, a = 1, snap = true, w = 1) {
    const c = this.ctx;
    this.alpha(a * this.strokeAlpha);
    c.lineWidth = this.lw * w;
    c.beginPath();
    if (snap) {
      c.moveTo(this.s(x1), this.s(y1));
      c.lineTo(this.s(x2), this.s(y2));
    } else {
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
    }
    c.stroke();
    c.lineWidth = this.lw;
    c.globalAlpha = 1;
  }

  hline(x1: number, x2: number, y: number, a = 1) {
    this.line(x1, y, x2, y, a);
  }
  vline(x: number, y1: number, y2: number, a = 1) {
    this.line(x, y1, x, y2, a);
  }

  rect(x: number, y: number, w: number, h: number, a = 1) {
    const c = this.ctx;
    this.alpha(a * this.strokeAlpha);
    c.strokeRect(this.s(x), this.s(y), this.s(x + w) - this.s(x), this.s(y + h) - this.s(y));
    c.globalAlpha = 1;
  }

  fill(x: number, y: number, w: number, h: number, a = 1) {
    if (w <= 0 || h <= 0) return;
    const c = this.ctx;
    this.alpha(a);
    c.fillRect(this.e(x), this.e(y), Math.max(this.lw, this.e(x + w) - this.e(x)), Math.max(this.lw, this.e(y + h) - this.e(y)));
    c.globalAlpha = 1;
  }

  /** Unsnapped fill, for things that slide. */
  fillSmooth(x: number, y: number, w: number, h: number, a = 1) {
    if (w <= 0 || h <= 0) return;
    this.alpha(a);
    this.ctx.fillRect(x, y, w, h);
    this.ctx.globalAlpha = 1;
  }

  poly(pts: number[], a = 1, close = false, snap = false, w = 1) {
    if (pts.length < 4) return;
    const c = this.ctx;
    this.alpha(a * this.strokeAlpha);
    c.lineWidth = this.lw * w;
    c.beginPath();
    const f = snap ? (v: number) => this.s(v) : (v: number) => v;
    c.moveTo(f(pts[0]), f(pts[1]));
    for (let i = 2; i < pts.length; i += 2) c.lineTo(f(pts[i]), f(pts[i + 1]));
    if (close) c.closePath();
    c.stroke();
    c.lineWidth = this.lw;
    c.globalAlpha = 1;
  }

  circle(cx: number, cy: number, r: number, a = 1, w = 1, a0 = 0, a1 = Math.PI * 2) {
    const c = this.ctx;
    this.alpha(a * this.strokeAlpha);
    c.lineWidth = this.lw * w;
    c.beginPath();
    c.arc(cx, cy, r, a0, a1);
    c.stroke();
    c.lineWidth = this.lw;
    c.globalAlpha = 1;
  }

  dot(cx: number, cy: number, r: number, a = 1) {
    const c = this.ctx;
    this.alpha(a);
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }

  /** Rounded rectangle outline. */
  rrect(x: number, y: number, w: number, h: number, r: number, a = 1) {
    const c = this.ctx;
    this.alpha(a);
    c.beginPath();
    c.roundRect(this.s(x), this.s(y), this.s(x + w) - this.s(x), this.s(y + h) - this.s(y), r);
    c.stroke();
    c.globalAlpha = 1;
  }
}
