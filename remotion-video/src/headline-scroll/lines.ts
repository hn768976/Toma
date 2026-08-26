// Builds the scrolling layer: one pre-blurred, seamlessly tileable buffer per
// line, plus the numbers needed to blit it each frame.
//
// The expensive mistake this file exists to avoid is re-laying-out and
// re-blurring twelve lines of 4K text every frame. Instead each line is drawn
// once, blurred once, and cropped to exactly one tile period; the per-frame
// work is a handful of drawImage() calls with an x offset.

import { random } from "remotion";
import {
  BLUR_FLOOR,
  BLUR_JITTER,
  CAP_HEIGHT_GAMMA,
  CAP_HEIGHT_MAX,
  CAP_HEIGHT_MIN,
  DURATION_IN_FRAMES,
  HEIGHT,
  LINE_ALPHA,
  LINE_CHROMATIC_MIN_CAP_HEIGHT,
  LINE_CHROMATIC_OFFSET,
  LINE_COUNT,
  LINE_DRIFT_AMPLITUDE,
  LINE_DRIFT_PERIODS,
  LINE_TIER_BREAKS,
  SCROLL_REVERSE_FRACTION,
  SCROLL_SPEED,
  SCROLL_SPEED_DEPTH_RANGE,
  SCROLL_SPEED_JITTER,
  TILE_GAP_RATIO,
  WIDTH,
} from "./constants";
import { BODY, FRAGMENTS, HEADLINES, SEPARATOR, SMALL_CAPS } from "./copy";
import { SANS_FAMILY, SERIF_FAMILY } from "./fonts";
import { type Theme, toRgb } from "./theme";

/** One phrase inside a tile, positioned from the tile's left edge. */
export type LineSegment = { text: string; x: number };

export type LineSpec = {
  /** The phrases making up exactly one tile. */
  segments: LineSegment[];
  font: string;
  letterSpacing: string;
  capHeight: number;
  blur: number;
  color: string;
  alpha: number;
  /** 0 on the smaller lines — fringing there would only read as mud. */
  chromatic: number;
  /** -1 scrolls right-to-left, +1 left-to-right. */
  direction: -1 | 1;
  /** Whole tile repeats crossed in DURATION_IN_FRAMES. Keeps the loop exact. */
  cycles: number;
  /** Integer tile period in px; also the width of the pre-blurred buffer. */
  tileWidth: number;
  /** px per frame, always cycles * tileWidth / DURATION_IN_FRAMES. */
  speed: number;
  /** Vertical centre of the cap height, at rest. */
  y: number;
  driftAmplitude: number;
  driftPeriod: number;
  driftPhase: number;
};

export type LineBuffer = {
  spec: LineSpec;
  canvas: HTMLCanvasElement;
  /** Distance from the line's y to the top of the buffer. */
  offsetY: number;
  /** How many blits are needed to span the frame. */
  repeats: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
/** Seeded value in [-1, 1]. */
const signed = (seed: string) => random(seed) * 2 - 1;
const pick = <T,>(items: readonly T[], seed: string): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

export const createCanvas = (
  width: number,
  height: number,
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
};

const context2d = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("HeadlineScroll: 2D canvas context unavailable");
  return ctx;
};

/** Cap height of a face as a fraction of its font size, measured not guessed. */
const measureCapRatio = (
  ctx: CanvasRenderingContext2D,
  weight: number,
  family: string,
): number => {
  const probe = 200;
  ctx.letterSpacing = "0px";
  ctx.font = `${weight} ${probe}px "${family}"`;
  const ascent = ctx.measureText("H").actualBoundingBoxAscent;
  return ascent / probe;
};

const measureWidth = (
  ctx: CanvasRenderingContext2D,
  font: string,
  letterSpacing: string,
  text: string,
): number => {
  ctx.font = font;
  ctx.letterSpacing = letterSpacing;
  return ctx.measureText(text).width;
};

