import { random } from "remotion";
import { CORE_FLASH, CURVE, DISCHARGE, RESEED, TIMING } from "./config";
import { clamp, lerp, randInt } from "./random";

/**
 * The intensity curve and everything derived from it.
 *
 * `intensity` is the single 0..1 value the brief calls for. Filament count,
 * brightness, cloud density, core flash and bloom are all shaped from it, so
 * the piece moves as one thing.
 */

const CORE_PEAK = CORE_FLASH.peakFrame;
const CORE_RISE = CORE_FLASH.riseExponent;
const CORE_DECAY = CORE_FLASH.decayFrames;

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
const easeOutQuad = (t: number): number => 1 - (1 - t) ** 2;

/**
 * Irregular flicker. A per-frame term mixed with a slower two-frame term, so it
 * reads as an unstable arc rather than uniform buzz, plus occasional deeper dips.
 */
const flicker = (frame: number, floor: number): number => {
  const fast = random(`flicker-fast-${frame}`);
  const slow = random(`flicker-slow-${Math.floor(frame / 2)}`);
  const mixed = 0.55 * fast + 0.45 * slow;
  const dip = random(`flicker-dip-${frame}`) < CURVE.peakDipChance ? CURVE.peakDipDepth : 1;
  return lerp(floor, 1, mixed) * dip;
};

export const intensityAt = (frame: number): number => {
  if (frame <= CURVE.blackHoldEnd) {
    return 0;
  }

  if (frame < CURVE.ignitionEnd) {
    // IGNITION. Six frames, hard ease-out — over half the rise lands in the
    // first frame, so it reads as a strike rather than a fade-in.
    const t = (frame - CURVE.blackHoldEnd) / (CURVE.ignitionEnd - CURVE.blackHoldEnd);
    return 1 - (1 - t) ** CURVE.ignitionExponent;
  }

  if (frame < CURVE.peakEnd) {
    // PEAK. Holds near 1.0 but wanders — the discharge is unstable.
    return flicker(frame, CURVE.peakFlickerFloor);
  }

  if (frame < CURVE.decayEnd) {
    // DECAY. A long ease-out down to the afterglow level.
    const t = (frame - CURVE.peakEnd) / (CURVE.decayEnd - CURVE.peakEnd);
    return lerp(1, CURVE.decayFloor, easeOutCubic(t)) * flicker(frame, CURVE.decayFlickerFloor);
  }

  if (frame < CURVE.afterglowEnd) {
    // AFTERGLOW. Cloud only, dimming slowly.
    const t = (frame - CURVE.decayEnd) / (CURVE.afterglowEnd - CURVE.decayEnd);
    return lerp(CURVE.decayFloor, CURVE.afterglowFloor, easeOutQuad(t));
  }

  if (frame < CURVE.fadeEnd) {
    const t = (frame - CURVE.afterglowEnd) / (CURVE.fadeEnd - CURVE.afterglowEnd);
    return CURVE.afterglowFloor * (1 - t);
  }

  return 0;
};

/**
 * Which re-seeded web a frame belongs to. Built once: each hold is 2-3 frames
 * at peak, longer as the discharge settles, so the web writhes hard early and
 * gradually stops moving.
 */
const RESEED_SCHEDULE: number[] = (() => {
  const schedule = new Array<number>(TIMING.durationInFrames).fill(0);
  let frame = CURVE.blackHoldEnd;
  let index = 0;

  while (frame < TIMING.durationInFrames) {
    const hold =
      frame < CURVE.peakEnd
        ? randInt(`hold-${index}`, RESEED.peakHoldMin, RESEED.peakHoldMax + 1)
        : frame < CURVE.decayEnd
          ? randInt(`hold-${index}`, RESEED.decayHoldMin, RESEED.decayHoldMax + 1)
          : randInt(`hold-${index}`, RESEED.afterglowHoldMin, RESEED.afterglowHoldMax + 1);

    for (let f = frame; f < Math.min(frame + hold, TIMING.durationInFrames); f++) {
      schedule[f] = index;
    }

    frame += hold;
    index += 1;
  }

  return schedule;
})();

export const seedIndexAt = (frame: number): number =>
  RESEED_SCHEDULE[clamp(frame, 0, RESEED_SCHEDULE.length - 1)] ?? 0;

/**
 * During the afterglow a few isolated filaments flicker back for 2-3 frames at
 * a time — the discharge not quite finished.
 */
const afterglowBurst = (frame: number): number => {
  const burst = Math.floor((frame - CURVE.decayEnd) / 3);
  if (random(`afterglow-burst-${burst}`) >= 0.26) {
    return 0;
  }

  return randInt(`afterglow-count-${burst}`, 2, 6);
};

export type PlasmaState = {
  /** The master 0..1 curve. */
  readonly intensity: number;
  /** Brightness multiplier for the filament web. */
  readonly filamentEnergy: number;
  /** How many primary filaments of the current web to draw. */
  readonly filamentCount: number;
  /** The cloud persists longer than the filaments. */
  readonly cloudEnergy: number;
  /** The blown-out white centre — spikes at ignition, gone well before the end. */
  readonly coreEnergy: number;
  /** Bloom scales with intensity, so ignition blows out and afterglow does not. */
  readonly bloomEnergy: number;
  /** Which memoised web to draw. */
  readonly seedIndex: number;
};

export const stateAt = (frame: number): PlasmaState => {
  const intensity = intensityAt(frame);
  const inAfterglow = frame >= CURVE.decayEnd;

  // Flickers stop at the end of the afterglow: the last ten frames go to black,
  // and a filament firing there would undo the ending.
  const burst = inAfterglow && frame < CURVE.afterglowEnd ? afterglowBurst(frame) : 0;

  // Each flicker is fainter than the last, so the discharge trails off rather
  // than stopping dead.
  const afterglowProgress = clamp(
    (frame - CURVE.decayEnd) / (CURVE.afterglowEnd - CURVE.decayEnd),
    0,
    1,
  );

  // Filaments fall away faster than the master curve, so the frame becomes glow
  // without structure before it becomes nothing.
  const filamentEnergy = inAfterglow
    ? burst > 0
      ? lerp(0.52, 0.1, afterglowProgress)
      : 0
    : intensity ** 1.5;

  const filamentCount = inAfterglow
    ? burst
    : intensity <= 0
      ? 0
      : Math.max(4, Math.round(DISCHARGE.primaryCount * intensity ** 0.75));

  // Rise: peaks a few frames after ignition. Fall: exponential, faster than the
  // master curve, so the white centre burns out while the web is still going.
  const coreEnergy =
    intensity <= 0
      ? 0
      : frame < CORE_PEAK
        ? 1 - (1 - (frame - CURVE.blackHoldEnd) / (CORE_PEAK - CURVE.blackHoldEnd)) ** CORE_RISE
        : Math.exp(-(frame - CORE_PEAK) / CORE_DECAY) * clamp(intensity * 1.15, 0, 1);

  return {
    intensity,
    filamentEnergy,
    filamentCount,
    cloudEnergy: intensity ** 0.55,
    coreEnergy,
    bloomEnergy: intensity ** 0.9,
    seedIndex: seedIndexAt(frame),
  };
};
