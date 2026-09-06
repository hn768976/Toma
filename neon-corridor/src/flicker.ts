import {FRAME_COUNT, TRAVEL_SPACINGS} from './config';

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

type FlickerEvent = {start: number; length: number; tube: number};

/**
 * Three failing-tube events across the loop. Sparse by design — the corridor
 * should read as steady with the odd tube stuttering, not as a strobe.
 */
const eventsFor = (durationInFrames: number): FlickerEvent[] =>
	Array.from({length: EVENT_COUNT}, (_, i) => {
		const r0 = hash1(SEED + i * 7919);
		const r1 = hash1(SEED + i * 104729);
		const r2 = hash1(SEED + i * 15485863);
		const start = Math.floor(((i + 0.15 + r0 * 0.5) / EVENT_COUNT) * durationInFrames);
		const length = 9 + Math.floor(r1 * 8);
		// Slots 2..8: near enough to read clearly, far enough to be on screen.
		const slot = 2 + Math.floor(r2 * 7);

		// Resolve that slot to whichever tube is standing in it halfway through
		// the event, and flicker that tube for the event's duration. Inverting
		// slotOf: slot = k - TRAVEL_SPACINGS * t, so k = slot + TRAVEL_SPACINGS * t.
		const tMid = (start + length / 2) / durationInFrames;
		const tube =
			(Math.round(slot + TRAVEL_SPACINGS * tMid) % FRAME_COUNT + FRAME_COUNT) % FRAME_COUNT;

		return {start, length, tube};
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
 * Brightness multiplier for tube `k`.
 *
 * Keyed off the tube's identity, so the flicker travels with the tube down the
 * corridor. That matters at TRAVEL_SPACINGS = 6: an event runs 9-16 frames,
 * over which the corridor now advances up to a quarter of a spacing, and a
 * position-keyed flicker would visibly slide off its tube onto the next one.
 *
 * This is the one place the loop.ts rule is broken on purpose, and it is still
 * exact. The rule exists because at t = 1 a different tube stands where tube k
 * stood at t = 0 — but every event opens and closes strictly inside the loop,
 * and the `sin(pi * tau)` envelope means the multiplier is exactly 1 at both
 * ends. Both boundary frames are therefore unflickered whichever tube is
 * where, so the wrap is untouched.
 */
export const flickerAt = (k: number, frame: number, durationInFrames: number) => {
	let mul = 1;
	for (const ev of getEvents(durationInFrames)) {
		const local = frame - ev.start;
		if (local < 0 || local > ev.length) continue;
		if (k !== ev.tube) continue;

		mul *= stutter(local / ev.length, ev.tube);
	}
	return mul;
};
