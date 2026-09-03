/**
 * Vignette — a radial darkening toward the corners. The gradient is built once
 * and cached; `amount` is the alpha reached at the corners.
 */
import { rgba } from "./color";

export interface VignetteOptions {
  /** Corner darkening, 0..1. */
  amount: number;
  /** Hex colour the frame darkens toward. */
  color: string;
  /** Fraction of the diagonal at which darkening starts. */
  innerRadius?: number;
}

export class VignettePass {
  private gradient: CanvasGradient | null = null;
  private key = "";

  apply(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    opts: VignetteOptions,
  ): void {
    const inner = opts.innerRadius ?? 0.34;
    const key = `${width}x${height}:${opts.amount}:${opts.color}:${inner}`;
    if (this.key !== key || !this.gradient) {
      const cx = width / 2;
      const cy = height / 2;
      const outer = Math.hypot(cx, cy);
      const g = ctx.createRadialGradient(cx, cy, outer * inner, cx, cy, outer);
      g.addColorStop(0, rgba(opts.color, 0));
      g.addColorStop(0.55, rgba(opts.color, opts.amount * 0.2));
      g.addColorStop(0.82, rgba(opts.color, opts.amount * 0.62));
      g.addColorStop(1, rgba(opts.color, opts.amount));
      this.gradient = g;
      this.key = key;
    }
    const prevOp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.fillStyle = this.gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = prevOp;
  }
}
