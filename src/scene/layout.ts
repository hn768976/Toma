import {CONFIG} from '../config';
import {applyToPoint} from '../lib/matrix';
import {
  blurEstimate,
  bucketForBlur,
  cameraMatrix,
  depthAt,
  DepthBucket,
  driftSpeed,
  screenToPlane,
} from '../lib/plane';
import {lerp, seededBool, seededFloat, seededInt} from '../lib/rng';
import {CodeLine, generateCodeBlock} from './codeSource';

/**
 * The static description of the scene: where every card and code block sits on
 * the plane, how big it is, and which depth bucket it composites through.
 *
 * Computed once (useMemo) and never per frame. Depth buckets in particular are
 * fixed for the whole shot — a card that changed buffers mid-push would pop.
 */

export type CardFill = 'white' | 'blue' | 'glass' | 'red';

export interface CardSpec {
  id: string;
  index: number;
  /** 0 = near the camera (bottom-left, large), 1 = far (upper-right, small). */
  depth: number;
  origin: {x: number; y: number};
  width: number;
  height: number;
  /** Small in-plane rotation, radians. Cards are not perfectly aligned. */
  rotation: number;
  fill: CardFill;
  tail: boolean;
  tailDirection: -1 | 1;
  hasBars: boolean;
  /** One entry per pre-baked variant; static cards have exactly one. */
  lineVariants: number[][];
  liveIndex: number | null;
  bucket: DepthBucket;
  drift: number;
  bob: {radius: number; frequency: number; phase: number};
  motionBlur: boolean;
}

export interface CodeBlockSpec {
  id: string;
  index: number;
  depth: number;
  origin: {x: number; y: number};
  opacity: number;
  lines: CodeLine[];
  drift: number;
  bob: {radius: number; frequency: number; phase: number};
}

const REST_MATRIX = cameraMatrix(CONFIG.push.from);

const screenPositionOf = (plane: {x: number; y: number}) =>
  applyToPoint(REST_MATRIX, plane.x, plane.y);

/** Push a card's centre out of the hero's clearing without moving it far. */
const clearHero = (p: {x: number; y: number}, radius: number) => {
  const d = Math.hypot(p.x, p.y);
  if (d >= radius || d === 0) return p;
  const k = radius / d;
  return {x: p.x * k, y: p.y * k};
};

const bobFor = (seed: string) => ({
  radius: CONFIG.cards.bobRadius * seededFloat(`${seed}-br`, 0.45, 1),
  frequency: seededFloat(`${seed}-bf`, 0.11, 0.34),
  phase: seededFloat(`${seed}-bp`, 0, Math.PI * 2),
});

const lineLengths = (seed: string, count: number): number[] =>
  Array.from({length: count}, (_, i) => seededFloat(`${seed}-ll-${i}`, 0.34, 0.94));

/**
 * A jittered cell of a grid laid over the frame — in *screen* space, then
 * converted to the plane. Distributing in plane space instead leaves the corners
 * of the frame empty, because the plane is rotated and sheared relative to it.
 */
const jitteredCell = (
  seed: string,
  column: number,
  row: number,
  columns: number,
  rows: number,
  region: {x0: number; y0: number; x1: number; y1: number},
) => {
  const cellW = (region.x1 - region.x0) / columns;
  const cellH = (region.y1 - region.y0) / rows;
  const x = region.x0 + (column + seededFloat(`${seed}-jx`, 0.05, 0.95)) * cellW;
  const y = region.y0 + (row + seededFloat(`${seed}-jy`, 0.05, 0.95)) * cellH;
  return screenToPlane(x, y);
};

const jitteredCellTight = (
  seed: string,
  column: number,
  row: number,
  columns: number,
  rows: number,
  region: {x0: number; y0: number; x1: number; y1: number},
) => {
  const cellW = (region.x1 - region.x0) / columns;
  const cellH = (region.y1 - region.y0) / rows;
  const x = region.x0 + (column + seededFloat(`${seed}-tx`, 0.28, 0.72)) * cellW;
  const y = region.y0 + (row + seededFloat(`${seed}-ty`, 0.22, 0.78)) * cellH;
  return screenToPlane(x, y);
};

