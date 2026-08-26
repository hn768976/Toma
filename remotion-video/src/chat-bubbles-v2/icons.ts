import { random } from "remotion";
import {
  BADGE_COUNT,
  BUBBLE_COUNT,
  DURATION_IN_FRAMES,
  FAST_TIER_CYCLES,
  FAR_BLUR_SCALE,
  FAST_TIER_Z,
  FOCUS_BAND,
  HEIGHT,
  ICON_COUNT,
  ICON_WHITE,
  ICON_WHITE_COOL,
  MARGIN_X,
  MAX_BADGE_SIZE,
  MAX_BLUR,
  MAX_BUBBLE_WIDTH,
  OPACITY_FAR,
  OPACITY_NEAR,
  SWAY_MAX,
  SWAY_MIN,
  SWAY_PERIODS,
  TILT_SWAY_DEG,
  WIDTH,
  Z_MAX,
  Z_MIN,
  Z_SHARP,
} from "./constants";

// As in the first plate: everything is derived from `random()` with stable
// string seeds, so the field is identical on every worker and every re-render.
const rangeOf = (seed: string, min: number, max: number) =>
  min + random(seed) * (max - min);

const pick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

const stratified = (seed: string, index: number, count: number, min: number, max: number) =>
  min + ((index + random(seed)) / count) * (max - min);

export type TextBar = { width: number };

export type BubbleArt = {
  bodyWidth: number;
  bodyHeight: number;
  cornerRadius: number;
  tailWidth: number;
  tailHeight: number;
  tailOut: number;
  bars: TextBar[];
  barThickness: number;
  barGap: number;
  padX: number;
  padTop: number;
};

export type BadgeArt = { diameter: number };

type Motion = {
  seed: string;
  z: number;
  white: string;
  blur: number;
  opacity: number;
  /** Whole wrap cycles per loop — an integer, so the loop closes. */
  cycles: number;
  phase: number;
  cycleX: number[];
  swayAmplitude: number;
  swayPeriod: number;
  swayPhase: number;
  tiltScaleX: number;
  tiltSkewX: number;
  tiltSkewY: number;
  tiltSwayPeriod: number;
  tiltSwayPhase: number;
  halfExtent: number;
};

export type Icon = Motion &
  ({ kind: "bubble"; art: BubbleArt } | { kind: "badge"; art: BadgeArt });

const blurForDepth = (z: number) => {
  const distance = Math.abs(z - Z_SHARP) - FOCUS_BAND;
  if (distance <= 0) return 0;
  const span = Math.max(Z_SHARP - Z_MIN, Z_MAX - Z_SHARP) - FOCUS_BAND;
  const scale = z < Z_SHARP ? FAR_BLUR_SCALE : 1;
  return Math.min(MAX_BLUR, (distance / span) * MAX_BLUR * scale);
};

const opacityForDepth = (z: number) =>
  OPACITY_FAR + ((z - Z_MIN) / (Z_MAX - Z_MIN)) * (OPACITY_NEAR - OPACITY_FAR);

/**
 * Unlike the first plate, this field covers the whole frame. Horizontal slots
 * are stratified across the full width so ~36 icons actually spread out instead
 * of clumping, which an independent draw per icon does at this sample count.
 */
const slotX = (seed: string, index: number) => {
  const inset = WIDTH * MARGIN_X;
  return stratified(seed, index, ICON_COUNT, inset, WIDTH - inset);
};

/**
 * Depth, horizontal slot and phase are all stratified against the icon index,
 * which means they have to be walked in *different* orders or they come out
 * correlated — striding all three by 1 put every distant icon down the left
 * edge and every near one down the right.
 *
 * Both strides must stay coprime with ICON_COUNT, or the stride stops being a
 * full permutation and collapses onto a fraction of the slots. At 42 icons that
 * rules out 7 (42 = 2 x 3 x 7); 11 and 13 are both safe.
 */
const X_STRIDE = 13;
const PHASE_STRIDE = 11;

/**
 * Bars sit in a block hanging from the top of the bubble, not centred in it:
 * a two-bar bubble in the reference leaves the bottom half of its body empty.
 * The closing bar is markedly short.
 */
const makeBars = (seed: string) => {
  const count = 2 + Math.floor(random(`${seed}-bars`) * 3); // 2..4
  const bars: TextBar[] = [];
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    bars.push({
      width: isLast
        ? rangeOf(`${seed}-bw-${i}`, 0.35, 0.8)
        : rangeOf(`${seed}-bw-${i}`, 0.88, 1),
    });
  }
  return bars;
};

const makeBubbleArt = (seed: string, z: number): BubbleArt => {
  const bodyWidth = z * MAX_BUBBLE_WIDTH;
  const bodyHeight = bodyWidth / rangeOf(`${seed}-aspect`, 1.35, 1.9);
  const minSide = Math.min(bodyWidth, bodyHeight);

  return {
    bodyWidth,
    bodyHeight,
    // All but square. The reference bubbles have no meaningful corner radius —
    // just enough here to keep the corners from aliasing.
    cornerRadius: minSide * 0.035,
    tailWidth: bodyWidth * rangeOf(`${seed}-tailw`, 0.13, 0.19),
    tailHeight: bodyHeight * rangeOf(`${seed}-tailh`, 0.26, 0.34),
    tailOut: bodyWidth * 0.03,
    bars: makeBars(seed),
    barThickness: Math.max(2, bodyHeight * 0.11),
    barGap: Math.max(1, bodyHeight * 0.06),
    padX: bodyWidth * 0.09,
    padTop: bodyHeight * 0.2,
  };
};

