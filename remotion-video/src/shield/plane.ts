/**
 * THE TILTED PLANE
 *
 * Every element in the piece sits on one plane that recedes toward the upper
 * right. The plane is a single affine transform — a rotation of -16 degrees
 * combined with a shear that compresses the right-hand side by ~8%. Parallel
 * lines stay parallel; this is deliberately not a true perspective projection,
 * which would be invisible at the blur levels used here.
 *
 * DEPTH PROXY: the plane's local y axis. Small y is far (upper right of the
 * screen), large y is near (lower left). Every focus and brightness decision
 * keys off it.
 */

export type Mat = readonly [number, number, number, number, number, number];

export const PLANE_ROT_DEG = -16;
/** Negative shear leans the local y axis so the far side lands upper-right. */
export const PLANE_SHEAR = -0.26;
/** The right-side compression: ~8%. */
export const PLANE_SCALE_X = 0.92;

const TH = (PLANE_ROT_DEG * Math.PI) / 180;
const COS = Math.cos(TH);
const SIN = Math.sin(TH);

export const PLANE_A = PLANE_SCALE_X * COS;
export const PLANE_B = PLANE_SCALE_X * SIN;
export const PLANE_C = PLANE_SHEAR * COS - SIN;
export const PLANE_D = PLANE_SHEAR * SIN + COS;
const DET = PLANE_A * PLANE_D - PLANE_B * PLANE_C;

/** Screen size of the composition. Canvas backing stores match this exactly. */
export const FRAME_W = 3840;
export const FRAME_H = 2160;

const ORIGIN_X = FRAME_W / 2;
const ORIGIN_Y = FRAME_H / 2;

/**
 * The plane transform for a buffer rendered at `bufferScale` of full size.
 * Half-resolution blur buffers pass 0.5 and everything else stays identical.
 */
export const planeMatrix = (bufferScale = 1): Mat => [
  PLANE_A * bufferScale,
  PLANE_B * bufferScale,
  PLANE_C * bufferScale,
  PLANE_D * bufferScale,
  ORIGIN_X * bufferScale,
  ORIGIN_Y * bufferScale,
];

export const toScreenX = (x: number, y: number) => PLANE_A * x + PLANE_C * y + ORIGIN_X;
export const toScreenY = (x: number, y: number) => PLANE_B * x + PLANE_D * y + ORIGIN_Y;

/** Inverse mapping, used to art-direct elements by screen anchor. */
export const toLocalX = (sx: number, sy: number) =>
  (PLANE_D * (sx - ORIGIN_X) - PLANE_C * (sy - ORIGIN_Y)) / DET;
export const toLocalY = (sx: number, sy: number) =>
  (-PLANE_B * (sx - ORIGIN_X) + PLANE_A * (sy - ORIGIN_Y)) / DET;

/** Local-space bounds that cover the whole 4K frame, with a little margin. */
export const LOCAL_X_MIN = -2320;
export const LOCAL_X_MAX = 2320;
export const LOCAL_Y_MIN = -1660;
export const LOCAL_Y_MAX = 1660;

/** One tile of the surround layout, repeated along the drift axis. */
export const TILE_W = 4400;
/** Tile indices that together cover the frame for any drift offset. */
export const TILE_INDICES = [-1, 0, 1] as const;

/* ------------------------------------------------------------------ *
 * Depth bucketing
 * ------------------------------------------------------------------ */

export type Bucket = "far" | "mid" | "near";

/**
 * Where the shield sits, as a fraction of the frame: left of centre, and high
 * enough to leave room for the main status word beneath it.
 */
export const SHIELD_ANCHOR_X = 0.44;
export const SHIELD_ANCHOR_Y = 0.44;

/** Local y of the shield — the centre of the focal band. */
export const FOCAL_Y = toLocalY(FRAME_W * SHIELD_ANCHOR_X, FRAME_H * SHIELD_ANCHOR_Y);
/** Half-height of the in-focus band, in local units. */
export const FOCAL_HALF = 300;

export const bucketForDepth = (localY: number): Bucket => {
  if (localY < FOCAL_Y - FOCAL_HALF) return "far";
  if (localY > FOCAL_Y + FOCAL_HALF) return "near";
  return "mid";
};

/**
 * 0 at the focal plane, 1 at the extremes. Drives the alpha falloff that
 * smooths over the three discrete blur steps.
 */
export const defocus = (localY: number) => {
  const d = Math.abs(localY - FOCAL_Y);
  if (d <= FOCAL_HALF) return 0;
  const far = localY < FOCAL_Y ? FOCAL_Y - LOCAL_Y_MIN : LOCAL_Y_MAX - FOCAL_Y;
  return Math.min(1, (d - FOCAL_HALF) / Math.max(1, far - FOCAL_HALF));
};

/* ------------------------------------------------------------------ *
 * Buffers
 * ------------------------------------------------------------------ */

export type Layer = {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  /** Fraction of full resolution this buffer is rendered at. */
  scale: number;
  /**
   * Blur applied once, when the buffer is composited. ctx.filter operates on
   * the source drawing, so a half-resolution buffer needs half the radius to
   * land at the intended screen blur.
   */
  blurPx: number;
};

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** `screenBlurPx` is the blur as it should read on the finished 4K frame. */
export const makeLayer = (scale: number, screenBlurPx: number): Layer => {
  const canvas = makeCanvas(Math.round(FRAME_W * scale), Math.round(FRAME_H * scale));
  const ctx = canvas.getContext("2d", { alpha: true }) as CanvasRenderingContext2D;
  return { ctx, canvas, scale, blurPx: screenBlurPx * scale };
};

export const resetLayer = (layer: Layer) => {
  const { ctx, canvas } = layer;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

/** Apply the plane transform to a layer, offset along the drift axis. */
export const applyPlane = (layer: Layer, driftX: number, driftY: number) => {
  const m = planeMatrix(layer.scale);
  layer.ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  layer.ctx.translate(driftX, driftY);
};

/* ------------------------------------------------------------------ *
 * Culling
 * ------------------------------------------------------------------ */

/** True when a local-space box projects to something touching the frame. */
export const onScreen = (x: number, y: number, w: number, h: number, pad = 260) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < 4; i++) {
    const px = i === 0 || i === 3 ? x : x + w;
    const py = i < 2 ? y : y + h;
    const sx = toScreenX(px, py);
    const sy = toScreenY(px, py);
    if (sx < minX) minX = sx;
    if (sx > maxX) maxX = sx;
    if (sy < minY) minY = sy;
    if (sy > maxY) maxY = sy;
  }
  return maxX > -pad && minX < FRAME_W + pad && maxY > -pad && minY < FRAME_H + pad;
};