const OVERSCAN_REGION = (() => {
  const margin = (CONFIG.plane.overscan - 1) / 2;
  return {
    x0: -CONFIG.width * margin,
    y0: -CONFIG.height * margin,
    x1: CONFIG.width * (1 + margin),
    y1: CONFIG.height * (1 + margin),
  };
})();

export const buildCards = (): CardSpec[] => {
  const {columns, rows, redCount, redDepthRange, heroExclusionRadius} = CONFIG.cards;
  const count = columns * rows;

  const draft = Array.from({length: count}, (_, i) => {
    const id = `card-${i}`;
    const placed = jitteredCell(
      id,
      i % columns,
      Math.floor(i / columns),
      columns,
      rows,
      OVERSCAN_REGION,
    );
    const origin = clearHero(placed, heroExclusionRadius);
    // Depth is read back from where the card landed, so "near = bottom-left,
    // far = upper-right" holds by construction rather than by convention.
    return {id, index: i, depth: depthAt(origin.x, origin.y), origin};
  });

  // Red is a counterweight, not a theme: a few small mid-distance cards, well
  // clear of the hero, and — crucially — actually inside the frame. Selecting on
  // plane distance alone parks them on the edges where they read as artefacts.
  const inset = CONFIG.cards.redFrameInset;
  const onScreenMidDistance = draft.filter((c) => {
    if (c.depth < redDepthRange[0] || c.depth > redDepthRange[1]) return false;
    const [sx, sy] = screenPositionOf(c.origin);
    return (
      sx > CONFIG.width * inset &&
      sx < CONFIG.width * (1 - inset) &&
      sy > CONFIG.height * inset &&
      sy < CONFIG.height * (1 - inset)
    );
  });
  const heroDistance = (c: (typeof draft)[number]) => Math.hypot(c.origin.x, c.origin.y);
  const minDistance = heroExclusionRadius * CONFIG.cards.redMinHeroDistance;
  // Prefer candidates well clear of the badge; if the layout does not offer
  // enough, fall back to the furthest available rather than dropping a card.
  const ranked = [
    ...onScreenMidDistance
      .filter((c) => heroDistance(c) >= minDistance)
      .sort((a, b) => seededFloat(`${a.id}-redkey`, 0, 1) - seededFloat(`${b.id}-redkey`, 0, 1)),
    ...onScreenMidDistance
      .filter((c) => heroDistance(c) < minDistance)
      .sort((a, b) => heroDistance(b) - heroDistance(a)),
  ];
  const redSet = new Set(ranked.slice(0, redCount).map((c) => c.index));

  // Live cards re-render their text lines mid-shot. Keep them where they can be
  // read: mid depth, so they land in the sharp or mid bucket.
  const liveOrder = draft
    .filter((c) => !redSet.has(c.index) && c.depth > 0.28 && c.depth < 0.8)
    .sort((a, b) => seededFloat(`${a.id}-livekey`, 0, 1) - seededFloat(`${b.id}-livekey`, 0, 1))
    .slice(0, CONFIG.cards.liveCount)
    .map((c) => c.index);
  const liveMap = new Map(liveOrder.map((idx, order) => [idx, order]));

  return draft.map((c) => {
    const {id, index, depth, origin} = c;

    const isRed = redSet.has(index);
    const fillRoll = seededFloat(`${id}-fill`, 0, 1);
    const fill: CardFill = isRed
      ? 'red'
      : fillRoll < 0.46
        ? 'white'
        : fillRoll < 0.72
          ? 'blue'
          : 'glass';

    const sizeScale =
      lerp(CONFIG.cards.nearScale, CONFIG.cards.farScale, depth) * (isRed ? 0.72 : 1);
    const baseWidth = seededFloat(`${id}-w`, CONFIG.cards.minWidth, CONFIG.cards.maxWidth);
    const aspect = seededFloat(`${id}-a`, CONFIG.cards.minAspect, CONFIG.cards.maxAspect);
    const width = baseWidth * sizeScale;
    const height = baseWidth * aspect * sizeScale;

    const [sx, sy] = screenPositionOf(origin);
    const bucket = bucketForBlur(blurEstimate(depth, sx, sy));

    const liveIndex = liveMap.get(index) ?? null;
    const lineCount = seededInt(`${id}-lc`, 2, 5);
    const variantCount = liveIndex === null ? 1 : CONFIG.cards.liveVariants;
    const lineVariants = Array.from({length: variantCount}, (_, v) =>
      lineLengths(`${id}-v${v}`, lineCount),
    );

    return {
      id,
      index,
      depth,
      origin,
      width,
      height,
      rotation: seededFloat(`${id}-rot`, -0.055, 0.055),
      fill,
      tail: seededBool(`${id}-tail`, 0.72),
      tailDirection: seededBool(`${id}-td`, 0.5) ? 1 : (-1 as -1 | 1),
      hasBars: !isRed && seededBool(`${id}-bars`, CONFIG.cards.barMotifChance),
      lineVariants,
      liveIndex,
      bucket,
      drift: driftSpeed(depth),
      bob: bobFor(id),
      motionBlur: depth < CONFIG.motionBlur.depthCutoff,
    };
  });
};

