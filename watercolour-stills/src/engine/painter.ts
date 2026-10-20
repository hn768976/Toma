// Thin async wrapper around a p5.js WEBGL instance and p5.brush.
//
// Layouts work in a fixed logical space (LOGICAL_W x LOGICAL_H) whatever the
// pixel size of the paint canvas, so a still painted at 3000 px and one
// painted at 6000 px have the same composition; p5.brush's own scale()
// maps logical units to pixels (it also scales the rim strokes of each wash
// layer, so edge darkening keeps its proportion).
//
// Every primitive yields to the event loop afterwards so a long painting
// never blocks the page that Remotion is waiting on.
import p5 from "p5";
// p5.brush 1.1.4 ES module source, vendored with one patch (see src/vendor/p5.brush.js)
import * as brush from "../vendor/p5.brush.js";
import type { Pt } from "./shapes";

export const LOGICAL_W = 3000;
export const LOGICAL_H = 1687.5;

export type WashOpts = {
  /** 0..155 in p5.brush units */
  opacity?: number;
  /** 0..0.6 */
  bleed?: number;
  /** 0..1, interior mottling (p5.brush erases circles inside the layers) */
  texture?: number;
  /** 0..1, rim strength of each layer */
  border?: number;
  direction?: "out" | "in";
  /** saturation pre-compensation against p5.brush's greying (default 0.22) */
  saturate?: number;
  /** longest polygon edge in logical units before it is split (default 14) */
  maxSeg?: number;
};

// p5.brush's watercolour shader greys every pigment by a noisy 0-50% mix
// with its luminance (about 25% on average). Push the colour away from its
// luminance first so the dried wash lands near the palette colour.
const compensate = (hex: string, k = 0.22) => {
  const v = parseInt(hex.slice(1), 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  const y = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const out = c.map((x) => Math.round(Math.min(255, Math.max(0, (x - y * k) / (1 - k)))));
  return `#${out.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
};

// p5.brush accumulates every wash layer in Canvas2D mask buffers: tens of
// thousands of polygon fills per still. On a GPU-less renderer (SwiftShader)
// a GPU-backed 2D canvas makes each of those a slow software-GPU draw, so
// ask for CPU-backed 2D canvases instead (same pixels, far faster here).
const patchCanvas2D = () => {
  type GetContext = (this: HTMLCanvasElement, type: string, opts?: object) => unknown;
  const proto = HTMLCanvasElement.prototype as unknown as { __wcPatched?: boolean; getContext: GetContext };
  if (proto.__wcPatched) return;
  const orig = proto.getContext;
  proto.getContext = function (type, opts) {
    if (type === "2d") return orig.call(this, type, { ...opts, willReadFrequently: true });
    return orig.call(this, type, opts);
  };
  proto.__wcPatched = true;
};

// Yield to the event loop now and then. MessageChannel is used rather than
// setTimeout, which a background tab throttles to one call per second.
const channel = new MessageChannel();
const waiting: (() => void)[] = [];
channel.port1.onmessage = () => waiting.shift()?.();
let lastYield = 0;
export const yieldStats = { count: 0, ms: 0, max: 0 };
/** Split long edges so no segment is longer than `maxSeg` logical units. */
const densify = (pts: Pt[], maxSeg: number): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / maxSeg));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
};

const tick = () => {
  const now = performance.now();
  if (now - lastYield < 150) return Promise.resolve();
  return new Promise<void>((r) => {
    waiting.push(() => {
      const d = performance.now() - now;
      yieldStats.count++;
      yieldStats.ms += d;
      yieldStats.max = Math.max(yieldStats.max, d);
      lastYield = performance.now();
      r();
    });
    channel.port2.postMessage(0);
  });
};

export class Painter {
  readonly W = LOGICAL_W;
  readonly H = LOGICAL_H;
  ops = 0;
  /** per-fill timings, for profiling */
  prof: { ms: number; color: string; n: number }[] = [];

  private constructor(
    private p: p5,
    readonly canvas: HTMLCanvasElement,
    readonly pixelW: number,
    readonly pixelH: number,
  ) {}

  static create(host: HTMLElement, pixelW: number, pixelH: number, seed: number) {
    patchCanvas2D();
    return new Promise<Painter>((resolve, reject) => {
      // eslint-disable-next-line no-new
      new p5((p: p5) => {
        brush.instance(p);
        p.setup = () => {
          try {
            p.pixelDensity(1);
            p.setAttributes("preserveDrawingBuffer", true);
            const r = p.createCanvas(pixelW, pixelH, p.WEBGL);
            p.noLoop();
            p.randomSeed(seed);
            p.noiseSeed(seed);
            p.angleMode(p.DEGREES);
            brush.load();
            brush.seed(seed);
            brush.scale(pixelW / LOGICAL_W);
            brush.noStroke();
            brush.noHatch();
            brush.noField();
            p.background(255);
            resolve(new Painter(p, r.elt as HTMLCanvasElement, pixelW, pixelH));
          } catch (e) {
            reject(e);
          }
        };
      }, host);
    });
  }

  private within(fn: () => void) {
    const { p } = this;
    p.push();
    p.translate(-this.pixelW / 2, -this.pixelH / 2);
    fn();
    p.pop();
    this.ops++;
  }

  /** One p5.brush watercolour fill. */
  async wash(points: Pt[], color: string, o: WashOpts = {}) {
    if (points.length < 3) return;
    const t0 = performance.now();
    // p5.brush pushes each new vertex out by a fraction of its edge length, so
    // long edges would throw soft halos far outside the shape
    points = densify(points, o.maxSeg ?? 14);
    this.within(() => {
      brush.noStroke();
      brush.noHatch();
      brush.fill(compensate(color, o.saturate ?? 0.22), o.opacity ?? 60);
      brush.bleed(o.bleed ?? 0.2, o.direction ?? "out");
      brush.fillTexture(o.texture ?? 0.8, o.border ?? 0.5);
      brush.polygon(points);
      brush.noFill();
    });
    this.prof.push({ ms: performance.now() - t0, color, n: points.length });
    await tick();
  }

  /** Flush pending pigment into the canvas (p5.brush blends lazily). */
  async flush() {
    this.within(() => brush.reBlend());
    // wait for the GPU so paint timings are real
    const gl = (this.p as unknown as { drawingContext: WebGL2RenderingContext }).drawingContext;
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    await tick();
  }

  destroy() {
    this.p.remove();
  }
}
