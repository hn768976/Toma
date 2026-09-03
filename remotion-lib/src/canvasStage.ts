/**
 * A single canvas that several components paint onto, one per frame.
 *
 * Each component paints its own artwork into `scratch`, blooms it, then
 * composites the result into `target` additively. Because compositing is
 * additive over a dark ground, the components' paint order does not
 * matter — which in turn means they do not have to rely on React's
 * sibling effect ordering to layer correctly.
 *
 * `claim()` makes each component's paint idempotent for a given frame:
 * the first component to touch a new frame clears the target, and no
 * component can double-expose itself if React re-runs its effect without
 * the frame having advanced.
 *
 * Intended for glow-heavy canvas work at high resolution, where giving
 * every component its own full-size canvas would cost far more memory
 * than sharing one.
 */
export type Stage = {
  width: number;
  height: number;
  /** The visible canvas everything ends up on. */
  target: HTMLCanvasElement;
  /** Full-resolution transient buffer for one component's artwork. */
  scratch: HTMLCanvasElement;
  /** Reduced-resolution buffer the bloom is blurred in. */
  bloom: HTMLCanvasElement;
  /** The frame `target` currently holds. */
  frame: number;
  /** Ids of components already painted for `frame`. */
  painted: Set<string>;
};

/** Bloom is blurred at 1/BLOOM_DIVISOR resolution — visually identical
 *  to a full-resolution blur of the same radius, and far cheaper at 4K. */
export const BLOOM_DIVISOR = 4;

const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

export const createStage = (
  target: HTMLCanvasElement,
  width: number,
  height: number,
): Stage => ({
  width,
  height,
  target,
  scratch: createCanvas(width, height),
  bloom: createCanvas(width / BLOOM_DIVISOR, height / BLOOM_DIVISOR),
  frame: -1,
  painted: new Set<string>(),
});

/**
 * Prepares the stage for `id` on `frame`. Returns the target context to
 * paint into, or null if this component has already painted this frame.
 */
export const claim = (
  stage: Stage,
  id: string,
  frame: number,
  background: string,
): CanvasRenderingContext2D | null => {
  const ctx = stage.target.getContext("2d");
  if (!ctx) return null;
  if (stage.frame !== frame) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, stage.width, stage.height);
    stage.frame = frame;
    stage.painted.clear();
  }
  if (stage.painted.has(id)) return null;
  stage.painted.add(id);
  return ctx;
};

/** Clears `scratch` and returns a context reset to a known state. */
export const beginScratch = (stage: Stage): CanvasRenderingContext2D | null => {
  const ctx = stage.scratch.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.clearRect(0, 0, stage.width, stage.height);
  return ctx;
};
