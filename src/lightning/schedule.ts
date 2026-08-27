import type {VariantConfig, VariantName} from '../variants';
import {rand, randIn, randIntIn} from './rng';

/** One bolt lit for one return stroke. */
export interface Lighting {
	/** Seed for this exact channel — re-seeded per flash so the channel shifts
	 * between return strokes. */
	seed: string;
	eventIndex: number;
	flashIndex: number;
	boltIndex: number;
	/** First frame the bolt is lit. */
	start: number;
	/** Frames it stays lit. */
	duration: number;
	/** 0..1 brightness of this return stroke. */
	intensity: number;
	originX: number;
	originY: number;
	travel: number;
	drift: number;
}

export interface StrikeEvent {
	index: number;
	/** Frame of the brightest return stroke in this burst. */
	peakFrame: number;
	peakIntensity: number;
}

export interface Schedule {
	lightings: Lighting[];
	events: StrikeEvent[];
	/** Frame after the last light of the loop — everything past it is dark. */
	lastLitFrame: number;
}

interface DraftFlash {
	offset: number;
	duration: number;
	intensity: number;
}

interface DraftBolt {
	originX: number;
	originY: number;
	travel: number;
	drift: number;
	stagger: number;
}

/** Seeded Fisher-Yates over [0, count). */
const shuffled = (seed: string, count: number): number[] => {
	const order = Array.from({length: count}, (_, i) => i);
	for (let i = count - 1; i > 0; i--) {
		const j = Math.floor(rand(`${seed}:${i}`) * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	return order;
};

const cache = new Map<string, Schedule>();

const buildSchedule = (name: VariantName, cfg: VariantConfig): Schedule => {
	const {schedule: s, bolt, timing} = cfg;
	const loop = timing.durationInFrames;
	const {width, height} = timing;
	// Downward strikes start at the top edge, upward ones at the bottom.
	const originY = bolt.strikeDirection > 0 ? 0 : height;

	const eventBolts: DraftBolt[][] = [];
	const eventFlashes: DraftFlash[][] = [];
	const burstLengths: number[] = [];

	for (let e = 0; e < s.events; e++) {
		const boltCount = randIntIn(`${name}:e${e}:count`, bolt.count);
		const bolts: DraftBolt[] = [];
		for (let b = 0; b < boltCount; b++) {
			// Spread simultaneous bolts across the origin range rather than letting
			// them cluster, so they do not intersect.
			const slot = boltCount === 1 ? 0.5 : b / (boltCount - 1);
			const span = bolt.originX.max - bolt.originX.min;
			const jitter = (randIn(`${name}:e${e}:b${b}:x`, {min: -1, max: 1}) * span) / (boltCount * 3);
			bolts.push({
				originX: (bolt.originX.min + span * slot + jitter) * width,
				originY,
				travel: randIn(`${name}:e${e}:b${b}:travel`, bolt.travel) * height,
				drift: randIn(`${name}:e${e}:b${b}:drift`, bolt.drift) * width,
				stagger: 0,
			});
		}

		// Bolts in one event do not all flash together: they are dealt distinct
		// lags, a seeded few frames apart and in a seeded order, so the burst
		// ripples across the frame instead of switching on as a block.
		let lag = 0;
		shuffled(`${name}:e${e}:order`, boltCount).forEach((boltIndex, position) => {
			if (position > 0) {
				lag += randIntIn(`${name}:e${e}:lag${position}`, bolt.stagger);
			}
			bolts[boltIndex].stagger = lag;
		});

		const flashCount = randIntIn(`${name}:e${e}:flashes`, s.flashesPerEvent);
		const flashes: DraftFlash[] = [];
		let cursor = 0;
		for (let f = 0; f < flashCount; f++) {
			const duration = randIntIn(`${name}:e${e}:f${f}:dur`, s.flashDuration);
			flashes.push({
				offset: cursor,
				duration,
				intensity: randIn(`${name}:e${e}:f${f}:int`, s.flashIntensity),
			});
			cursor += duration + randIntIn(`${name}:e${e}:f${f}:gap`, s.flashGap);
		}

		const maxStagger = bolts.reduce((acc, b) => Math.max(acc, b.stagger), 0);
		eventBolts.push(bolts);
		eventFlashes.push(flashes);
		burstLengths.push(cursor + maxStagger);
	}

	const totalBurst = burstLengths.reduce((a, b) => a + b, 0);

	// Dark stretches: one before each event plus the tail after the last one.
	// They are drawn inside the configured pause range and then nudged, one
	// frame at a time, until they exactly fill whatever the bursts leave over.
	// That keeps the darkness spread across the loop instead of pooling at the
	// end, and guarantees the last event finishes before the loop point.
	const slots = s.events + 1;
	const pauses: number[] = [];
	for (let i = 0; i < slots; i++) {
		pauses.push(randIntIn(`${name}:pause${i}`, s.eventPause));
	}
	pauses[0] = Math.max(pauses[0], s.headDark);
	pauses[slots - 1] = Math.max(pauses[slots - 1], s.tailDark);

	const floorOf = (i: number) =>
		i === 0 ? s.headDark : i === slots - 1 ? s.tailDark : Math.min(s.eventPause.min, s.eventPause.max);
	const darkBudget = loop - totalBurst;
	let spare = darkBudget - pauses.reduce((a, b) => a + b, 0);
	// Round-robin so no single stretch soaks up the whole correction.
	for (let guard = 0; spare !== 0 && guard < loop * slots; guard++) {
		const i = guard % slots;
		if (spare > 0) {
			if (pauses[i] < s.eventPause.max) {
				pauses[i]++;
				spare--;
			} else if (i === slots - 1) {
				// Nothing else has room; the tail simply stays dark for longer.
				pauses[i] += spare;
				spare = 0;
			}
		} else if (pauses[i] > floorOf(i)) {
			pauses[i]--;
			spare++;
		}
	}
	if (spare > 0) {
		pauses[slots - 1] += spare;
	}
	// Last resort: the bursts themselves are longer than the loop allows, so
	// take the remainder out of the pauses below their floor rather than let an
	// event straddle the loop point.
	for (let guard = 0; spare < 0 && guard < loop * slots; guard++) {
		const i = guard % slots;
		if (pauses[i] > 0) {
			pauses[i]--;
			spare++;
		}
	}

	const lightings: Lighting[] = [];
	const events: StrikeEvent[] = [];
	let frame = 0;
	let lastLitFrame = 0;

	for (let e = 0; e < s.events; e++) {
		frame += pauses[e];
		const eventStart = frame;
		const flashes = eventFlashes[e];
		let peakFrame = eventStart;
		let peakIntensity = 0;

		flashes.forEach((flash, f) => {
			if (flash.intensity > peakIntensity) {
				peakIntensity = flash.intensity;
				peakFrame = eventStart + flash.offset;
			}
			eventBolts[e].forEach((b, i) => {
				const start = eventStart + flash.offset + b.stagger;
				lightings.push({
					seed: `${name}:e${e}:f${f}:b${i}`,
					eventIndex: e,
					flashIndex: f,
					boltIndex: i,
					start,
					duration: flash.duration,
					intensity: flash.intensity,
					originX: b.originX,
					originY: b.originY,
					travel: b.travel,
					drift: b.drift,
				});
				lastLitFrame = Math.max(lastLitFrame, start + flash.duration);
			});
		});

		events.push({index: e, peakFrame, peakIntensity});
		frame = eventStart + burstLengths[e];
	}

	return {lightings, events, lastLitFrame};
};

export const getSchedule = (name: VariantName, cfg: VariantConfig): Schedule => {
	const hit = cache.get(name);
	if (hit) {
		return hit;
	}
	const built = buildSchedule(name, cfg);
	cache.set(name, built);
	return built;
};

/** Brightness of a bolt at a frame: full for the flash, then nothing. */
export const litAmount = (lighting: Lighting, frame: number): number => {
	const age = frame - lighting.start;
	if (age < 0 || age >= lighting.duration) {
		return 0;
	}
	// Return strokes fade a little across their own handful of frames.
	return lighting.intensity * (1 - 0.28 * (age / Math.max(1, lighting.duration)));
};

/** Brightness of the atmospheric wash, which outlives the channel. */
export const afterglowAmount = (
	lighting: Lighting,
	frame: number,
	decayFrames: number,
): number => {
	const age = frame - lighting.start;
	if (age < 0) {
		return 0;
	}
	if (age < lighting.duration) {
		return lighting.intensity;
	}
	const t = (age - lighting.duration) / decayFrames;
	if (t >= 1) {
		return 0;
	}
	return lighting.intensity * (1 - t) ** 2;
};
