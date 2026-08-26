import {CHART, DOF, HEIGHT, WIDTH, type VariantConfig} from './config';

/** 2D affine matrix, canvas order: [a c e ; b d f]. */
export type Mat = {a: number; b: number; c: number; d: number; e: number; f: number};

/** m1 ∘ m2 — m2 is applied to the point first. */
const mul = (m1: Mat, m2: Mat): Mat => ({
  a: m1.a * m2.a + m1.c * m2.b,
  b: m1.b * m2.a + m1.d * m2.b,
  c: m1.a * m2.c + m1.c * m2.d,
  d: m1.b * m2.c + m1.d * m2.d,
  e: m1.a * m2.e + m1.c * m2.f + m1.e,
  f: m1.b * m2.e + m1.d * m2.f + m1.f,
});

const apply = (m: Mat, x: number, y: number): [number, number] => [
  m.a * x + m.c * y + m.e,
  m.b * x + m.d * y + m.f,
];

/**
 * The camera. Off-axis but strictly affine: rotate, then shear so the right
 * side compresses. Parallel lines stay parallel — this is deliberately not a
 * perspective projection.
 */
export const makeCamera = (cfg: VariantConfig): Mat => {
  const th = (cfg.tiltDeg * Math.PI) / 180;
  const k = Math.tan((cfg.shearDeg * Math.PI) / 180);
  const s = cfg.cameraScale;

  const translate: Mat = {a: 1, b: 0, c: 0, d: 1, e: WIDTH / 2, f: HEIGHT / 2};
  const scale: Mat = {a: s, b: 0, c: 0, d: s, e: 0, f: 0};
  const rotate: Mat = {
    a: Math.cos(th),
    b: Math.sin(th),
    c: -Math.sin(th),
    d: Math.cos(th),
    e: 0,
    f: 0,
  };
  const shear: Mat = {a: 1, b: 0, c: k, d: 1, e: 0, f: 0};

  return mul(mul(translate, scale), mul(rotate, shear));
};

/** Chart space -> final frame pixels. */
export const toScreen = (cam: Mat, x: number, y: number) => apply(cam, x, y);

/**
 * Depth of field.
 *
 * A focal band runs through the chart's mid-left; focus falls off toward the
 * right edge, the top and the bottom. Returns 0 (sharp) .. 1 (max blur).
 */
export const focusAt = (sx: number, sy: number): number => {
  const nx = sx / WIDTH - DOF.focusX;
  const ny = sy / HEIGHT - DOF.focusY;
  const hx = nx >= 0 ? nx / DOF.radiusRight : nx / DOF.radiusLeft;
  const hy = ny / DOF.radiusVertical;
  const d = Math.sqrt(hx * hx + hy * hy);
  const t = (d - DOF.deadZone) / (DOF.maxDistance - DOF.deadZone);
  return Math.min(1, Math.max(0, t));
};

export type Buffer = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** backing-store scale relative to the final frame */
  scale: number;
  /** blur applied when this buffer is composited, in final-frame px */
  blur: number;
};

const makeBuffer = (scale: number, blur: number): Buffer => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((WIDTH + DOF.margin * 2) * scale);
  canvas.height = Math.round((HEIGHT + DOF.margin * 2) * scale);
  const ctx = canvas.getContext('2d', {alpha: true}) as CanvasRenderingContext2D;
  return {canvas, ctx, scale, blur};
};

export type Buffers = {sharp: Buffer; mid: Buffer; far: Buffer; all: Buffer[]};

export const makeBuffers = (): Buffers => {
  const sharp = makeBuffer(DOF.scaleSharp, DOF.blurSharp);
  const mid = makeBuffer(DOF.scaleMid, DOF.blurMid);
  const far = makeBuffer(DOF.scaleFar, DOF.blurFar);
  return {sharp, mid, far, all: [sharp, mid, far]};
};

/**
 * Painter — the only thing the layers talk to.
 *
 * Elements are bucketed into three buffers by focus distance and each buffer
 * is blurred exactly once at composite time. Per-element blurring would be
 * unusably slow at 4K. Because a hard bucket boundary would make a scrolling
 * candle pop between blur levels, an element straddling two buckets is drawn
 * into both with complementary alpha, which cross-fades its blur smoothly.
 */
export class Painter {
  readonly buffers: Buffers;
  readonly cam: Mat;
  /** global brightness breathe, applied to every element's alpha */
  breathe = 1;

  constructor(buffers: Buffers, cam: Mat) {
    this.buffers = buffers;
    this.cam = cam;
  }

  /** Reset every buffer and re-establish its camera transform. */
  begin(breathe: number) {
    this.breathe = breathe;
    for (const b of this.buffers.all) {
      b.ctx.setTransform(1, 0, 0, 1, 0, 0);
      b.ctx.clearRect(0, 0, b.canvas.width, b.canvas.height);
      b.ctx.globalCompositeOperation = 'lighter';
      const m = this.bufferMatrix(b);
      b.ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    }
  }

  private bufferMatrix(b: Buffer): Mat {
    const s = b.scale;
    // shift into the bleed margin, then downscale the whole buffer
    return mul(
      {a: s, b: 0, c: 0, d: s, e: DOF.margin * s, f: DOF.margin * s},
      this.cam
    );
  }

  screen(x: number, y: number) {
    return toScreen(this.cam, x, y);
  }

  focus(x: number, y: number) {
    const [sx, sy] = this.screen(x, y);
    return focusAt(sx, sy);
  }

  /** Bucket weights for a focus value: [sharp, mid, far]. */
  private weights(focus: number): [number, number, number] {
    if (focus <= 0.5) {
      const t = focus / 0.5;
      return [1 - t, t, 0];
    }
    const t = (focus - 0.5) / 0.5;
    return [0, 1 - t, t];
  }

  /**
   * Draw one element. `fn` receives a context whose transform is already in
   * chart space, plus the alpha it should honour.
   *
   * `glow` > 0 adds a second, larger, softer pass in the blurred buffers only:
   * boosting a bright element before it is blurred is what turns it into a
   * soft disc rather than a smeared rectangle.
   */
  paint(
    focus: number,
    fn: (ctx: CanvasRenderingContext2D, alpha: number, bufferIndex: number) => void,
    glow = 0
  ) {
    const w = this.weights(focus);
    for (let i = 0; i < 3; i++) {
      if (w[i] < 0.004) continue;
      const b = this.buffers.all[i];
      const alpha = w[i] * this.breathe;
      fn(b.ctx, alpha, i);
      if (glow > 0 && i > 0) {
        b.ctx.save();
        // bloom grows with how far out of focus the bucket is
        b.ctx.globalAlpha = 1;
        fn(b.ctx, alpha * glow * (i === 1 ? 0.55 : 1), i);
        b.ctx.restore();
      }
    }
  }
}

/** Chart-space x of candle `index` before the scroll offset is applied. */
export const candleX = (index: number) =>
  index * CHART.pitch - (CHART.pitch * 0.5);
