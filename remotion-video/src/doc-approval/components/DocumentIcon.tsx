import React, { useLayoutEffect, useMemo, useRef } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
  DOC_CENTERS,
  DOC_ENTRANCE_ORDER,
  DOC_HEIGHT,
  DOC_WIDTH,
  STACK_INDICES,
  TIMING,
} from "../layout";
import { docBob, docDropout } from "../motion";
import type { MarkGlyph, Palette, Variant } from "../variants";
import { createOffscreen, pick, randInt, randRange, withAlpha } from "../util";

const PAD = 46;
/** How far each page behind the front one peeks out, up and to the left. */
const STACK_OFFSET = 24;
const SPRITE_WIDTH = DOC_WIDTH + PAD * 2 + STACK_OFFSET;
const SPRITE_HEIGHT = DOC_HEIGHT + PAD * 2 + STACK_OFFSET;
const PAGE_X = PAD + STACK_OFFSET;
const PAGE_Y = PAD + STACK_OFFSET;
const ANCHOR_X = PAGE_X + DOC_WIDTH / 2;
const ANCHOR_Y = PAGE_Y + DOC_HEIGHT / 2;

const FOLD = 62;
const TEXT_INSET = 34;
const TEXT_TOP = 100;
const TEXT_PITCH = 36;
/** Varied lengths, last one shortest. */
const TEXT_WIDTHS = [0.74, 0.9, 0.62, 0.82, 0.42];
const MARK_CENTER = { x: 196, y: 282 };
const MARK_RADIUS = 30;

/** A rectangle with the top-right corner folded away. */
const pagePath = (ctx: CanvasRenderingContext2D, x: number, y: number): void => {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + DOC_WIDTH - FOLD, y);
  ctx.lineTo(x + DOC_WIDTH, y + FOLD);
  ctx.lineTo(x + DOC_WIDTH, y + DOC_HEIGHT);
  ctx.lineTo(x, y + DOC_HEIGHT);
  ctx.closePath();
};

const drawMarkGlyph = (ctx: CanvasRenderingContext2D, glyph: MarkGlyph): void => {
  ctx.beginPath();
  if (glyph === "check") {
    ctx.moveTo(-13, 0);
    ctx.lineTo(-4, 10);
    ctx.lineTo(14, -11);
    ctx.stroke();
  } else {
    ctx.moveTo(-11, -11);
    ctx.lineTo(11, 11);
    ctx.moveTo(11, -11);
    ctx.lineTo(-11, 11);
    ctx.stroke();
  }
};

type SpriteOptions = {
  palette: Palette;
  mark: MarkGlyph;
  stacked: boolean;
  struckThrough: boolean;
};

const drawSprite = (
  ctx: CanvasRenderingContext2D,
  { palette, mark, stacked, struckThrough }: SpriteOptions,
): void => {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Pages behind the front one, drawn back to front so each occludes the
  // one before it.
  const layers = stacked
    ? [
        { x: PAGE_X - STACK_OFFSET, y: PAGE_Y - STACK_OFFSET, alpha: 0.45 },
        { x: PAGE_X - STACK_OFFSET / 2, y: PAGE_Y - STACK_OFFSET / 2, alpha: 0.7 },
        { x: PAGE_X, y: PAGE_Y, alpha: 1 },
      ]
    : [{ x: PAGE_X, y: PAGE_Y, alpha: 1 }];

  for (const layer of layers) {
    pagePath(ctx, layer.x, layer.y);
    ctx.fillStyle = withAlpha(palette.backgroundDeep, 0.62);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = withAlpha(palette.docOutline, layer.alpha);
    ctx.stroke();
  }

  // The fold itself: the small triangle plus its two inner edges.
  const fx = PAGE_X + DOC_WIDTH - FOLD;
  ctx.beginPath();
  ctx.moveTo(fx, PAGE_Y);
  ctx.lineTo(fx, PAGE_Y + FOLD);
  ctx.lineTo(PAGE_X + DOC_WIDTH, PAGE_Y + FOLD);
  ctx.closePath();
  ctx.fillStyle = withAlpha(palette.docOutline, 0.14);
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = withAlpha(palette.docOutline, 0.95);
  ctx.beginPath();
  ctx.moveTo(fx, PAGE_Y);
  ctx.lineTo(fx, PAGE_Y + FOLD);
  ctx.lineTo(PAGE_X + DOC_WIDTH, PAGE_Y + FOLD);
  ctx.stroke();

  // Short text lines.
  ctx.lineWidth = 9;
  ctx.strokeStyle = withAlpha(palette.docOutline, 0.8);
  const usable = DOC_WIDTH - TEXT_INSET * 2;
  TEXT_WIDTHS.forEach((ratio, i) => {
    const y = PAGE_Y + TEXT_TOP + i * TEXT_PITCH;
    ctx.beginPath();
    ctx.moveTo(PAGE_X + TEXT_INSET, y);
    ctx.lineTo(PAGE_X + TEXT_INSET + usable * ratio, y);
    ctx.stroke();
  });

  // The circular mark, with a moderate bloom of its own.
  ctx.save();
  ctx.translate(PAGE_X + MARK_CENTER.x, PAGE_Y + MARK_CENTER.y);
  ctx.strokeStyle = palette.docMark;
  ctx.shadowColor = palette.docMark;
  ctx.shadowBlur = 22;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, 0, MARK_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  drawMarkGlyph(ctx, mark);
  ctx.shadowBlur = 0;
  ctx.restore();

  if (struckThrough) {
    ctx.lineWidth = 10;
    ctx.strokeStyle = withAlpha(palette.docOutline, 0.85);
    ctx.beginPath();
    ctx.moveTo(PAGE_X + 14, PAGE_Y + DOC_HEIGHT - 16);
    ctx.lineTo(PAGE_X + DOC_WIDTH - 14, PAGE_Y + 16);
    ctx.stroke();
  }
};