/** Seeded Fisher-Yates, so depth and vertical slot are not correlated. */
const shuffledSlots = (count: number, seed: string): number[] => {
  const slots = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random(`${seed}-${i}`) * (i + 1));
    const tmp = slots[i];
    slots[i] = slots[j];
    slots[j] = tmp;
  }
  return slots;
};

type Tier = {
  weight: number;
  family: string;
  pool: readonly string[];
  tracking: number;
  upper: boolean;
};

/**
 * Typography by depth. Big near lines are heavy-sans slabs, the middle band
 * mixes sans headlines with a serif, and the far band is serif body copy and
 * small caps. The mix is what makes it read as a montage rather than a ticker.
 */
const tierFor = (depth: number, roll: number): Tier => {
  if (depth >= LINE_TIER_BREAKS[1]) {
    return {
      weight: 900,
      family: SANS_FAMILY,
      pool: FRAGMENTS,
      tracking: 0,
      upper: true,
    };
  }
  if (depth >= LINE_TIER_BREAKS[0]) {
    return roll < 0.55
      ? {
          weight: 700,
          family: SANS_FAMILY,
          pool: HEADLINES,
          tracking: 0,
          upper: false,
        }
      : {
          weight: 600,
          family: SERIF_FAMILY,
          pool: HEADLINES,
          tracking: 0,
          upper: false,
        };
  }
  return roll < 0.38
    ? {
        weight: 500,
        family: SANS_FAMILY,
        pool: SMALL_CAPS,
        tracking: 0.17,
        upper: true,
      }
    : {
        weight: 400,
        family: SERIF_FAMILY,
        pool: BODY,
        tracking: 0,
        upper: false,
      };
};

const colorFor = (theme: Theme, depth: number) => {
  if (depth >= LINE_TIER_BREAKS[1])
    return { color: theme.textBright, alpha: LINE_ALPHA.bright };
  if (depth >= LINE_TIER_BREAKS[0])
    return { color: theme.textMid, alpha: LINE_ALPHA.mid };
  return { color: theme.textDim, alpha: LINE_ALPHA.dim };
};

