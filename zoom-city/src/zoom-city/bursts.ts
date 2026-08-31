/**
 * Bursts: every so often a cluster of streaks in one angular sector brightens
 * sharply, then decays. The schedule is irregular but seeded, and it is built
 * to close: the gaps are normalised to sum to exactly the loop length, and
 * every envelope is evaluated on `frame % 300`, so the schedule repeats
 * exactly rather than approximately.
 *
 * The sector is chosen in CDF space rather than in radians, so a burst holds
 * the intended number of streaks whether it lands on a dense fan or a sparse
 * one.
 */

import { random } from "remotion";
import { angularMap } from "./angular";
import { LOOP_FRAMES } from "./geometry";
import type { Variant } from "./variants";

export type Burst = {
  start: number;
  duration: number;
  /** Sector, expressed as a window of the angular CDF. */
  seedStart: number;
  seedWidth: number;
  gain: number;
};

const cache = new Map<string, Burst[]>();

export const burstSchedule = (variant: Variant): Burst[] => {
  const hit = cache.get(variant.name);
  if (hit) {
    return hit;
  }

  const cfg = variant.bursts;
  const meanGap = (cfg.gapMin + cfg.gapMax) / 2;
  const count = Math.max(2, Math.round(LOOP_FRAMES / meanGap));

  const gaps: number[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const g = cfg.gapMin + random(`${variant.name}-gap-${i}`) * (cfg.gapMax - cfg.gapMin);
    gaps.push(g);
    total += g;
  }
  // Normalise so the gaps tile the loop exactly; they stay inside the
  // requested range because they were all drawn from it.
  const scale = LOOP_FRAMES / total;

  const bursts: Burst[] = [];
  let at = random(`${variant.name}-burst-offset`) * LOOP_FRAMES;
  for (let i = 0; i < count; i++) {
    const streaks =
      cfg.streakCountMin +
      random(`${variant.name}-burst-size-${i}`) *
        (cfg.streakCountMax - cfg.streakCountMin);
    bursts.push({
      start: at % LOOP_FRAMES,
      duration: Math.round(
        cfg.durationMin +
          random(`${variant.name}-burst-dur-${i}`) *
            (cfg.durationMax - cfg.durationMin),
      ),
      seedStart: pickSector(variant, i),
      seedWidth: streaks / variant.streaks.count,
      gain: 1.9 + random(`${variant.name}-burst-gain-${i}`) * 1.1,
    });
    at += gaps[i] * scale;
  }

  cache.set(variant.name, bursts);
  return bursts;
};

/**
 * Where the burst sits in CDF space.
 *
 * Where a floor clips the field at the horizon, a sector aimed downward would
 * brighten streaks nobody can see, so candidates are drawn until one points
 * above the horizon. The candidates are seeded, so the choice is still fixed.
 */
const pickSector = (variant: Variant, i: number) => {
  const map = angularMap(variant);
  let candidate = random(`${variant.name}-burst-sector-${i}`);
  if (variant.streaks.downBias === 0) {
    return candidate;
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    candidate = random(`${variant.name}-burst-sector-${i}-${attempt}`);
    if (Math.sin(map.angleAt(candidate)) < 0.1) {
      return candidate;
    }
  }
  return candidate;
};

/** Sharp attack, longer decay. Zero outside the burst, so the loop closes. */
const envelope = (x: number) => {
  if (x < 0 || x > 1) {
    return 0;
  }
  if (x < 0.18) {
    return x / 0.18;
  }
  return Math.pow(1 - (x - 0.18) / 0.82, 1.8);
};

export type ActiveBurst = { burst: Burst; intensity: number };

export const activeBursts = (variant: Variant, f: number): ActiveBurst[] => {
  const out: ActiveBurst[] = [];
  for (const burst of burstSchedule(variant)) {
    const local = ((f - burst.start) % LOOP_FRAMES + LOOP_FRAMES) % LOOP_FRAMES;
    const intensity = envelope(local / burst.duration);
    if (intensity > 0.001) {
      out.push({ burst, intensity });
    }
  }
  return out;
};

/** Brightness multiplier for a streak whose angle-seed is `angleSeed`. */
export const burstGain = (active: ActiveBurst[], angleSeed: number) => {
  let gain = 1;
  for (const { burst, intensity } of active) {
    const d = (angleSeed - burst.seedStart + 1) % 1;
    if (d < burst.seedWidth) {
      // Soften the edges of the sector so the cluster has no hard boundary.
      const edge = Math.min(1, (Math.min(d, burst.seedWidth - d) / burst.seedWidth) * 4);
      gain += (burst.gain - 1) * intensity * edge;
    }
  }
  return gain;
};