type Props = { index: number; variant: Variant };

/**
 * One document. The artwork is baked into an offscreen buffer once and blitted
 * with a transform every frame; only the entrance spring, the idle bob and
 * (on the rejected variant) the dropout flicker change per frame.
 */
export const DocumentIcon: React.FC<Props> = ({ index, variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const center = DOC_CENTERS[index];
  const stacked = STACK_INDICES.includes(index);
  const struckThrough = variant.documents.strikeThrough.includes(index);
  const { palette, documents } = variant;

  const sprite = useMemo(() => {
    const buffer = createOffscreen(SPRITE_WIDTH, SPRITE_HEIGHT);
    const ctx = buffer?.getContext("2d");
    if (!buffer || !ctx) return buffer;
    drawSprite(ctx, { palette, mark: documents.mark, stacked, struckThrough });
    return buffer;
  }, [palette, documents.mark, stacked, struckThrough]);

  const bob = useMemo(() => {
    const s = `doc-bob-${index}`;
    return {
      amplitudeX: randRange(`${s}-ax`, 4, 9),
      amplitudeY: randRange(`${s}-ay`, 5, 11),
      phase: randRange(`${s}-p`, 0, 1),
    };
  }, [index]);

  const flicker = useMemo(() => {
    const s = `doc-flicker-${index}`;
    const period = pick(`${s}-p`, TIMING.docFlickerPeriods);
    return { period, offset: randInt(`${s}-o`, 0, period) };
  }, [index]);

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !sprite) return;
    ctx.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);

    const order = TIMING.docsStart + DOC_ENTRANCE_ORDER.indexOf(index) * TIMING.docStagger;
    const progress = spring({
      frame: frame - order,
      fps,
      config: { damping: 13, mass: 0.55 },
      durationInFrames: TIMING.docSpringDuration,
    });
    if (progress <= 0) return;

    const scale = 0.85 + 0.15 * progress;
    let alpha = interpolate(frame, [order, order + 14], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    if (documents.flicker && docDropout(frame, flicker.period, flicker.offset)) {
      alpha *= 0.3;
    }
    if (alpha <= 0) return;

    const offset = docBob(frame, bob.amplitudeX, bob.amplitudeY, bob.phase);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ANCHOR_X + offset.x, ANCHOR_Y + offset.y);
    ctx.scale(scale, scale);
    ctx.drawImage(sprite, -ANCHOR_X, -ANCHOR_Y);
    ctx.restore();
  });

  return (
    <canvas
      ref={canvasRef}
      width={SPRITE_WIDTH}
      height={SPRITE_HEIGHT}
      style={{
        position: "absolute",
        left: center.x - ANCHOR_X,
        top: center.y - ANCHOR_Y,
        width: SPRITE_WIDTH,
        height: SPRITE_HEIGHT,
      }}
    />
  );
};
