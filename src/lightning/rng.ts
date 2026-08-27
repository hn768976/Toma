import {random} from 'remotion';
import type {Range} from '../variants';

/** Every random value in the project comes through here, so a seed string is
 * the only source of variation and `remotion render` stays deterministic. */
export const rand = (seed: string): number => random(seed);

export const randIn = (seed: string, range: Range): number =>
	range.min + random(seed) * (range.max - range.min);

/** Inclusive on both ends. */
export const randIntIn = (seed: string, range: Range): number =>
	range.min + Math.floor(random(seed) * (range.max - range.min + 1));

/** -1 or 1. */
export const randSign = (seed: string): number => (random(seed) < 0.5 ? -1 : 1);

export const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Cheap seeded PRNG for bulk work (the grain tile), initialised from a
 * `random()` draw so it is still a pure function of the seed string.
 */
export const makeNoise = (seed: string): (() => number) => {
	let state = Math.floor(random(seed) * 0xffffffff) >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};
