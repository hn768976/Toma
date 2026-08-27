import {random} from 'remotion';

export const TAU = Math.PI * 2;

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) =>
	t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

/** Normalised, clamped ramp between two frames. */
export const ramp = (frame: number, a: number, b: number) =>
	clamp01((frame - a) / Math.max(1e-6, b - a));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Camera drift on a closed Lissajous path. Both components use periods that
 * divide the 570-frame duration, so frame 570 lands exactly on frame 0.
 */
export const cameraDrift = (frame: number, duration: number) => {
	const p = (frame / duration) * TAU;
	return {
		x: 12 * Math.sin(p),
		y: 9 * Math.sin(2 * p + Math.PI / 3),
	};
};

/**
 * A value that jumps to a new seeded target every `period` frames and eases
 * into it over `glide` frames. Give each slot its own `phase` so the whole
 * dashboard produces a steady 2-3 discrete events per second rather than
 * updating everything at once.
 */
export const stepped = (
	seed: string,
	frame: number,
	period: number,
	phase: number,
	glide = 10
) => {
	const t = frame + phase;
	const idx = Math.floor(t / period);
	const into = t - idx * period;
	const from = random(`${seed}#${idx - 1}`);
	const to = random(`${seed}#${idx}`);
	return lerp(from, to, easeOutCubic(clamp01(into / glide)));
};

/** Integer variant of `stepped` - for rerolling digits. */
export const steppedInt = (
	seed: string,
	frame: number,
	period: number,
	phase: number,
	max: number
) => {
	const idx = Math.floor((frame + phase) / period);
	return Math.floor(random(`${seed}#${idx}`) * max);
};

/**
 * Critically-ish damped spring toward a target that changes every `period`
 * frames. Evaluated in closed form from the frame number - no state.
 */
export const springTo = (
	seed: string,
	frame: number,
	period: number,
	phase: number,
	damping = 0.16,
	freq = 0.085
) => {
	const t = frame + phase;
	const idx = Math.floor(t / period);
	const into = t - idx * period;
	const from = random(`${seed}#${idx - 1}`);
	const to = random(`${seed}#${idx}`);
	const decay = Math.exp(-damping * into);
	const osc = Math.cos(freq * into * TAU);
	return to + (from - to) * decay * osc;
};
