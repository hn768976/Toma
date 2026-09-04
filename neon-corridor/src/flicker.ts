import {slotDistance} from './loop';

/** Deterministic scalar hash — no Math.random anywhere in this project. */
export const hash1 = (n: number) => {
	let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
	x ^= x >>> 13;
	x = Math.imul(x, 0xc2b2ae35);
	x ^= x >>> 16;
	return (x >>> 0) / 4294967296;
};

const SEED = 20260904;
const EVENT_COUNT = 3;

type FlickerEvent = {start: number; length: number; slot: number};

/**
 * Three failing-tube events across the loop. Sparse by design — the corridor
 * should read as steady with the odd tube stuttering, not as a strobe.
 */
const eventsFor = (durationInFrames: number): FlickerEvent[] =>
	Array.from({length: EVENT_COUNT}, (_, i) => {
		const r0 = hash1(SEED + i * 7919);
		const r1 = hash1(SEED + i * 104729);
		const r2 = hash1(SEED + i * 15485863);
		return {
			start: Math.floor(((i + 0.15 + r0 * 0.5) / EVENT_COUNT) * durationInFrames),
			length: 9 + Math.floor(r1 * 8),
			// Slots 2..8: near enough to read clearly, far enough to be on screen.
			slot: 2 + Math.floor(r2 * 7),
		};
	});

const eventCache = new Map<number, FlickerEvent[]>();
const getEvents = (durationInFrames: number) => {
	let e = eventCache.get(durationInFrames);
	if (!e) {
		e = eventsFor(durationInFrames);
		eventCache.set(durationInFrames, e);
	}
	return e;
};

/**
 * Stutter shape over an event, `tau` in [0, 1].
 *
 * The `sin(pi * tau)` envelope is zero at both ends, so the multiplier is
 * exactly 1 as the event opens and closes. No discontinuity, and no chance of
 * an event leaking across the loop boundary.
 */
const stutter = (tau: number, seed: number) => {
	const step = Math.floor(tau * 8);
	const r = hash1(seed * 1013 + step * 6151);
	const env = Math.sin(Math.PI * tau);
	const level = r < 0.5 ? 0.06 : r < 0.72 ? 1.35 : 0.5;
	return 1 + env * (level - 1);
};

/**
 * Brightness multiplier for a tube currently standing in `slot`.
 *
 * Keyed off the slot rather than the tube's identity, which is what makes the
 * loop exact (see loop.ts). The events are 9-16 frames long, over which the
 * corridor advances less than 6% of one spacing — far too little to notice
 * that the flicker is anchored to a position rather than to a tube, so it
 * still reads as one specific tube failing.
 *
 * The Gaussian falloff over slot distance keeps it continuous: a tube crossing
 * a slot boundary mid-event hands the flicker over smoothly instead of
 * snapping.
 */
export const flickerAt = (slot: number, frame: number, durationInFrames: number) => {
	let mul = 1;
	for (const ev of getEvents(durationInFrames)) {
		const local = frame - ev.start;
		if (local < 0 || local > ev.length) continue;

		const d = slotDistance(slot, ev.slot);
		if (d > 1.4) continue;

		const w = Math.exp(-(d * d) / (2 * 0.35 * 0.35));
		mul *= 1 + w * (stutter(local / ev.length, ev.slot) - 1);
	}
	return mul;
};
