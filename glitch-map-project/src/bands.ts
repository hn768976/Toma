import {hash, hashInt, hashRange} from './hash';

/**
 * The horizontal glitch bands - runs of smeared, torn pixels across the frame.
 *
 * One shared model, so the field canvas and the map's tearing agree about where
 * a band is on any given frame. Every band is derived from a slot index and an
 * epoch, both integers, so a band persists for a few frames and then jumps to a
 * new position without any state being carried between frames.
 */

export const BAND_SLOTS = 30;

export type Band = {
  readonly slot: number;
  readonly seed: number;
  /** Top edge and height, as fractions of frame height. */
  readonly y: number;
  readonly h: number;
  /** 0-1. Drives alpha, noise density and how hard the map tears. */
  readonly intensity: number;
  /** True for the hotter of the two band colours. */
  readonly hot: boolean;
  /** Horizontal displacement of the torn run, as a fraction of frame width. */
  readonly shift: number;
};

/**
 * The bands alive on this frame.
 *
 * Slot lifetimes range from 1 frame (a flash) to 14 (a band that sits there and
 * smears), so the field never settles into a rhythm.
 */
export const getBands = (frame: number): Band[] => {
  const bands: Band[] = [];
  for (let slot = 0; slot < BAND_SLOTS; slot++) {
    const life = slot % 5 === 0 ? 1 : hashInt(2, 14, slot, 91);
    const phase = hashInt(0, 60, slot, 17);
    const epoch = Math.floor((frame + phase) / life);
    // Not every slot is occupied every epoch: bands appear and vanish.
    if (hash(slot, epoch, 5) > 0.62) continue;

    const seed = (slot * 131 + epoch * 7919) | 0;
    const thick = hash(slot, epoch, 11) > 0.82;
    bands.push({
      slot,
      seed,
      y: hash(slot, epoch, 2),
      h: thick ? hashRange(0.02, 0.055, slot, epoch, 3) : hashRange(0.0015, 0.012, slot, epoch, 3),
      intensity: hashRange(0.18, 1, slot, epoch, 4),
      hot: hash(slot, epoch, 6) > 0.55,
      shift: (hash(slot, epoch, 8) - 0.5) * hashRange(0.004, 0.05, slot, epoch, 9),
    });
  }
  return bands;
};

/**
 * The bands strong enough to tear the map. Capped at three: more than that and
 * the shape stops reading.
 */
export const getTearBands = (frame: number): Band[] =>
  getBands(frame)
    .filter((b) => b.intensity > 0.55 && b.h > 0.004)
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 3);
