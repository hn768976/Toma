import {useMemo} from 'react';
import {CONFIG} from '../config';
import {context2d, createBuffer, roundRectPath, speechTailPath} from '../lib/canvas';
import {setTransform} from '../lib/matrix';
import {paintBarCluster} from '../lib/motifs';
import {cameraMatrix, depthPushMultiplier, DRIFT_DIRECTION, pushScale} from '../lib/plane';
import {seededBool, seededFloat} from '../lib/rng';
import {CardSpec} from '../scene/layout';
import {mixColors, Theme, withAlpha} from '../theme';

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

interface CardPalette {
  body: string;
  rim: string;
  line: string;
  lineAlpha: number;
  bars: string;
}

const paletteFor = (spec: CardSpec, theme: Theme): CardPalette => {
  switch (spec.fill) {
    case 'white':
      return {
        body: theme.cardWhite,
        rim: withAlpha(theme.badgeWhite, 0.5),
        line: theme.lineBlue,
        lineAlpha: 0.88,
        bars: theme.glowCyan,
      };
    case 'blue':
      return {
        body: theme.cardBlue,
        rim: withAlpha(theme.lineBlue, 0.7),
        // Filled blue cards carry white or lighter-blue lines.
        line: seededBool(`${spec.id}-linehue`, 0.5)
          ? theme.badgeWhite
          : mixColors(theme.lineBlue, theme.cardWhite, 0.55),
        lineAlpha: 0.85,
        bars: mixColors(theme.glowCyan, theme.cardWhite, 0.25),
      };
    case 'red':
      return {
        body: theme.accentRed,
        rim: withAlpha(theme.accentRed, 0.9),
        line: theme.cardWhite,
        lineAlpha: 0.5,
        bars: theme.glowCyan,
      };
    case 'glass':
    default:
      return {
        body: withAlpha(theme.cardWhite, 0.16),
        rim: withAlpha(theme.lineBlue, 0.5),
        line: theme.lineBlue,
        lineAlpha: 0.6,
        bars: theme.glowCyan,
      };
  }
};

const PADDING = 26;

const bakeVariant = (spec: CardSpec, theme: Theme, lengths: number[]): CardSprite => {
  const palette = paletteFor(spec, theme);
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
    ctx.fillStyle = palette.body;
    speechTailPath(ctx, anchorX, by + bh - 1, tailWidth, tailHeight, spec.tailDirection);
    ctx.fill();
  }

  ctx.fillStyle = palette.body;
  roundRectPath(ctx, bx, by, bw, bh, radius);
  ctx.fill();

  ctx.strokeStyle = palette.rim;
  ctx.lineWidth = Math.max(1.5, bw * 0.004);
  ctx.stroke();

  // A soft inner highlight along the top edge. White cards are bright surfaces
  // catching the badge's glow, and this is what makes them bloom once blurred.
  if (spec.fill === 'white' || spec.fill === 'glass') {
    const sheen = ctx.createLinearGradient(bx, by, bx, by + bh * 0.6);
    sheen.addColorStop(0, withAlpha(theme.badgeWhite, spec.fill === 'white' ? 0.5 : 0.18));
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

  ctx.globalAlpha = palette.lineAlpha;
  ctx.fillStyle = palette.line;
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
    paintBarCluster(
      ctx,
      bx + bw - inset - barZoneWidth,
      by + bh * 0.3,
      barZoneWidth,
      bh * 0.4,
      heights,
      palette.bars,
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
