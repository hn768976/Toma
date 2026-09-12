/**
 * The story the board tells, in one place.
 *
 * A speed test runs on 4G, the network toggles to 5G half way through, and
 * every dial re-measures: download and upload jump to near-max while latency
 * collapses to almost nothing. Needles are driven by springs so they overshoot
 * and settle the way a real moving-coil gauge does, with a small continuous
 * flutter on top so nothing ever looks frozen.
 *
 * The windows and targets below are matched to the reference clips frame by
 * frame, which is why they are odd numbers rather than round ones.
 */

import { spring } from "remotion";
import { FPS } from "./constants";

const s = (seconds: number) => seconds * FPS;

/** Element reveal windows, in frames. The board builds left to right. */
export const REVEAL = {
  download: { from: s(0.2), to: s(1.0) },
  upload: { from: s(0.5), to: s(1.4) },
  ping: { from: s(0.8), to: s(1.7) },
  pill: { from: s(1.3), to: s(1.85) },
  dots: { from: s(1.3), to: s(2.0) },
} as const;

/** The 4G -> 5G flip. Everything downstream keys off these two frames. */
export const TOGGLE = { from: s(4.55), to: s(5.1) } as const;

type SpringConfig = { damping: number; stiffness: number; mass: number };

/**
 * Movement characters, solved from the reference clips rather than picked by
 * feel. The 4G reading snaps in and overshoots about 10% before settling; the
 * 5G climb is longer and rides up, with upload the slower of the two.
 */
const SNAP: SpringConfig = { damping: 5.84, stiffness: 22.8, mass: 1.1 };
const CLIMB_DOWN: SpringConfig = { damping: 7.11, stiffness: 15.9, mass: 1.1 };
const CLIMB_UP: SpringConfig = { damping: 2.93, stiffness: 3.97, mass: 1.1 };
/** Latency is a heavier movement - it slides into place, it does not ring. */
const RISE: SpringConfig = { damping: 20, stiffness: 70, mass: 1 };
const SLIDE: SpringConfig = { damping: 17, stiffness: 26, mass: 1 };
/** The latency collapse when 5G comes up: slow to leave, quick to land. */
const DROP: SpringConfig = { damping: 6.1, stiffness: 11.6, mass: 1 };

/** A needle target: head for `to` from frame `at`, arriving under `config`. */
type Ramp = { at: number; to: number; config: SpringConfig };

/**
 * Turns a list of ramps into a needle position function.
 *
 * Each ramp departs from wherever the needle actually was when that ramp
 * started - not from the previous ramp's target - so a ramp that fires while
 * the last one is still ringing hands over smoothly instead of snapping. Those
 * handover values only depend on the ramp list, so they are solved once here.
 */
const needleFromRamps = (ramps: Ramp[]) => {
  const step = (frame: number, index: number, base: number) =>
    base +
    (ramps[index].to - base) *
      spring({
        frame: frame - ramps[index].at,
        fps: FPS,
        config: ramps[index].config,
      });

  const bases: number[] = [];
  ramps.forEach((ramp, i) => {
    bases[i] = i === 0 ? 0 : step(ramp.at, i - 1, bases[i - 1]);
  });

  return (frame: number) => {
    let value = 0;
    for (let i = 0; i < ramps.length; i++) {
      if (frame < ramps[i].at) break;
      value = step(frame, i, bases[i]);
    }
    return value;
  };
};

const DOWNLOAD_RAMPS: Ramp[] = [
  { at: s(1.25), to: 0.378, config: SNAP },
  { at: s(5.15), to: 0.965, config: CLIMB_DOWN },
];

const UPLOAD_RAMPS: Ramp[] = [
  { at: s(1.55), to: 0.325, config: SNAP },
  { at: s(5.4), to: 0.955, config: CLIMB_UP },
];

/** Latency runs the other way: high on 4G, near zero on 5G. */
const PING_RAMPS: Ramp[] = [
  { at: s(0.6), to: 0.97, config: RISE },
  { at: s(2.0), to: 0.865, config: SLIDE },
  { at: s(4.85), to: 0.01, config: DROP },
];

const downloadNeedle = needleFromRamps(DOWNLOAD_RAMPS);
const uploadNeedle = needleFromRamps(UPLOAD_RAMPS);
const pingNeedle = needleFromRamps(PING_RAMPS);

/**
 * Deterministic "live measurement" flutter: three incommensurate sines, so it
 * never repeats over the run and never needs a random seed.
 */
const flutter = (frame: number, phase: number) => {
  const t = frame / FPS;
  return (
    Math.sin(t * 6.9 + phase) * 0.55 +
    Math.sin(t * 15.3 + phase * 2.1) * 0.3 +
    Math.sin(t * 24.7 + phase * 3.7) * 0.15
  );
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** How "busy" the link is right now - drives flutter depth and meter bounce. */
export const activity = (frame: number) =>
  frame < REVEAL.download.from ? 0 : frame < TOGGLE.to ? 0.55 : 1;

export const downloadValue = (frame: number) =>
  clamp01(downloadNeedle(frame) + flutter(frame, 0.4) * 0.02 * activity(frame));

export const uploadValue = (frame: number) =>
  clamp01(uploadNeedle(frame) + flutter(frame, 2.7) * 0.018 * activity(frame));

export const pingValue = (frame: number) =>
  clamp01(pingNeedle(frame) + flutter(frame, 5.1) * 0.012 * activity(frame));

/**
 * Level shown by a dot strip: a slow base tied to throughput plus a fast
 * bounce, so the meter behaves like a VU meter rather than a static bar.
 */
export const meterLevel = (frame: number, value: number, phase: number) => {
  const t = frame / FPS;
  const bounce =
    Math.sin(t * 7.4 + phase) * 0.6 + Math.sin(t * 13.1 + phase * 1.9) * 0.4;
  return clamp01(0.16 + value * 0.5 + bounce * 0.18 * activity(frame));
};

/** 0 while on 4G, 1 once the toggle has flipped to 5G. */
export const toggleProgress = (frame: number) =>
  spring({
    frame: frame - TOGGLE.from,
    fps: FPS,
    config: { damping: 15, stiffness: 150, mass: 0.6 },
  });
