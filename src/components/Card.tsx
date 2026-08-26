import {useMemo} from 'react';
import {CONFIG} from '../config';
import {context2d, createBuffer, roundRectPath, speechTailPath} from '../lib/canvas';
import {setTransform} from '../lib/matrix';
import {dotStatesAtFrame, paintMotif} from '../lib/motifs';
import {cameraMatrix, depthPushMultiplier, DRIFT_DIRECTION, pushScale} from '../lib/plane';
import {seededBool, seededFloat, seededInt} from '../lib/rng';
import {CardSpec} from '../scene/layout';
import {CardFillStyle, Theme, withAlpha} from '../theme';

/**
 * A surrounding message card.
 *
 * Baked once to a small offscreen canvas per line-length variant, then blitted
 * with a transform every frame. Laying out twenty-eight cards of text lines at
 * 4K on every frame is the most expensive mistake available here.
 */

export interface CardSprite {
  canvas: HTMLCanvasElement;
  /** Sprite footprint in plane units. */
  width: number;
  height: number;
  /** Distance from the sprite's top edge down to the card body's centre. */
  bodyCentreY: number;
}

export interface BakedCard {
  spec: CardSpec;
  /** One sprite per pre-baked line-length variant. Static cards have one. */
  variants: CardSprite[];
}

/**
 * A card's style comes straight out of the theme. The seeded coin flip between
 * `line` and `lineAlt` is what gives filled cards two different line colours;
 * themes that do not want that variation set both to the same value.
 */
const styleFor = (spec: CardSpec, theme: Theme): CardFillStyle & {chosenLine: string} => {
  const style = theme.cardFills[spec.fill];
  return {
    ...style,
    chosenLine: seededBool(`${spec.id}-linehue`, 0.5) ? style.line : style.lineAlt,
  };
};

const PADDING = 26;

const bakeVariant = (spec: CardSpec, theme: Theme, lengths: number[]): CardSprite => {
  const style = styleFor(spec, theme);
  const tailHeight = spec.tail ? Math.min(spec.height * 0.2, 54) : 0;
  const width = spec.width + PADDING * 2;
  const height = spec.height + tailHeight + PADDING * 2;

  // Resolution is capped: the nearest cards are heavily blurred anyway, so extra
  // sprite pixels there buy nothing but memory.
  const longest = Math.max(width, height);
  const resolution = Math.min(
    CONFIG.sprites.supersample,
    CONFIG.sprites.maxSide / longest,
  );

  const canvas = createBuffer(width * resolution, height * resolution);
  const ctx = context2d(canvas);
  ctx.scale(resolution, resolution);

  const bx = PADDING;
  const by = PADDING;
  const bw = spec.width;
  const bh = spec.height;
  const radius = Math.min(bw, bh) * 0.14;

  // Tail first, so the body's rim draws over the seam.
  if (spec.tail) {
    const tailWidth = Math.min(bw * 0.22, 96);
    const anchorX = spec.tailDirection === 1 ? bx + bw * 0.24 : bx + bw * 0.76;
    ctx.fillStyle = style.body;
    speechTailPath(ctx, anchorX, by + bh - 1, tailWidth, tailHeight, spec.tailDirection);
    ctx.fill();
  }

  ctx.fillStyle = style.body;
  roundRectPath(ctx, bx, by, bw, bh, radius);
  ctx.fill();

  // On a dark field this rim is the only thing separating one card from the next,
  // so its weight is a theme decision rather than a constant.
  ctx.strokeStyle = style.rim;
  ctx.lineWidth = Math.max(theme.rimWidthFloor, bw * theme.rimWidthFactor);
  ctx.stroke();

  // A soft inner highlight along the top edge. Light cards are bright surfaces
  // catching the badge's glow, and this is what makes them bloom once blurred.
  if (style.sheen > 0) {
    const sheen = ctx.createLinearGradient(bx, by, bx, by + bh * 0.6);
    sheen.addColorStop(0, withAlpha(theme.badgeWhite, style.sheen));
    sheen.addColorStop(1, withAlpha(theme.badgeWhite, 0));
    ctx.fillStyle = sheen;
    roundRectPath(ctx, bx, by, bw, bh, radius);
    ctx.fill();
  }

  const inset = bw * 0.085;
  const contentWidth = bw - inset * 2;
  const barZoneWidth = spec.hasBars ? contentWidth * 0.26 : 0;
  const textWidth = contentWidth - barZoneWidth - (spec.hasBars ? inset * 0.6 : 0);

  const lineCount = lengths.length;
  const lineHeight = bh * 0.082;
  const gap = bh * 0.062;
  const block = lineCount * lineHeight + (lineCount - 1) * gap;
  let ly = by + (bh - block) / 2;

  ctx.globalAlpha = style.lineAlpha;
  ctx.fillStyle = style.chosenLine;
  for (let i = 0; i < lineCount; i++) {
    const w = textWidth * lengths[i];
    roundRectPath(ctx, bx + inset, ly, w, lineHeight, lineHeight / 2);
    ctx.fill();
    ly += lineHeight + gap;
  }
  ctx.globalAlpha = 1;

  if (spec.hasBars) {
    const heights = Array.from({length: CONFIG.hero.barCount}, (_, i) =>
      seededFloat(`${spec.id}-bar-${i}`, 0.3, 1),
    );
    // Card motifs are baked, so they hold a pose: a seeded frame of the bounce
    // keeps the dot cards from all looking identical.
    const dots = dotStatesAtFrame(seededInt(`${spec.id}-dotpose`, 0, CONFIG.hero.dotPeriodFrames - 1));
    paintMotif(
      ctx,
      theme.motif,
      bx + bw - inset - barZoneWidth,
      by + bh * 0.3,
      barZoneWidth,
      bh * 0.4,
      style.motif,
      heights,
      dots,
    );
  }

  return {canvas, width, height, bodyCentreY: PADDING + bh / 2};
};

