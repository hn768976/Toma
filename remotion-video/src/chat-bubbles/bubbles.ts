import { random } from "remotion";
import {
  BUBBLE_COUNT,
  CLUSTER_BIAS,
  CLUSTER_X_MAX,
  CLUSTER_X_MIN_FAR,
  CLUSTER_X_MIN_NEAR,
  DURATION_IN_FRAMES,
  FOCUS_BAND,
  HEIGHT,
  MAX_BLUR,
  MAX_BUBBLE_WIDTH,
  MAX_SPECK_SIZE,
  MAX_WRAP_CYCLES,
  OPACITY_FAR,
  OPACITY_NEAR,
  SPECK_COUNT,
  SWAY_PERIODS,
  TILT_SWAY_DEG,
  Z_MAX,
  Z_MIN,
  Z_SHARP,
} from "./constants";
import { bubbleColorForDepth } from "./color";

// Everything below is derived from `random()` with stable string seeds, so the
// field is identical on every worker and every re-render. Regenerating it per
// frame would make the whole field flicker.
const rangeOf = (seed: string, min: number, max: number) =>
  min + random(seed) * (max - min);

const pick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

// Depth is stratified rather than drawn independently per bubble: with only
// ~38 samples an unstratified draw leaves gaps, so the near extreme never
// shows up and far more of the field lands inside the focus band than the
// band's width implies. One sample per slice keeps the full depth range
// covered and pins the crisp fraction to the band width.
const stratified = (seed: string, index: number, count: number, min: number, max: number) =>
  min + ((index + random(seed)) / count) * (max - min);

export type TextLine = { width: number };

export type Bubble = {
  seed: string;
  z: number;
  /** Sprite geometry, already at final on-screen pixel size. */
  bodyWidth: number;
  bodyHeight: number;
  cornerRadius: number;
  tailSide: "left" | "right";
  tailWidth: number;
  tailHeight: number;
  style: "solid" | "outline";
  strokeWidth: number;
  lines: TextLine[];
  lineThickness: number;
  padX: number;
  color: string;
  blur: number;
  opacity: number;
  /** Whole wrap cycles per loop — quantised from z so the loop closes. */
  cycles: number;
  /** Phase within the current wrap cycle at frame 0. */
  phase: number;
  /** One seeded x per wrap cycle; the bubble is off-screen when it changes. */
  cycleX: number[];
  swayAmplitude: number;
  swayPeriod: number;
  swayPhase: number;
  tiltScaleX: number;
  tiltSkewX: number;
  tiltSkewY: number;
  tiltSwayPeriod: number;
  tiltSwayPhase: number;
  /** Half-extent used to size the off-screen wrap margin. */
  halfExtent: number;
};

export type Speck = {
  seed: string;
  z: number;
  size: number;
  radius: number;
  color: string;
  blur: number;
  opacity: number;
  cycles: number;
  phase: number;
  cycleX: number[];
  swayAmplitude: number;
  swayPeriod: number;
  swayPhase: number;
  halfExtent: number;
};

// Focus falls off from a narrow band at Z_SHARP; both the far and the near
// extremes soften. Near bubbles blur harder because they are the ones flying
// past the lens.
const blurForDepth = (z: number) => {
  const distance = Math.abs(z - Z_SHARP) - FOCUS_BAND;
  if (distance <= 0) return 0;
  const span = Math.max(Z_SHARP - Z_MIN, Z_MAX - Z_SHARP) - FOCUS_BAND;
  return Math.min(MAX_BLUR, (distance / span) * MAX_BLUR);
};

const opacityForDepth = (z: number) =>
  OPACITY_FAR + ((z - Z_MIN) / (Z_MAX - Z_MIN)) * (OPACITY_NEAR - OPACITY_FAR);

// Density is heavily weighted to the right edge and thins toward the centre.
// The left bound tightens as bubbles get nearer, so only small distant ones
// ever stray in from the right third.
const clusterX = (seed: string, z: number) => {
  const nearness = (z - Z_MIN) / (Z_MAX - Z_MIN);
  const xMin = CLUSTER_X_MIN_FAR + nearness * (CLUSTER_X_MIN_NEAR - CLUSTER_X_MIN_FAR);
  const t = Math.pow(random(seed), CLUSTER_BIAS);
  return CLUSTER_X_MAX - t * (CLUSTER_X_MAX - xMin);
};

const makeLines = (seed: string) => {
  const count = 2 + Math.floor(random(`${seed}-lines`) * 3); // 2..4
  const lines: TextLine[] = [];
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    lines.push({
      width: isLast
        ? rangeOf(`${seed}-lw-${i}`, 0.3, 0.55)
        : rangeOf(`${seed}-lw-${i}`, 0.6, 1),
    });
  }
  return lines;
};