export const buildLineSpecs = (theme: Theme, seed: string): LineSpec[] => {
  const ctx = context2d(createCanvas(8, 8));
  const capRatios = new Map<string, number>();
  const ratioOf = (weight: number, family: string) => {
    const key = `${weight}-${family}`;
    const cached = capRatios.get(key);
    if (cached !== undefined) return cached;
    const ratio = measureCapRatio(ctx, weight, family);
    capRatios.set(key, ratio);
    return ratio;
  };

  const slots = shuffledSlots(LINE_COUNT, `${seed}-slot`);

  return Array.from({ length: LINE_COUNT }, (_, i): LineSpec => {
    // Stratified so the depth stack is always evenly populated: 0 = far and
    // small, 1 = near, big and most out of focus.
    const depth = (i + random(`${seed}-depth-${i}`)) / LINE_COUNT;

    const capHeight =
      CAP_HEIGHT_MIN +
      (CAP_HEIGHT_MAX - CAP_HEIGHT_MIN) * Math.pow(depth, CAP_HEIGHT_GAMMA);
    const blur = clamp(
      lerp(BLUR_FLOOR, theme.lines.blurCeiling, depth) +
        signed(`${seed}-blur-${i}`) * BLUR_JITTER,
      BLUR_FLOOR,
      theme.lines.blurCeiling,
    );

    const tier = tierFor(depth, random(`${seed}-style-${i}`));
    const fontSize = capHeight / ratioOf(tier.weight, tier.family);
    const font = `${tier.weight} ${fontSize}px "${tier.family}"`;
    const letterSpacing = `${fontSize * tier.tracking}px`;

    // Speed first: nearer lines parallax faster, then +/-40% per line.
    const targetSpeed =
      SCROLL_SPEED *
      lerp(SCROLL_SPEED_DEPTH_RANGE[0], SCROLL_SPEED_DEPTH_RANGE[1], depth) *
      (1 + SCROLL_SPEED_JITTER * signed(`${seed}-speed-${i}`));
    const travel = targetSpeed * DURATION_IN_FRAMES;
    const gap = capHeight * TILE_GAP_RATIO;

    // Then copy. A tile is packed with as many *different* phrases as fit
    // inside one loop's travel, rather than one phrase repeated: at a fixed
    // loop length the tile period is pinned to the distance travelled, so
    // filling that distance with varied copy is the only way to stop the line
    // reading as a ticker.
    const pieces = shuffledSlots(tier.pool.length, `${seed}-copy-${i}`).map(
      (index) => {
        const phrase = tier.pool[index];
        const text = (tier.upper ? phrase.toUpperCase() : phrase) + SEPARATOR;
        return { text, width: measureWidth(ctx, font, letterSpacing, text) };
      },
    );
    const segments: LineSegment[] = [];
    let cursor = 0;
    // Greedy fill, skipping (not stopping at) anything too wide for the room
    // left, and cycling the pool until nothing more fits.
    for (let pass = 0; pass < 3; pass++) {
      let added = false;
      for (const piece of pieces) {
        if (cursor + piece.width + gap > travel) continue;
        segments.push({ text: piece.text, x: cursor });
        cursor += piece.width + gap;
        added = true;
      }
      if (!added) break;
    }
    if (segments.length === 0) {
      // Even the shortest phrase is wider than a loop's travel: keep the copy
      // and accept a line that runs faster than its nominal speed.
      const narrowest = pieces.reduce((a, b) => (b.width < a.width ? b : a));
      segments.push({ text: narrowest.text, x: 0 });
      cursor = narrowest.width + gap;
    }
    const contentWidth = cursor;

    // Whole cycles per loop is what makes frame 0 and frame 210 identical: the
    // tile period is an integer, and one loop advances an exact multiple of it.
    const cycles = Math.max(1, Math.floor(travel / contentWidth));
    const tileWidth = Math.max(
      Math.ceil(contentWidth),
      Math.round(travel / cycles),
    );
    const speed = (cycles * tileWidth) / DURATION_IN_FRAMES;

    const slotSpan = HEIGHT * 1.08;
    const y =
      ((slots[i] + 0.5) / LINE_COUNT) * slotSpan -
      HEIGHT * 0.04 +
      signed(`${seed}-y-${i}`) * HEIGHT * 0.03;

    return {
      segments,
      font,
      letterSpacing,
      capHeight,
      blur,
      ...colorFor(theme, depth),
      chromatic:
        capHeight >= LINE_CHROMATIC_MIN_CAP_HEIGHT ? LINE_CHROMATIC_OFFSET : 0,
      direction: random(`${seed}-dir-${i}`) < SCROLL_REVERSE_FRACTION ? 1 : -1,
      cycles,
      tileWidth,
      speed,
      y,
      driftAmplitude: lerp(
        LINE_DRIFT_AMPLITUDE[0],
        LINE_DRIFT_AMPLITUDE[1],
        random(`${seed}-drift-${i}`),
      ),
      driftPeriod: pick(LINE_DRIFT_PERIODS, `${seed}-driftp-${i}`),
      driftPhase: random(`${seed}-driftphase-${i}`) * Math.PI * 2,
    };
  });
};

