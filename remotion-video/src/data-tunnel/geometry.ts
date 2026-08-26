// Path and chip geometry. Everything in here is generated ONCE from seeded
// random() calls (never Math.random) and is a pure function of (chip, frame)
// thereafter, so Remotion can render frames out of order across workers
// without any popping.

import { random } from "remotion";
import {
  BLUR_CEILING,
  BLUR_EXPONENT,
  BLUR_LEVELS,
  CAMERA_DIRECTION,
  CHIP_ALPHA_MAX,
  CHIP_ALPHA_MIN,
  CHIP_ASPECTS,
  CHIP_COUNT,
  CHIP_LATERAL_SPREAD,
  CHIP_SPACING_JITTER,
  CHIP_WIDTH_RATIO,
  CHIP_WIDTH_VARIANCE,
  CURVE_AMOUNT,
  CURVE_REFERENCE_RADIUS,
  DURATION_IN_FRAMES,
  FADE_IN_U,
  FADE_OUT_U,
  FAR_BLUR_SCALE,
  FAR_DIM,
  FLASHES_PER_SECOND,
  FLASH_MAX_FRAMES,
  FLASH_MIN_FRAMES,
  FLOW_SPEED,
  FOCAL,
  FPS,
  HEIGHT,
  HOLLOW_FRACTION,
  PATH_ANGLE_END,
  PATH_ANGLE_JITTER,
  PATH_ANGLE_START,
  PATH_COUNT,
  PATH_CURVE_BIAS,
  PATH_CURVE_SPREAD,
  PULSE_PERIODS,
  SHARP_CENTER_U,
  SHARP_HALF_WIDTH_U,
  SPARKLE_COUNT,
  SPARKLE_MAX_SIZE,
  SPARKLE_MIN_SIZE,
  SPARKLE_PERIODS,
  TICKED_HOLLOW_FRACTION,
  WIDTH,
  Z_FAR,
  Z_NEAR,
} from "./config";
import type { ChipPaletteEntry } from "./theme";

export const Z_RATIO = Z_FAR / Z_NEAR;

// Advance in u per frame. FLOW_SPEED whole traversals across the loop keeps
// frame 450 identical to frame 0.
export const FLOW_PER_FRAME = FLOW_SPEED / DURATION_IN_FRAMES;

export const wrap01 = (value: number) => value - Math.floor(value);

export const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

export const smoothstep = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const pick = <T>(items: readonly T[], roll: number) =>
  items[Math.min(items.length - 1, Math.floor(roll * items.length))];

// --- depth ------------------------------------------------------------------

// u = 0 sits at the camera, u = 1 at the vanishing point.
export const depthAt = (u: number) => Z_NEAR * Math.pow(Z_RATIO, u);

export const radiusAt = (u: number) => FOCAL / depthAt(u);

export const alphaAt = (u: number) => {
  const fadeIn = smoothstep((1 - u) / FADE_IN_U);
  const fadeOut = smoothstep(u / FADE_OUT_U);
  return fadeIn * fadeOut * mix(1, FAR_DIM, u);
};

// Sharp in a narrow mid band, climbing to the ceiling toward both the camera
// and the vanishing point.
export const blurAt = (u: number) => {
  if (u > SHARP_CENTER_U) {
    const span = 1 - SHARP_CENTER_U - SHARP_HALF_WIDTH_U;
    const t = clamp01((u - SHARP_CENTER_U - SHARP_HALF_WIDTH_U) / span);
    return BLUR_CEILING * FAR_BLUR_SCALE * Math.pow(t, BLUR_EXPONENT);
  }
  const span = SHARP_CENTER_U - SHARP_HALF_WIDTH_U;
  const t = clamp01((SHARP_CENTER_U - SHARP_HALF_WIDTH_U - u) / span);
  return BLUR_CEILING * Math.pow(t, BLUR_EXPONENT);
};

const quantiseBlur = (blur: number) => {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < BLUR_LEVELS.length; i++) {
    const distance = Math.abs(BLUR_LEVELS[i] - blur);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
};

// --- blur bands -------------------------------------------------------------
//
// blurAt() is monotonic on each side of the sharp band, so quantising it
// carves the u range into contiguous runs. Walking u from 1 down to 0 yields
// those runs already ordered back-to-front, which is the order chips get
// drawn in and the order that lets a whole run share one canvas filter.

