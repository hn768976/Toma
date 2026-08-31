import {random} from 'remotion';
import type {Weighted} from './variants';

/**
 * Every random value in the piece comes through here, and every one of them is
 * derived from a stable string seed, so a given frame always renders
 * identically.
 */

export const rand = (seed: string): number => random(seed);

export const randRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

export const randInt = (seed: string, min: number, max: number): number =>
  Math.floor(randRange(seed, min, max + 1 - 1e-9));

/** Triangular distribution in [-1, 1], clustered on 0. */
export const randCentred = (seed: string): number =>
  random(seed + ':a') + random(seed + ':b') - 1;

export const randBool = (seed: string, chance: number): boolean =>
  random(seed) < chance;

export const pickWeighted = <T>(
  seed: string,
  options: readonly Weighted<T>[],
): T => {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let r = random(seed) * total;
  for (const option of options) {
    r -= option.weight;
    if (r <= 0) {
      return option.value;
    }
  }
  return options[options.length - 1].value;
};

/** Index of a weighted pick — handy when the value is a palette slot. */
export const pickWeightedIndex = <T>(
  seed: string,
  options: readonly Weighted<T>[],
): number => {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let r = random(seed) * total;
  for (let i = 0; i < options.length; i++) {
    r -= options[i].weight;
    if (r <= 0) {
      return i;
    }
  }
  return options.length - 1;
};
