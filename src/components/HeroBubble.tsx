import {CONFIG} from '../config';
import {roundRectPath, speechTailPath} from '../lib/canvas';
import {setTransform} from '../lib/matrix';
import {dotStatesAtFrame, paintMotif} from '../lib/motifs';
import {cameraMatrix, pushScale} from '../lib/plane';
import {seededFloat} from '../lib/rng';
import {BUBBLE_BOTTOM, BUBBLE_LEFT, BUBBLE_TOP, HERO} from '../scene/heroGeometry';
import {Theme, withAlpha} from '../theme';

/**
 * The speech bubble holding the AI badge, plus the waveform cluster beside it and
 * the short text-preview lines below.
 *
 * It inherits the plane transform like everything else — a frontal bubble on a
 * tilted field would read as pasted on.
 */

/** Bar heights for the live waveform. The only fast motion in the piece. */
export const barHeightsAtFrame = (frame: number): number[] =>
  Array.from({length: CONFIG.hero.barCount}, (_, i) => {
    const hz = seededFloat(`hero-bar-hz-${i}`, CONFIG.hero.barMinHz, CONFIG.hero.barMaxHz);
    const phase = seededFloat(`hero-bar-phase-${i}`, 0, Math.PI * 2);
    const floor = seededFloat(`hero-bar-floor-${i}`, 0.18, 0.34);
    const wave = 0.5 + 0.5 * Math.sin((2 * Math.PI * hz * frame) / CONFIG.fps + phase);
    return floor + (1 - floor) * wave;
  });

export const heroCameraMatrix = (frame: number) =>
  cameraMatrix(pushScale(frame, CONFIG.push.heroMultiplier));

export const paintHeroBubble = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  frame: number,
): void => {
  ctx.save();
  setTransform(ctx, heroCameraMatrix(frame));

  const body = withAlpha(theme.bubbleBody, CONFIG.hero.bubbleAlpha);

  // Tail on the lower-left, drawn before the body so the rim covers the seam.
  ctx.fillStyle = body;
  speechTailPath(
    ctx,
    BUBBLE_LEFT + HERO.tailInset + HERO.tailWidth,
    BUBBLE_BOTTOM - 1,
    HERO.tailWidth,
    HERO.tailHeight,
    -1,
  );
  ctx.fill();

  ctx.fillStyle = body;
  roundRectPath(
    ctx,
    BUBBLE_LEFT,
    BUBBLE_TOP,
    HERO.bubbleWidth,
    HERO.bubbleHeight,
    HERO.bubbleRadius,
  );
  ctx.fill();

  ctx.strokeStyle = theme.bubbleRim;
  ctx.lineWidth = HERO.bubbleHeight * 0.005;
  ctx.stroke();

  // The cluster beside the badge: a live waveform, or a typing indicator.
  // Either way this is the only fast motion in the piece, and it is what makes
  // the badge feel active.
  paintMotif(
    ctx,
    theme.motif,
    HERO.barsLeft,
    -HERO.barsHeight / 2,
    HERO.barsWidth,
    HERO.barsHeight,
    theme.heroMotif,
    barHeightsAtFrame(frame),
    dotStatesAtFrame(frame),
  );

  // A few short lines below the bubble — a text preview.
  ctx.fillStyle = theme.heroLine;
  ctx.globalAlpha = 0.8;
  let y = BUBBLE_BOTTOM + HERO.tailHeight + HERO.previewGap;
  for (let i = 0; i < CONFIG.hero.previewLines; i++) {
    const w = HERO.bubbleWidth * seededFloat(`hero-preview-${i}`, 0.22, 0.5);
    roundRectPath(
      ctx,
      BUBBLE_LEFT + HERO.bubbleWidth * 0.06,
      y,
      w,
      HERO.previewLineHeight,
      HERO.previewLineHeight / 2,
    );
    ctx.fill();
    y += HERO.previewLineHeight * 2.1;
  }

  ctx.restore();
};