export type BlurBand = { uHigh: number; uLow: number; blur: number };

const buildBlurBands = (): BlurBand[] => {
  const steps = 2000;
  const bands: BlurBand[] = [];
  let currentLevel = quantiseBlur(blurAt(1));
  let bandStart = 1;
  for (let i = 1; i <= steps; i++) {
    const u = 1 - i / steps;
    const level = quantiseBlur(blurAt(u));
    if (level !== currentLevel) {
      bands.push({ uHigh: bandStart, uLow: u, blur: BLUR_LEVELS[currentLevel] });
      currentLevel = level;
      bandStart = u;
    }
  }
  bands.push({ uHigh: bandStart, uLow: 0, blur: BLUR_LEVELS[currentLevel] });
  return bands;
};

export const BLUR_BANDS = buildBlurBands();

export const bandIndexFor = (u: number) => {
  for (let i = 0; i < BLUR_BANDS.length; i++) {
    if (u >= BLUR_BANDS[i].uLow) return i;
  }
  return BLUR_BANDS.length - 1;
};

// --- paths ------------------------------------------------------------------

export type TunnelPath = {
  angle: number;
  cos: number;
  sin: number;
  // Signed quadratic bend factor. perpendicular offset = curve * r^2 / REF.
  curve: number;
};

export const buildPaths = (): TunnelPath[] => {
  const paths: TunnelPath[] = [];
  const slot = (PATH_ANGLE_END - PATH_ANGLE_START) / PATH_COUNT;
  for (let i = 0; i < PATH_COUNT; i++) {
    const jitter = (random("path-angle-" + i) - 0.5) * 2 * PATH_ANGLE_JITTER;
    const angle = PATH_ANGLE_START + slot * (i + 0.5 + jitter);
    const spread = (random("path-curve-" + i) - 0.5) * 2 * PATH_CURVE_SPREAD;
    const curve = CURVE_AMOUNT * (PATH_CURVE_BIAS + spread);
    paths.push({ angle, cos: Math.cos(angle), sin: Math.sin(angle), curve });
  }
  return paths;
};

export type PathPoint = { x: number; y: number; angle: number };

// A point on a curved path at screen radius r, plus the path's local
// direction there (which is what each chip is rotated to).
export const pointOnPath = (path: TunnelPath, r: number, lateral: number): PathPoint => {
  const bend = (path.curve * r * r) / CURVE_REFERENCE_RADIUS;
  const offset = bend + lateral;
  const x = r * path.cos - offset * path.sin;
  const y = r * path.sin + offset * path.cos;
  // d/dr of the above, ignoring the (constant in r) lateral term.
  const slope = (2 * path.curve * r) / CURVE_REFERENCE_RADIUS;
  const dx = path.cos - slope * path.sin;
  const dy = path.sin + slope * path.cos;
  return { x, y, angle: Math.atan2(dy, dx) };
};

// --- chips ------------------------------------------------------------------

export type ChipKind = "filled" | "hollow" | "hollow-ticked";

export type Chip = {
  pathIndex: number;
  // Depth phase at frame 0.
  u0: number;
  kind: ChipKind;
  // Index into the theme palette; unused for hollow chips.
  colorIndex: number;
  aspectIndex: number;
  widthScale: number;
  lateral: number;
  baseAlpha: number;
  pulsePeriod: number;
  pulsePhase: number;
  flashes: boolean;
  flashStart: number;
  flashFrames: number;
};

const weightedColorIndex = (palette: ChipPaletteEntry[], roll: number) => {
  let total = 0;
  for (let i = 0; i < palette.length; i++) total += palette[i].weight;
  let cursor = roll * total;
  for (let i = 0; i < palette.length; i++) {
    cursor -= palette[i].weight;
    if (cursor <= 0) return i;
  }
  return palette.length - 1;
};