const rgbString = (c: [number, number, number]) =>
  `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;

/**
 * Works out the two offset impressions so that where they overlap they resolve
 * back to exactly the intended colour, and only the leading and trailing few
 * pixels show red or cyan. That exact-overlap property is what makes the split
 * read as aberration rather than as a coloured drop shadow.
 *
 * Additive ground: the colour is divided between the two fringe hues so the
 * pair sums back to it.
 *
 * Subtractive ground: the first impression is paper tinted toward red, and the
 * second is whatever the first still has to be multiplied by to land on the
 * colour — which comes out on the cyan side of neutral. Tinting from paper
 * rather than using the saturated hue outright is what keeps that second
 * impression inside gamut, so the overlap stays exact.
 */
export const fringeImpressions = (
  color: string,
  fringe: Theme["fringe"],
): [string, string] => {
  const base = toRgb(color);
  const red = toRgb(fringe.red);
  const cyan = toRgb(fringe.cyan);

  if (fringe.blend === "lighter") {
    const split = (i: number): [number, number] => {
      const total = red[i] + cyan[i];
      if (total === 0) return [base[i] / 2, base[i] / 2];
      return [(base[i] * red[i]) / total, (base[i] * cyan[i]) / total];
    };
    const channels = [split(0), split(1), split(2)];
    return [
      rgbString([channels[0][0], channels[1][0], channels[2][0]]),
      rgbString([channels[0][1], channels[1][1], channels[2][1]]),
    ];
  }

  const first = red.map((c) => 255 - (255 - c) * fringe.strength) as [
    number,
    number,
    number,
  ];
  const second = base.map((c, i) =>
    clamp((c / Math.max(1, first[i])) * 255, 0, 255),
  ) as [number, number, number];
  return [rgbString(first), rgbString(second)];
};

export const buildLineBuffer = (spec: LineSpec, theme: Theme): LineBuffer => {
  // Enough margin that the Gaussian tail is fully inside the padded canvas,
  // otherwise the crop below would clip the blur and leave a seam.
  const pad = Math.ceil(spec.blur * 3.5) + spec.chromatic + 8;

  const probe = context2d(createCanvas(8, 8));
  probe.font = spec.font;
  probe.letterSpacing = spec.letterSpacing;
  const metrics = spec.segments.map((segment) => probe.measureText(segment.text));
  const ascent = Math.ceil(
    Math.max(...metrics.map((m) => m.actualBoundingBoxAscent)),
  );
  const descent = Math.ceil(
    Math.max(0, ...metrics.map((m) => m.actualBoundingBoxDescent)),
  );

  const tileWidth = spec.tileWidth;
  const bufferHeight = ascent + descent + pad * 2;
  const baseline = pad + ascent;
  const paddedWidth = tileWidth + pad * 2;

  const sharp = createCanvas(paddedWidth, bufferHeight);
  const sctx = context2d(sharp);
  sctx.font = spec.font;
  sctx.letterSpacing = spec.letterSpacing;
  sctx.textBaseline = "alphabetic";

  const [firstPass, secondPass] = fringeImpressions(spec.color, theme.fringe);
  const drawAt = (origin: number) => {
    for (const segment of spec.segments) {
      const x = origin + segment.x;
      if (spec.chromatic > 0) {
        // The first impression lands on an empty buffer, so it goes down
        // plainly whichever way the pair is meant to combine; the second is
        // what actually blends against it.
        sctx.globalCompositeOperation = "source-over";
        sctx.fillStyle = firstPass;
        sctx.fillText(segment.text, x - spec.chromatic, baseline);
        sctx.globalCompositeOperation = theme.fringe.blend;
        sctx.fillStyle = secondPass;
        sctx.fillText(segment.text, x + spec.chromatic, baseline);
        sctx.globalCompositeOperation = "source-over";
      } else {
        sctx.fillStyle = spec.color;
        sctx.fillText(segment.text, x, baseline);
      }
    }
  };
  // Draw the tile past both edges so the cropped window is exactly periodic.
  const lastRepeat = Math.ceil(paddedWidth / tileWidth) + 1;
  for (let k = -2; k <= lastRepeat; k++) drawAt(pad + k * tileWidth);

  const blurred = createCanvas(paddedWidth, bufferHeight);
  const bctx = context2d(blurred);
  bctx.filter = `blur(${spec.blur}px)`;
  bctx.drawImage(sharp, 0, 0);
  bctx.filter = "none";

  const canvas = createCanvas(tileWidth, bufferHeight);
  context2d(canvas).drawImage(
    blurred,
    pad,
    0,
    tileWidth,
    bufferHeight,
    0,
    0,
    tileWidth,
    bufferHeight,
  );

  return {
    spec,
    canvas,
    // spec.y is the middle of the cap height, not the baseline.
    offsetY: baseline - spec.capHeight / 2,
    repeats: Math.ceil(WIDTH / tileWidth) + 1,
  };
};