export const generateBubbles = (count = BUBBLE_COUNT): Bubble[] => {
  const bubbles: Bubble[] = [];

  for (let i = 0; i < count; i++) {
    const seed = `bubble-${i}`;
    const z = stratified(`${seed}-z`, i, count, Z_MIN, Z_MAX);

    const bodyWidth = z * MAX_BUBBLE_WIDTH;
    // Mostly wide-and-short with a scattering of square and tall shapes.
    const aspectRoll = random(`${seed}-aspect-roll`);
    const aspect =
      aspectRoll < 0.5
        ? rangeOf(`${seed}-aspect`, 1.55, 2.35) // wide and short
        : aspectRoll < 0.85
          ? rangeOf(`${seed}-aspect`, 0.95, 1.35) // near square
          : rangeOf(`${seed}-aspect`, 0.72, 0.9); // tall
    const bodyHeight = bodyWidth / aspect;

    const minSide = Math.min(bodyWidth, bodyHeight);
    const style = random(`${seed}-style`) < 0.6 ? "solid" : "outline";
    const cycles = Math.max(1, Math.round(z * MAX_WRAP_CYCLES));
    const cycleX: number[] = [];
    for (let c = 0; c < cycles; c++) cycleX.push(clusterX(`${seed}-x-${c}`, z));

    const tailHeight = minSide * rangeOf(`${seed}-tailh`, 0.2, 0.28);

    bubbles.push({
      seed,
      z,
      bodyWidth,
      bodyHeight,
      cornerRadius: minSide * rangeOf(`${seed}-radius`, 0.24, 0.32),
      tailSide: random(`${seed}-tailside`) < 0.5 ? "left" : "right",
      tailWidth: minSide * rangeOf(`${seed}-tailw`, 0.17, 0.24),
      tailHeight,
      style,
      strokeWidth: Math.max(2, minSide * rangeOf(`${seed}-stroke`, 0.05, 0.07)),
      lines: makeLines(seed),
      lineThickness: Math.max(2, bodyHeight * rangeOf(`${seed}-lt`, 0.065, 0.085)),
      padX: bodyWidth * rangeOf(`${seed}-padx`, 0.11, 0.15),
      color: bubbleColorForDepth(z),
      blur: blurForDepth(z),
      opacity: opacityForDepth(z),
      cycles,
      phase: random(`${seed}-phase`),
      cycleX,
      swayAmplitude: rangeOf(`${seed}-sway-amp`, 8, 15),
      swayPeriod: pick(`${seed}-sway-period`, SWAY_PERIODS),
      swayPhase: random(`${seed}-sway-phase`) * Math.PI * 2,
      // A fixed pseudo-3D tilt: squash one axis and skew slightly so the
      // bubble reads as facing a little away from camera. Kept under ~15deg
      // of apparent rotation — these float, they do not tumble.
      tiltScaleX: rangeOf(`${seed}-tilt-sx`, 0.95, 1),
      tiltSkewX: rangeOf(`${seed}-tilt-kx`, -0.05, 0.05),
      tiltSkewY: rangeOf(`${seed}-tilt-ky`, -0.07, 0.07),
      tiltSwayPeriod: pick(`${seed}-tilt-period`, SWAY_PERIODS),
      tiltSwayPhase: random(`${seed}-tilt-phase`) * Math.PI * 2,
      halfExtent: Math.hypot(bodyWidth, bodyHeight + tailHeight) / 2,
    });
  }

  return bubbles;
};

export const generateSpecks = (count = SPECK_COUNT): Speck[] => {
  const specks: Speck[] = [];

  for (let i = 0; i < count; i++) {
    const seed = `speck-${i}`;
    const z = stratified(`${seed}-z`, i, count, Z_MIN, 0.5);
    const size = z * MAX_SPECK_SIZE + 6;
    const cycles = Math.max(1, Math.round(z * MAX_WRAP_CYCLES));
    const cycleX: number[] = [];
    for (let c = 0; c < cycles; c++) cycleX.push(clusterX(`${seed}-x-${c}`, z));

    specks.push({
      seed,
      z,
      size,
      radius: size * 0.25,
      color: bubbleColorForDepth(z),
      blur: blurForDepth(z) * 0.45,
      opacity: opacityForDepth(z) * rangeOf(`${seed}-op`, 0.65, 0.95),
      cycles,
      phase: random(`${seed}-phase`),
      cycleX,
      swayAmplitude: rangeOf(`${seed}-sway-amp`, 5, 12),
      swayPeriod: pick(`${seed}-sway-period`, SWAY_PERIODS),
      swayPhase: random(`${seed}-sway-phase`) * Math.PI * 2,
      halfExtent: size,
    });
  }

  return specks;
};

/**
 * Position of a wrapping element at `frame`.
 *
 * `cycles` is a whole number, so at frame 0 and frame DURATION_IN_FRAMES the
 * raw progress differs by exactly `cycles` — the fractional part, and the
 * cycle index modulo `cycles`, both return to their starting values. That is
 * what makes the loop seamless. The x-jump between cycles happens while the
 * element is off-screen above the top edge.
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