/**
 * Code blocks cluster in the upper-left, where the cards are sparsest. Laid out
 * on their own jittered grid over that corner of the frame.
 */
export const buildCodeBlocks = (): CodeBlockSpec[] => {
  const {columns, rows} = CONFIG.code;
  const region = {
    x0: -CONFIG.width * 0.05,
    y0: -CONFIG.height * 0.05,
    x1: CONFIG.width * CONFIG.code.regionWidth,
    y1: CONFIG.height * CONFIG.code.regionHeight,
  };

  return Array.from({length: CONFIG.code.blocks}, (_, i) => {
    const id = `code-${i}`;
    const origin = clearHero(
      // Tight jitter: blocks are wider than their cells, so a loose jitter piles
      // two or three of them into an illegible mush.
      jitteredCellTight(id, i % columns, Math.floor(i / columns), columns, rows, region),
      CONFIG.cards.heroExclusionRadius * 1.25,
    );
    const depth = depthAt(origin.x, origin.y);

    return {
      id,
      index: i,
      depth,
      origin,
      opacity: seededFloat(`${id}-o`, CONFIG.code.minOpacity, CONFIG.code.maxOpacity),
      lines: generateCodeBlock(id),
      drift: driftSpeed(depth) * 0.8,
      bob: bobFor(`${id}-bob`),
    };
  });
};

/**
 * Which pre-baked line-length variant each live card shows on each frame.
 *
 * Two to three message events per second across the whole field, seeded from the
 * frame index. Precomputed for the full duration so a frame rendered in
 * isolation — which is how `remotion render` works — agrees with its neighbours.
 */
export const buildLiveVariantTimeline = (cards: CardSpec[]): number[][] => {
  const liveCards = cards.filter((c) => c.liveIndex !== null);
  const timeline = Array.from({length: CONFIG.cards.liveCount}, () =>
    new Array<number>(CONFIG.durationInFrames).fill(0),
  );
  if (liveCards.length === 0) return timeline;

  const current = new Array<number>(CONFIG.cards.liveCount).fill(0);
  const epochs = Math.ceil(CONFIG.durationInFrames / CONFIG.cards.liveEventInterval);

  for (let epoch = 0; epoch < epochs; epoch++) {
    // One card updates per epoch — 2.5 events per second at 30fps.
    const who = seededInt(`msg-epoch-${epoch}`, 0, liveCards.length - 1);
    const slot = liveCards[who].liveIndex as number;
    current[slot] = (current[slot] + 1) % CONFIG.cards.liveVariants;

    const from = epoch * CONFIG.cards.liveEventInterval;
    const to = Math.min(CONFIG.durationInFrames, from + CONFIG.cards.liveEventInterval);
    for (let f = from; f < to; f++) {
      for (let slotIndex = 0; slotIndex < current.length; slotIndex++) {
        timeline[slotIndex][f] = current[slotIndex];
      }
    }
  }
  return timeline;
};