/**
 * Which icon is a bubble and which is a badge is decided by shuffling a fixed
 * tally rather than rolling per icon, so the 20/16 split is exact. The shuffle
 * also decorrelates kind from the stratified horizontal slot — rolling per
 * index would leave all the badges stacked down one side of the frame.
 */
const kindOrder = (): ("bubble" | "badge")[] => {
  const kinds: ("bubble" | "badge")[] = [
    ...Array<"bubble">(BUBBLE_COUNT).fill("bubble"),
    ...Array<"badge">(BADGE_COUNT).fill("badge"),
  ];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random(`kind-shuffle-${i}`) * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  return kinds;
};

export const generateIcons = (): Icon[] => {
  const kinds = kindOrder();
  const icons: Icon[] = [];

  for (let i = 0; i < ICON_COUNT; i++) {
    const seed = `icon-${i}`;
    const kind = kinds[i];

    // Depth is stratified for the same reason the first plate does it: with
    // ~36 samples an independent draw leaves the near extreme unrepresented.
    const z = stratified(`${seed}-z`, i, ICON_COUNT, Z_MIN, Z_MAX);
    const cycles = z >= FAST_TIER_Z ? FAST_TIER_CYCLES : 1;

    const phaseIndex = (i * PHASE_STRIDE) % ICON_COUNT;
    const phase = stratified(`${seed}-phase`, phaseIndex, ICON_COUNT, 0, 1);

    const art =
      kind === "bubble"
        ? makeBubbleArt(seed, z)
        : { diameter: Math.max(8, z * MAX_BADGE_SIZE) };

    const halfExtent =
      kind === "bubble"
        ? Math.hypot(
            (art as BubbleArt).bodyWidth,
            (art as BubbleArt).bodyHeight + (art as BubbleArt).tailHeight,
          ) / 2
        : (art as BadgeArt).diameter * 0.6;

    // The first cycle keeps the stratified slot; a second cycle re-seeds freely
    // within the margins, and only ever swaps while the icon is off-screen.
    const inset = WIDTH * MARGIN_X;
    const cycleX: number[] = [];
    for (let c = 0; c < cycles; c++) {
      cycleX.push(
        c === 0
          ? slotX(`${seed}-slot`, (i * X_STRIDE) % ICON_COUNT)
          : rangeOf(`${seed}-x-${c}`, inset, WIDTH - inset),
      );
    }

    const motion: Motion = {
      seed,
      z,
      white: random(`${seed}-white`) < 0.5 ? ICON_WHITE : ICON_WHITE_COOL,
      blur: blurForDepth(z),
      opacity: opacityForDepth(z),
      cycles,
      phase,
      cycleX,
      swayAmplitude: rangeOf(`${seed}-sway-amp`, SWAY_MIN, SWAY_MAX),
      swayPeriod: pick(`${seed}-sway-period`, SWAY_PERIODS),
      swayPhase: random(`${seed}-sway-phase`) * Math.PI * 2,
      // Same fixed pseudo-3D tilt as the first plate: squash one axis and skew
      // a little, so some icons read as turned slightly away from camera.
      tiltScaleX: rangeOf(`${seed}-tilt-sx`, 0.94, 1),
      tiltSkewX: rangeOf(`${seed}-tilt-kx`, -0.06, 0.06),
      tiltSkewY: rangeOf(`${seed}-tilt-ky`, -0.07, 0.07),
      tiltSwayPeriod: pick(`${seed}-tilt-period`, SWAY_PERIODS),
      tiltSwayPhase: random(`${seed}-tilt-phase`) * Math.PI * 2,
      halfExtent,
    };

    icons.push(
      kind === "bubble"
        ? { ...motion, kind: "bubble", art: art as BubbleArt }
        : { ...motion, kind: "badge", art: art as BadgeArt },
    );
  }

  return icons;
};

/**
 * Position of a wrapping icon at `frame`.
 *
 * `cycles` is a whole number, so at frame 0 and frame DURATION_IN_FRAMES the
 * raw progress differs by exactly `cycles` — the fractional part, and the cycle
 * index modulo `cycles`, both return to their starting values. That is what
 * makes the loop seamless.
 */
export const wrapPosition = (
  frame: number,
  cycles: number,
  phase: number,
  cycleX: number[],
  halfExtent: number,
) => {
  const span = HEIGHT + halfExtent * 2;
  const raw = phase + (frame * cycles) / DURATION_IN_FRAMES;
  const cycleIndex = ((Math.floor(raw) % cycles) + cycles) % cycles;
  const u = raw - Math.floor(raw);
  return {
    u,
    span,
    x: cycleX[cycleIndex],
    y: HEIGHT + halfExtent - u * span,
  };
};

export const swayOffset = (
  frame: number,
  amplitude: number,
  period: number,
  phase: number,
) => amplitude * Math.sin((frame / period) * Math.PI * 2 + phase);

export const tiltSway = (frame: number, period: number, phase: number) =>
  ((TILT_SWAY_DEG * Math.PI) / 180) *
  Math.sin((frame / period) * Math.PI * 2 + phase);