export const bakeCard = (spec: CardSpec, theme: Theme): BakedCard => ({
  spec,
  variants: spec.lineVariants.map((lengths) => bakeVariant(spec, theme, lengths)),
});

export const useBakedCards = (specs: CardSpec[], theme: Theme): BakedCard[] =>
  useMemo(() => specs.map((spec) => bakeCard(spec, theme)), [specs, theme]);

/** Where a card's centre sits on the plane at a (possibly fractional) frame. */
export const cardPlanePosition = (spec: CardSpec, frame: number) => {
  const travel = spec.drift * frame;
  const angle = (2 * Math.PI * spec.bob.frequency * frame) / CONFIG.fps + spec.bob.phase;
  return {
    x: spec.origin.x + DRIFT_DIRECTION.x * travel + Math.cos(angle) * spec.bob.radius,
    y: spec.origin.y + DRIFT_DIRECTION.y * travel + Math.sin(angle) * spec.bob.radius,
  };
};

export interface PaintCardOptions {
  frame: number;
  variantIndex: number;
  alpha: number;
}

export const paintCard = (
  ctx: CanvasRenderingContext2D,
  baked: BakedCard,
  {frame, variantIndex, alpha}: PaintCardOptions,
): void => {
  const {spec} = baked;
  const sprite = baked.variants[Math.min(variantIndex, baked.variants.length - 1)];
  const position = cardPlanePosition(spec, frame);
  const scale = pushScale(frame, depthPushMultiplier(spec.depth));

  ctx.save();
  setTransform(ctx, cameraMatrix(scale));
  ctx.translate(position.x, position.y);
  ctx.rotate(spec.rotation);
  ctx.globalAlpha = alpha;
  ctx.drawImage(
    sprite.canvas,
    -sprite.width / 2,
    -sprite.bodyCentreY,
    sprite.width,
    sprite.height,
  );
  ctx.restore();
};

/**
 * Near cards move fast enough during the push to strobe at 30fps. Draw them
 * three times along their motion vector at falling alpha, spanning about one
 * frame of travel.
 */
export const paintCardWithMotionBlur = (
  ctx: CanvasRenderingContext2D,
  baked: BakedCard,
  frame: number,
  variantIndex: number,
): void => {
  if (!baked.spec.motionBlur) {
    paintCard(ctx, baked, {frame, variantIndex, alpha: 1});
    return;
  }

  const {samples, frameSpan} = CONFIG.motionBlur;
  // Weights fall off across the smear and sum to 1, so total density is unchanged.
  const weights = Array.from({length: samples}, (_, i) => 1 / (i + 1));
  const total = weights.reduce((a, b) => a + b, 0);

  for (let i = samples - 1; i >= 0; i--) {
    const offset = -(frameSpan * i) / samples;
    paintCard(ctx, baked, {
      frame: frame + offset,
      variantIndex,
      alpha: weights[i] / total,
    });
  }
};
