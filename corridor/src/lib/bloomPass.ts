/**
 * Bloom.
 *
 * Downsamples the finished frame, squares it to bias toward the bright pixels
 * (a threshold-free bright pass — on a near-black scene squaring crushes the
 * background and keeps the highlights), blurs that, then adds it back. Bloom
 * is low-frequency, so working at a quarter resolution is free quality.
 */

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

export interface BloomOptions {
  /** Blur radius in full-resolution pixels. */
  radius: number;
  /** How much of the bloom is added back, 0..1. */
  strength: number;
}

export class BloomPass {
  private readonly w: number;
  private readonly h: number;
  private readonly scale: number;
  private readonly a: HTMLCanvasElement;
  private readonly actx: CanvasRenderingContext2D;
  private readonly b: HTMLCanvasElement;
  private readonly bctx: CanvasRenderingContext2D;

  constructor(width: number, height: number, scale = 0.25) {
    this.w = width;
    this.h = height;
    this.scale = scale;
    this.a = makeCanvas(width * scale, height * scale);
    this.actx = this.a.getContext("2d") as CanvasRenderingContext2D;
    this.b = makeCanvas(width * scale, height * scale);
    this.bctx = this.b.getContext("2d") as CanvasRenderingContext2D;
  }

  /** Reads `source` (usually the target canvas itself) and adds bloom to `target`. */
  apply(
    target: CanvasRenderingContext2D,
    source: HTMLCanvasElement,
    opts: BloomOptions,
  ): void {
    const bw = this.a.width;
    const bh = this.a.height;

    this.actx.globalCompositeOperation = "source-over";
    this.actx.filter = "none";
    this.actx.globalAlpha = 1;
    this.actx.clearRect(0, 0, bw, bh);
    this.actx.drawImage(source, 0, 0, bw, bh);

    // Square the downsampled image: bright pass without a hard threshold.
    this.bctx.globalCompositeOperation = "source-over";
    this.bctx.filter = "none";
    this.bctx.globalAlpha = 1;
    this.bctx.clearRect(0, 0, bw, bh);
    this.bctx.drawImage(this.a, 0, 0);
    this.bctx.globalCompositeOperation = "multiply";
    this.bctx.drawImage(this.a, 0, 0);
    this.bctx.globalCompositeOperation = "source-over";

    // Blur once at reduced resolution.
    this.actx.clearRect(0, 0, bw, bh);
    this.actx.filter = `blur(${(opts.radius * this.scale).toFixed(2)}px)`;
    this.actx.drawImage(this.b, 0, 0);
    this.actx.filter = "none";

    const prevOp = target.globalCompositeOperation;
    const prevAlpha = target.globalAlpha;
    target.filter = "none";
    target.globalCompositeOperation = "lighter";
    target.globalAlpha = opts.strength;
    target.drawImage(this.a, 0, 0, bw, bh, 0, 0, this.w, this.h);
    target.globalAlpha = prevAlpha;
    target.globalCompositeOperation = prevOp;
  }
}
