/**
 * Offscreen sprite construction.
 *
 * Every distinct shape in the field is rasterised exactly once, at the
 * largest size it will ever appear, and afterwards only ever blitted with a
 * transform. A 4K frame holds ~145 translucent shapes; re-pathing them per
 * frame is what makes a canvas field slow, and blitting is what makes it fast.
 *
 * All shapes are drawn pointing towards +y (down the sprite canvas). The
 * layers rotate them onto the variant's signed axis, so "which way is
 * forward" is never baked into a sprite.
 */

import {
  ARROW_EDGE_ALPHA,
  ARROW_FILL_ALPHA,
  ARROW_HEAD_LENGTH,
  ARROW_HEAD_WIDTH,
  ARROW_LENGTH,
  ARROW_STROKE,
  ARROW_WIDTH,
  MAX_SIZE_MUL,
  OUTLINE_ARROW_SIZE_BOOST,
  SHARD_EDGE_ALPHA,
  SHARD_FILL_ALPHA,
  SHARD_STROKE,
} from "./constants";
import { Palette } from "./variants";

export type Sprite = {
  canvas: HTMLCanvasElement;
  /** The sizeMul the sprite was rasterised at. Blit scale is sizeMul / scale. */
  scale: number;
};

export const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
};

/** `#RRGGBB` to a canvas `rgba()` string. The only place hex is parsed. */
export const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

type PathFn = (ctx: CanvasRenderingContext2D) => void;

/**
 * Rasterises one path, centred, at `scale`. `shapeW`/`shapeH` are the path's
 * bounds in base units; the canvas is grown to hold the stroke.
 */
const rasterise = (
  path: PathFn,
  shapeW: number,
  shapeH: number,
  stroke: number,
  scale: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): Sprite => {
  const pad = stroke + 4;
  const canvas = createCanvas((shapeW + pad * 2) * scale, (shapeH + pad * 2) * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(scale, scale);
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke;
  path(ctx);
  paint(ctx);
  return { canvas, scale };
};

/* ------------------------------------------------------------------ *
 * Arrow
 * ------------------------------------------------------------------ */

/** A rectangular shaft with a triangular head, as one closed outline. */
const arrowPath: PathFn = (ctx) => {
  const hl = ARROW_LENGTH / 2;
  const hw = ARROW_WIDTH / 2;
  const hh = ARROW_HEAD_WIDTH / 2;
  const neck = hl - ARROW_HEAD_LENGTH;
  ctx.beginPath();
  ctx.moveTo(-hw, -hl);
  ctx.lineTo(hw, -hl);
  ctx.lineTo(hw, neck);
  ctx.lineTo(hh, neck);
  ctx.lineTo(0, hl);
  ctx.lineTo(-hh, neck);
  ctx.lineTo(-hw, neck);
  ctx.closePath();
};

export const ARROW_BASE_HALF_EXTENT =
  Math.hypot(ARROW_HEAD_WIDTH, ARROW_LENGTH) / 2 + ARROW_STROKE;

export type ArrowSprites = {
  /** Translucent fill under a brighter outline. */
  filled: Sprite;
  /** Outline only, no fill — v2's lighter, more optimistic arrows. */
  outline: Sprite;
};

export const buildArrowSprites = (palette: Palette): ArrowSprites => ({
  filled: rasterise(
    arrowPath,
    ARROW_HEAD_WIDTH,
    ARROW_LENGTH,
    ARROW_STROKE,
    MAX_SIZE_MUL,
    (ctx) => {
      ctx.fillStyle = hexToRgba(palette.arrowFill, ARROW_FILL_ALPHA);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(palette.arrowEdge, ARROW_EDGE_ALPHA);
      ctx.stroke();
    },
  ),
  outline: rasterise(
    arrowPath,
    ARROW_HEAD_WIDTH,
    ARROW_LENGTH,
    ARROW_STROKE * 1.15,
    MAX_SIZE_MUL * OUTLINE_ARROW_SIZE_BOOST,
    (ctx) => {
      ctx.lineWidth = ARROW_STROKE * 1.15;
      ctx.strokeStyle = hexToRgba(palette.arrowEdge, ARROW_EDGE_ALPHA);
      ctx.stroke();
    },
  ),
});

/* ------------------------------------------------------------------ *
 * Shards
 * ------------------------------------------------------------------ */

type ShardShape = { w: number; h: number; path: PathFn };

const parallelogram = (w: number, h: number, skew: number): ShardShape => ({
  w: w + skew * 2,
  h,
  path: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + skew, -h / 2);
    ctx.lineTo(w / 2 + skew, -h / 2);
    ctx.lineTo(w / 2 - skew, h / 2);
    ctx.lineTo(-w / 2 - skew, h / 2);
    ctx.closePath();
  },
});