export const buildChips = (palette: ChipPaletteEntry[]): Chip[] => {
  const chips: Chip[] = [];
  const flashProbability = (FLASHES_PER_SECOND * (DURATION_IN_FRAMES / FPS)) / CHIP_COUNT;

  for (let i = 0; i < CHIP_COUNT; i++) {
    const pathIndex = i % PATH_COUNT;
    const slotIndex = Math.floor(i / PATH_COUNT);
    const slots = Math.ceil(CHIP_COUNT / PATH_COUNT);
    const seed = "chip-" + i;

    // Evenly spaced in u (so evenly spaced in log-radius on screen), nudged
    // by a seeded jitter so each path's run of chips has varying spacing.
    const jitter = (random(seed + "-slot") - 0.5) * 2 * CHIP_SPACING_JITTER;
    const u0 = wrap01((slotIndex + 0.5 + jitter) / slots);

    const hollowRoll = random(seed + "-kind");
    const kind: ChipKind =
      hollowRoll >= HOLLOW_FRACTION
        ? "filled"
        : random(seed + "-ticks") < TICKED_HOLLOW_FRACTION
          ? "hollow-ticked"
          : "hollow";

    chips.push({
      pathIndex,
      u0,
      kind,
      colorIndex: weightedColorIndex(palette, random(seed + "-color")),
      aspectIndex: Math.floor(random(seed + "-aspect") * CHIP_ASPECTS.length),
      widthScale: 1 + (random(seed + "-width") - 0.5) * 2 * CHIP_WIDTH_VARIANCE,
      lateral: (random(seed + "-lateral") - 0.5) * 2 * CHIP_LATERAL_SPREAD,
      baseAlpha: mix(CHIP_ALPHA_MIN, CHIP_ALPHA_MAX, random(seed + "-alpha")),
      pulsePeriod: pick(PULSE_PERIODS, random(seed + "-pulse-period")),
      pulsePhase: random(seed + "-pulse-phase") * Math.PI * 2,
      flashes: random(seed + "-flash") < flashProbability,
      flashStart: Math.floor(random(seed + "-flash-start") * DURATION_IN_FRAMES),
      flashFrames: Math.round(
        mix(FLASH_MIN_FRAMES, FLASH_MAX_FRAMES, random(seed + "-flash-len")),
      ),
    });
  }
  return chips;
};

// Chip width on screen. Constant fraction of screen radius, which is the
// same as being inversely proportional to depth.
export const chipWidthAt = (chip: Chip, r: number) =>
  CHIP_WIDTH_RATIO * chip.widthScale * r;

// Lateral offset is a world-space quantity, so it shrinks with depth exactly
// as the chip does.
export const lateralAt = (chip: Chip, r: number) => chip.lateral * r;

export const flashStrengthAt = (chip: Chip, loopFrame: number) => {
  if (!chip.flashes) return 0;
  const since = wrapFrames(loopFrame - chip.flashStart);
  if (since >= chip.flashFrames) return 0;
  // Full on the first frame, easing off across the tail.
  return 1 - since / chip.flashFrames;
};

export const wrapFrames = (frame: number) =>
  ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;

// A chip's depth phase for this frame. The wrap is the recycle: a chip that
// reaches the vanishing point reappears at the near end of its path, at the
// seeded position it started from. With FLOW_SPEED whole traversals per loop
// that recycle lands on the same frame every loop, which is exactly what
// makes frame 450 identical to frame 0 — re-seeding on recycle would put a
// one-frame discontinuity in the loop instead.
export const chipDepthU = (chip: Chip, loopFrame: number) =>
  wrap01(chip.u0 + CAMERA_DIRECTION * FLOW_PER_FRAME * loopFrame);

// --- sparkles ---------------------------------------------------------------

export type Sparkle = {
  x: number;
  y: number;
  size: number;
  period: number;
  phase: number;
  rotation: number;
};

export const buildSparkles = (): Sparkle[] => {
  const sparkles: Sparkle[] = [];
  for (let i = 0; i < SPARKLE_COUNT; i++) {
    const seed = "sparkle-" + i;
    sparkles.push({
      // Biased toward the right and lower two-thirds, where the corridor is
      // open, rather than into the dense far corner.
      x: mix(WIDTH * 0.18, WIDTH * 0.98, random(seed + "-x")),
      y: mix(HEIGHT * 0.08, HEIGHT * 0.96, random(seed + "-y")),
      size: mix(SPARKLE_MIN_SIZE, SPARKLE_MAX_SIZE, random(seed + "-size")),
      period: pick(SPARKLE_PERIODS, random(seed + "-period")),
      phase: random(seed + "-phase") * Math.PI * 2,
      rotation: random(seed + "-rot") * Math.PI * 0.5,
    });
  }
  return sparkles;
};
