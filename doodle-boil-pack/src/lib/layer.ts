import type { BBox, Pt } from "./geom";
import { texture, TextureName } from "./textures";

/**
 * An offscreen canvas covering `bbox` (composition units) at `dpr` device pixels per unit.
 * Its context is set up so drawing happens in composition coordinates.
 */
export class Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  constructor(
    public bbox: BBox,
    public dpr: number,
    canvas?: HTMLCanvasElement,
  ) {
    this.canvas = canvas ?? document.createElement("canvas");
    const w = Math.max(1, Math.ceil(bbox.w * dpr));
    const h = Math.max(1, Math.ceil(bbox.h * dpr));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.ctx = this.canvas.getContext("2d")!;
    this.clear();
  }

  clear() {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.toComp();
  }

  toComp() {
    const { dpr, bbox } = this;
    this.ctx.setTransform(dpr, 0, 0, dpr, -bbox.x * dpr, -bbox.y * dpr);
  }

  /** Keep only what overlaps the texture's alpha (or cut it out, with destination-out). */
  mask(name: TextureName, off: Pt, op: GlobalCompositeOperation = "destination-in") {
    const { ctx, bbox } = this;
    const pat = ctx.createPattern(texture(name), "repeat")!;
    pat.setTransform(new DOMMatrix([1, 0, 0, 1, off[0], off[1]]));
    ctx.save();
    ctx.globalCompositeOperation = op;
    ctx.fillStyle = pat;
    ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
    ctx.restore();
  }

  /** Recolour everything drawn so far. */
  tint(color: string) {
    const { ctx, bbox } = this;
    ctx.save();
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
    ctx.restore();
  }

  /** Composite another layer of the same bbox/dpr onto this one, pixel for pixel. */
  draw(other: Layer, op: GlobalCompositeOperation = "source-over", alpha = 1) {
    const { ctx } = this;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = alpha;
    ctx.drawImage(other.canvas, 0, 0);
    ctx.restore();
  }
}

// Reused scratch canvases, so a frame doesn't allocate dozens of 4K buffers.
const pool = new Map<string, HTMLCanvasElement>();

export const scratch = (slot: string, like: Layer): Layer => {
  let c = pool.get(slot);
  if (!c) {
    c = document.createElement("canvas");
    pool.set(slot, c);
  }
  return new Layer(like.bbox, like.dpr, c);
};