const sliver = (w: number, h: number, apexShift: number): ShardShape => ({
  w: w + Math.abs(apexShift) * 2,
  h,
  path: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, -h / 2);
    ctx.lineTo(apexShift, h / 2);
    ctx.closePath();
  },
});

/** Elongated parallelograms and thin triangles, all aligned to the axis. */
const SHARD_SHAPES: ShardShape[] = [
  parallelogram(120, 900, 90),
  parallelogram(210, 620, 55),
  sliver(110, 980, 30),
  sliver(260, 540, 70),
];

/** fill only, outline only, and both — mixed so the field is not uniform. */
const SHARD_STYLES = ["fill", "outline", "both"] as const;

export const SHARD_SPRITE_COUNT = SHARD_SHAPES.length * SHARD_STYLES.length;

export const shardBaseHalfExtent = (spriteIndex: number) => {
  const shape = SHARD_SHAPES[spriteIndex % SHARD_SHAPES.length];
  // Allow for the widest non-uniform width jitter applied at blit time.
  return Math.hypot(shape.w * 1.4, shape.h) / 2 + SHARD_STROKE;
};

export const buildShardSprites = (palette: Palette): Sprite[] => {
  const sprites: Sprite[] = [];
  for (let s = 0; s < SHARD_STYLES.length; s++) {
    const style = SHARD_STYLES[s];
    for (let k = 0; k < SHARD_SHAPES.length; k++) {
      const shape = SHARD_SHAPES[k];
      sprites.push(
        rasterise(
          shape.path,
          shape.w,
          shape.h,
          SHARD_STROKE,
          MAX_SIZE_MUL,
          (ctx) => {
            if (style !== "outline") {
              ctx.fillStyle = hexToRgba(palette.shardFill, SHARD_FILL_ALPHA);
              ctx.fill();
            }
            if (style !== "fill") {
              ctx.strokeStyle = hexToRgba(palette.shardEdge, SHARD_EDGE_ALPHA);
              ctx.stroke();
            }
          },
        ),
      );
    }
  }
  return sprites;
};

/** Index layout is shape-major within style, so `% SHARD_SHAPES.length` picks the shape. */
export const shardSpriteIndexToShape = (i: number) => i % SHARD_SHAPES.length;

/* ------------------------------------------------------------------ *
 * Spark
 * ------------------------------------------------------------------ */

export const SPARK_SPRITE_RADIUS = 96;

/** A soft radial dot; sparks are the only things in the field that emit light. */
export const buildSparkSprite = (palette: Palette): Sprite => {
  const r = SPARK_SPRITE_RADIUS;
  const canvas = createCanvas(r * 2, r * 2);
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, hexToRgba(palette.sparkPale, 1));
  gradient.addColorStop(0.16, hexToRgba(palette.sparkPale, 0.75));
  gradient.addColorStop(0.45, hexToRgba(palette.sparkPale, 0.16));
  gradient.addColorStop(1, hexToRgba(palette.sparkPale, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, r * 2, r * 2);
  return { canvas, scale: 1 };
};

/** Blits a sprite centred on the current transform origin. */
export const blitSprite = (
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  sizeMul: number,
  widthMul = 1,
) => {
  const s = sizeMul / sprite.scale;
  const w = sprite.canvas.width * s * widthMul;
  const h = sprite.canvas.height * s;
  ctx.drawImage(sprite.canvas, -w / 2, -h / 2, w, h);
};
