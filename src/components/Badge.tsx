import {CONFIG} from '../config';
import {DISPLAY_FAMILY} from '../fonts';
import {roundRectPath} from '../lib/canvas';
import {setTransform} from '../lib/matrix';
import {Theme, withAlpha} from '../theme';
import {heroCameraMatrix} from './HeroBubble';
import {HERO} from '../scene/heroGeometry';

/**
 * The AI badge and its halo.
 *
 * The badge sits at the plane origin and never moves or rotates. Its glyph is
 * the sharpest, brightest thing in the frame; everything else is softer.
 */

/** Slow ±12% breath on the halo, period 90 frames. */
export const glowIntensityAtFrame = (frame: number): number =>
  CONFIG.hero.glowIntensity *
  (1 + CONFIG.hero.glowPulse * Math.sin((2 * Math.PI * frame) / CONFIG.hero.glowPeriodFrames));

interface GlowLayer {
  /** Radius as a multiple of the badge size. */
  reach: number;
  alpha: number;
}

/** Layered so the halo has a bright core and a long, soft spill. */
const GLOW_LAYERS: readonly GlowLayer[] = [
  {reach: 1, alpha: 0.36},
  {reach: 0.42, alpha: 0.4},
  {reach: 0.16, alpha: 0.58},
];

export const paintBadgeGlow = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  frame: number,
): void => {
  const intensity = glowIntensityAtFrame(frame);
  const maxRadius = HERO.badgeSize * CONFIG.hero.glowReach;

  ctx.save();
  setTransform(ctx, heroCameraMatrix(frame));
  ctx.globalCompositeOperation = 'lighter';

  for (const layer of GLOW_LAYERS) {
    const radius = maxRadius * layer.reach;
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    const peak = layer.alpha * intensity;
    gradient.addColorStop(0, withAlpha(theme.glowCyan, peak));
    gradient.addColorStop(0.32, withAlpha(theme.glowCyan, peak * 0.42));
    gradient.addColorStop(0.68, withAlpha(theme.glowCyan, peak * 0.11));
    gradient.addColorStop(1, withAlpha(theme.glowCyan, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  }

  ctx.restore();
};

/**
 * Cap height and tracking for a glyph.
 *
 * Two characters keep their exact configured cap height. Three or more lose
 * height and tighten up, then are shrunk further if they still overrun the
 * badge — the badge square never changes size, so a longer glyph has to give.
 * The fit only runs for long glyphs, so a two-character glyph can never be
 * altered by it.
 */
const glyphMetrics = (
  ctx: CanvasRenderingContext2D,
  glyph: string,
  size: number,
): {fontSize: number; tracking: number} => {
  const long = glyph.length >= 3;
  const fontSize = size * (long ? CONFIG.hero.glyphScaleLong : CONFIG.hero.glyphScale);
  const tracking = long ? CONFIG.hero.glyphTrackingLong : CONFIG.hero.glyphTracking;
  if (!long) {
    return {fontSize, tracking};
  }

  ctx.font = `800 ${fontSize}px "${DISPLAY_FAMILY}", sans-serif`;
  setTracking(ctx, fontSize * tracking);
  const measured = ctx.measureText(glyph).width;
  const maxWidth = size * CONFIG.hero.glyphMaxWidthFraction;
  return {
    fontSize: measured > maxWidth ? (fontSize * maxWidth) / measured : fontSize,
    tracking,
  };
};

const setTracking = (ctx: CanvasRenderingContext2D, px: number) => {
  (ctx as CanvasRenderingContext2D & {letterSpacing?: string}).letterSpacing = `${px}px`;
};

export const paintBadge = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  frame: number,
  glyph: string,
): void => {
  const size = HERO.badgeSize;
  const half = size / 2;
  const intensity = glowIntensityAtFrame(frame);

  ctx.save();
  setTransform(ctx, heroCameraMatrix(frame));

  // Soft blue-to-cyan body.
  const fill = ctx.createLinearGradient(-half, -half, half, half);
  fill.addColorStop(0, theme.badgeGradient[0]);
  fill.addColorStop(0.55, theme.badgeGradient[1]);
  fill.addColorStop(1, theme.badgeGradient[2]);
  ctx.fillStyle = fill;
  roundRectPath(ctx, -half, -half, size, size, HERO.badgeRadius);
  ctx.fill();

  // Bright cyan rim, with its own short bloom.
  ctx.shadowColor = withAlpha(theme.glowCyan, 0.9 * intensity);
  ctx.shadowBlur = size * 0.22;
  ctx.strokeStyle = theme.badgeRim;
  ctx.lineWidth = size * 0.024;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // The glyph: pure white, heavy, tight, and crisp.
  const {fontSize, tracking} = glyphMetrics(ctx, glyph, size);
  ctx.font = `800 ${fontSize}px "${DISPLAY_FAMILY}", sans-serif`;
  setTracking(ctx, fontSize * tracking);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const metrics = ctx.measureText(glyph);
  const centreOffset =
    (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;

  ctx.fillStyle = theme.badgeWhite;
  ctx.fillText(glyph, 0, centreOffset);
  setTracking(ctx, 0);

  ctx.restore();
};
