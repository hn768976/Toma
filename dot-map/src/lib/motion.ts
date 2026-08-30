import {random} from 'remotion';
import type {DotField} from './dots';
import type {HotspotConfig, VariantConfig} from '../variants';

const TAU = Math.PI * 2;

/**
 * A closed Lissajous path. Both terms complete a whole number of turns over
 * the loop, so the offset at frame `duration` is exactly the offset at 0.
 */
export const drift = (frame: number, amplitude: number, duration: number) => {
  const t = (frame / duration) * TAU;
  return {
    dx: amplitude * Math.sin(t),
    dy: amplitude * 0.6 * Math.sin(2 * t + 1.05),
  };
};

/**
 * A dot's ambient multiplier, in [1 - amplitude, 1 + amplitude]. Every period
 * divides the loop, so this closes too.
 */
export const shimmer = (
  field: DotField,
  i: number,
  frame: number,
  amplitude: number,
): number =>
  1 + amplitude * Math.sin(TAU * (frame / field.period[i] + field.phase[i]));

export type Flash = {dot: number; strength: number};

/**
 * A fixed, seeded schedule of brief flashes, bucketed by the frame they are
 * visible on. Flashes that run past the end wrap to the start, so the loop
 * point has no gap in them.
 */
export const buildFlashSchedule = (
  field: DotField,
  config: VariantConfig,
  duration: number,
  fps: number,
): Flash[][] => {
  const schedule: Flash[][] = Array.from({length: duration}, () => []);
  const total = Math.round(
    (config.ambient.flashesPerSecond * duration) / fps,
  );
  for (let i = 0; i < total; i++) {
    const start = Math.floor(random(`flash-start-${i}`) * duration);
    const dot = Math.floor(random(`flash-dot-${i}`) * field.n);
    // 3 or 4 frames — long enough to register, short enough to stay a flash.
    const length =
      config.ambient.flashFrames - (random(`flash-len-${i}`) < 0.5 ? 1 : 0);
    for (let k = 0; k < length; k++) {
      const strength =
        config.ambient.flashStrength * (1 - (k / length) * 0.75);
      schedule[(start + k) % duration].push({dot, strength});
    }
  }
  return schedule;
};

/* ── sweep ───────────────────────────────────────────────────────────────── */

/** Where the scan line sits, in frame space. */
export const sweepLineY = (
  frame: number,
  height: number,
  passes: number,
  duration: number,
): number => {
  const passLength = duration / passes;
  return ((frame % passLength) / passLength) * height;
};

/**
 * A dot's excitation from the sweep, from how long ago the line crossed its
 * row. Because it is measured modulo the pass length it is already periodic:
 * at frame 0 the trail from the previous pass is still fading near the bottom,
 * exactly as it is at frame `duration`.
 */
export const sweepExcitation = (
  dotY: number,
  frame: number,
  height: number,
  config: VariantConfig,
  duration: number,
): number => {
  const passLength = duration / config.sweep.passes;
  const crossedAt = (dotY / height) * passLength;
  const since = (((frame - crossedAt) % passLength) + passLength) % passLength;
  if (since >= config.sweep.decayFrames) {
    return 0;
  }
  // Sharp on the crossing, then a decaying trail above the line.
  return Math.pow(1 - since / config.sweep.decayFrames, 1.6);
};

/** Climbs 00 → 99 across each pass, then resets. */
export const sweepPercent = (
  frame: number,
  passes: number,
  duration: number,
): number => {
  const passLength = duration / passes;
  return Math.min(99, Math.floor(((frame % passLength) / passLength) * 100));
};

/* ── hotspot ─────────────────────────────────────────────────────────────── */

/** Frames between one region activating and the next. */
export const regionStagger = (config: HotspotConfig, duration: number): number =>
  duration / config.cycles / config.regions.length;

/**
 * Local time within a region's activation, in frames. Periodic in the cycle
 * length, and the cycle length divides the loop.
 */
export const regionLocalTime = (
  regionIndex: number,
  frame: number,
  config: HotspotConfig,
  duration: number,
): number => {
  const cycle = duration / config.cycles;
  const start = regionIndex * regionStagger(config, duration);
  return (((frame - start) % cycle) + cycle) % cycle;
};

/**
 * The activation envelope for a point at `radiusFraction` of the way from the
 * region's centre to its rim.
 *
 * The wavefront reaches each dot in turn, so the region lights from the middle
 * outward, but the hold and the decay are region-wide: once the front has
 * finished crossing, the whole region fades as one. That keeps a region's span
 * a fixed `wave + hold + decay`, which is what lets the staggered activations
 * overlap by a predictable amount.
 */
export const regionEnvelope = (
  localTime: number,
  radiusFraction: number,
  config: HotspotConfig,
): number => {
  const arrival = radiusFraction * config.waveFrames;
  if (localTime < arrival) {
    return 0;
  }
  if (localTime < arrival + config.attackFrames) {
    return (localTime - arrival) / config.attackFrames;
  }
  const holdEnd = config.waveFrames + config.holdFrames;
  if (localTime < holdEnd) {
    return 1;
  }
  const decayed = localTime - holdEnd;
  if (decayed < config.decayFrames) {
    return 1 - decayed / config.decayFrames;
  }
  return 0;
};

/** How lit a region is overall — what the connecting arcs key off. */
export const regionActivity = (
  regionIndex: number,
  frame: number,
  config: HotspotConfig,
  duration: number,
): number =>
  regionEnvelope(
    regionLocalTime(regionIndex, frame, config, duration),
    0,
    config,
  );
