/**
 * Three-buffer depth of field.
 *
 * Elements are bucketed by depth into a FAR, MID and NEAR offscreen buffer and
 * each buffer is blurred exactly ONCE on composite. Blurring per element would
 * be unusably slow at 4K — this is three filter operations per frame no matter
 * how many thousand elements there are.
 *
 * The blurred buckets render at reduced resolution and are blurred at that
 * reduced size before being scaled back up, which costs a quarter of the fill
 * rate and is invisible: the result is blurred anyway. Callers always draw in
 * full-resolution coordinates — the transform is applied for them.
 */

export type BucketKey = "far" | "mid" | "near";

export interface BucketSpec {
  key: BucketKey;
  /** Backing-store scale for this bucket, 0..1. Use 1 for the sharp bucket. */
  resScale: number;
  /** Blur radius in full-resolution pixels. 0 leaves the bucket sharp. */
  blurPx: number;
}

interface Bucket extends BucketSpec {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

export class DofBuffers {
  readonly width: number;
  readonly height: number;
  private readonly buckets: Bucket[];
  private readonly temp: HTMLCanvasElement | null;
  private readonly tempCtx: CanvasRenderingContext2D | null;

  constructor(width: number, height: number, specs: BucketSpec[]) {
    this.width = width;
    this.height = height;
    this.buckets = specs.map((spec) => {
      const canvas = makeCanvas(width * spec.resScale, height * spec.resScale);
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      return { ...spec, canvas, ctx };
    });
    // One shared scratch canvas, sized for the largest blurred bucket.
    const blurred = specs.filter((s) => s.blurPx > 0);
    if (blurred.length > 0) {
      const s = Math.max(...blurred.map((b) => b.resScale));
      this.temp = makeCanvas(width * s, height * s);
      this.tempCtx = this.temp.getContext("2d") as CanvasRenderingContext2D;
    } else {
      this.temp = null;
      this.tempCtx = null;
    }
  }

  /** Context for a bucket, pre-scaled so callers use full-res coordinates. */
  ctx(key: BucketKey): CanvasRenderingContext2D {
    const b = this.buckets.find((x) => x.key === key);
    if (!b) throw new Error(`Unknown depth bucket: ${key}`);
    return b.ctx;
  }

  /**
   * Wipe all three buffers and re-apply their coordinate scaling.
   * `blend` is the composite mode elements are drawn with *inside* a bucket:
   * "lighter" for additive glow, "source-over" for layered opaque surfaces.
   */
  clear(blend: GlobalCompositeOperation = "lighter"): void {
    for (const b of this.buckets) {
      b.ctx.setTransform(1, 0, 0, 1, 0, 0);
      b.ctx.filter = "none";
      b.ctx.globalCompositeOperation = "source-over";
      b.ctx.clearRect(0, 0, b.canvas.width, b.canvas.height);
      b.ctx.globalCompositeOperation = blend;
      b.ctx.setTransform(b.resScale, 0, 0, b.resScale, 0, 0);
    }
  }

  /** Composite far -> mid -> near onto `target`, blurring each bucket once. */
  composite(target: CanvasRenderingContext2D): void {
    const prevFilter = target.filter;
    const prevOp = target.globalCompositeOperation;
    target.globalCompositeOperation = "lighter";
    for (const b of this.buckets) {
      if (b.blurPx > 0 && this.temp && this.tempCtx) {
        const tw = Math.round(this.width * b.resScale);
        const th = Math.round(this.height * b.resScale);
        this.tempCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.tempCtx.globalCompositeOperation = "source-over";
        this.tempCtx.filter = "none";
        this.tempCtx.clearRect(0, 0, this.temp.width, this.temp.height);
        this.tempCtx.filter = `blur(${(b.blurPx * b.resScale).toFixed(2)}px)`;
        this.tempCtx.drawImage(b.canvas, 0, 0);
        this.tempCtx.filter = "none";
        target.filter = "none";
        target.drawImage(this.temp, 0, 0, tw, th, 0, 0, this.width, this.height);
      } else {
        target.filter = "none";
        target.drawImage(b.canvas, 0, 0, this.width, this.height);
      }
    }
    target.filter = prevFilter;
    target.globalCompositeOperation = prevOp;
  }
}
