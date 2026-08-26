import {CONFIG} from '../config';

/**
 * Hero layout, in plane units, derived once from CONFIG.
 *
 * The plane origin is the *badge* centre, not the bubble centre — the camera
 * push is anchored there, so putting the origin anywhere else would let the
 * badge drift as the world scales.
 */

const bubbleHeight = CONFIG.height * CONFIG.hero.bubbleHeightFraction;
const bubbleWidth = bubbleHeight * CONFIG.hero.bubbleAspect;
const badgeSize = bubbleHeight * CONFIG.hero.badgeHeightFraction;
const barsWidth = badgeSize * 0.62;
const barsHeight = badgeSize * 0.66;
const badgeToBarsGap = badgeSize * 0.3;

/** Badge and bar cluster sit side by side, and the pair is centred in the bubble. */
const groupWidth = badgeSize + badgeToBarsGap + barsWidth;

export const HERO = {
  bubbleWidth,
  bubbleHeight,
  bubbleRadius: bubbleHeight * 0.16,
  /** Bubble centre relative to the badge centre at the origin. */
  bubbleCentreX: groupWidth / 2 - badgeSize / 2,
  bubbleCentreY: 0,

  badgeSize,
  badgeRadius: badgeSize * 0.2,

  barsWidth,
  barsHeight,
  /** Left edge of the bar cluster, relative to the badge centre. */
  barsLeft: badgeSize / 2 + badgeToBarsGap,

  tailWidth: bubbleWidth * 0.17,
  tailHeight: bubbleHeight * 0.24,
  /** Where the tail meets the bubble's bottom edge, from the bubble's left. */
  tailInset: bubbleWidth * 0.15,

  previewGap: bubbleHeight * 0.12,
  previewLineHeight: bubbleHeight * 0.045,
} as const;

export const BUBBLE_TOP = HERO.bubbleCentreY - bubbleHeight / 2;
export const BUBBLE_BOTTOM = HERO.bubbleCentreY + bubbleHeight / 2;
export const BUBBLE_LEFT = HERO.bubbleCentreX - bubbleWidth / 2;
