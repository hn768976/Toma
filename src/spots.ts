import {random} from 'remotion';
import type {Config} from './config';
import {marginCells} from './config';
import type {Flash} from './animation';
import type {PaletteEntry, Theme} from './theme';
import {hexToRgb, rgba} from './colors';

/**
 * The spot field is generated once (seeded, deterministic) and reused for every
 * frame. Regenerating per frame would make the whole array boil.
 */

export type Spot = {
	readonly col: number;
	readonly row: number;
	/** Home position in buffer space, before drift. */
	readonly x: number;
	readonly y: number;
	readonly radius: number;
	readonly colorIndex: number;
	/** 0 means an unprinted grid position. */
	readonly brightness: number;
	readonly flickerPeriod: number;
	readonly flickerPhase: number;
};

export type SpotField = {
	readonly spots: readonly Spot[];
	readonly cols: number;
	readonly rows: number;
	readonly onScreenCount: number;
};

const pickWeighted = (palette: readonly PaletteEntry[], sample: number): number => {
	const total = palette.reduce((sum, entry) => sum + entry.weight, 0);
	let cursor = sample * total;
	for (let i = 0; i < palette.length; i++) {
		cursor -= palette[i].weight;
		if (cursor <= 0) {
			return i;
		}
	}
	return palette.length - 1;
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Seed key for a grid position. In `linearTiled` drift the field has to be
 * invariant under a translation of `tileCells` cells along the diagonal, so the
 * key is folded onto that sublattice; otherwise every cell is independent.
 */
const seedKey = (col: number, row: number, config: Config): string => {
	if (config.drift.mode === 'linearTiled') {
		const t = Math.max(1, Math.round(config.drift.tileCells));
		return `${col - row}:${((col % t) + t) % t}`;
	}
	return `${col}:${row}`;
};

export const buildSpotField = (config: Config, theme: Theme): SpotField => {
	const {width, height} = config.timeline;
	const {pitchPx, radiusPx, jitterPx, radiusVariance} = config.grid;
	const margin = marginCells(config);
	const {palette} = theme;
	const pop = config.population;

	const onScreenCols = Math.ceil(width / pitchPx);
	const onScreenRows = Math.ceil(height / pitchPx);
	const cols = onScreenCols + margin * 2;
	const rows = onScreenRows + margin * 2;

	// Centre the on-screen part of the lattice, then step back over the margin.
	const originX = (width - onScreenCols * pitchPx) / 2 + pitchPx / 2 - margin * pitchPx;
	const originY = (height - onScreenRows * pitchPx) / 2 + pitchPx / 2 - margin * pitchPx;

	const spots: Spot[] = [];
	// Colour of the spot to the left and of the row above, so same-coloured
	// spots occasionally clump into small regional clusters instead of being
	// perfectly scattered.
	let leftColor = -1;
	let leftRun = 0;
	const aboveColors: number[] = new Array(cols).fill(-1);
	const aboveRuns: number[] = new Array(cols).fill(0);
	let onScreenCount = 0;

	for (let row = 0; row < rows; row++) {
		leftColor = -1;
		leftRun = 0;
		for (let col = 0; col < cols; col++) {
			const key = seedKey(col, row, config);

			const inheritSample = random(`cluster-${key}`);
			const inheritSide = random(`cluster-side-${key}`);
			let colorIndex: number;
			if (inheritSample < pop.clusterChance && leftColor >= 0 && leftRun < pop.maxClusterRun && inheritSide < 0.5) {
				colorIndex = leftColor;
				leftRun += 1;
			} else if (
				inheritSample < pop.clusterChance &&
				aboveColors[col] >= 0 &&
				aboveRuns[col] < pop.maxClusterRun
			) {
				colorIndex = aboveColors[col];
				leftRun = leftColor === colorIndex ? leftRun + 1 : 1;
			} else {
				colorIndex = pickWeighted(palette, random(`color-${key}`));
				leftRun = leftColor === colorIndex ? leftRun + 1 : 1;
			}
			aboveRuns[col] = aboveColors[col] === colorIndex ? aboveRuns[col] + 1 : 1;
			aboveColors[col] = colorIndex;
			leftColor = colorIndex;

			// An array is never fully populated; the gaps are part of the texture.
			let brightness: number;
			const blankSample = random(`blank-${key}`);
			if (blankSample < pop.blankChance) {
				brightness =
					random(`blank-kind-${key}`) < pop.fullyBlankShare
						? 0
						: lerp(pop.dimRange[0], pop.dimRange[1], random(`dim-${key}`));
			} else if (random(`hot-${key}`) < pop.hotChance) {
				brightness = lerp(pop.hotRange[0], pop.hotRange[1], random(`hot-level-${key}`));
			} else {
				brightness = lerp(pop.baseRange[0], pop.baseRange[1], random(`level-${key}`));
			}

			const jitterX = (random(`jx-${key}`) * 2 - 1) * jitterPx;
			const jitterY = (random(`jy-${key}`) * 2 - 1) * jitterPx;
			const radius = radiusPx * (1 + (random(`radius-${key}`) * 2 - 1) * radiusVariance);
			const periods = config.flicker.periods;
			const flickerPeriod = periods[Math.floor(random(`period-${key}`) * periods.length) % periods.length];

			const x = originX + col * pitchPx + jitterX;
			const y = originY + row * pitchPx + jitterY;

			if (x > -radius && x < width + radius && y > -radius && y < height + radius && brightness > 0) {
				onScreenCount += 1;
			}

			spots.push({
				col,
				row,
				x,
				y,
				radius,
				colorIndex,
				brightness,
				flickerPeriod,
				flickerPhase: random(`phase-${key}`),
			});
		}
	}

	return {spots, cols, rows, onScreenCount};
};

/**
 * One pre-rendered disc per palette colour. Drawing a sprite per spot is far
 * cheaper than building ~1000 radial gradients every frame, and guarantees every
 * spot shares exactly the same profile.
 *
 * The profile is marginally brighter at ~80% of the radius than at the centre:
 * invisible when sharp, and the classic bokeh donut once it is defocused.
 */
export const buildSpotSprites = (config: Config, theme: Theme): HTMLCanvasElement[] => {
	const size = config.spotProfile.spriteSizePx;
	const radius = size / 2;
	const {coreLevel, rimStop, rimLevel, edgeStop, edgeLevel} = config.spotProfile;

	return theme.palette.map((entry) => {
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			return canvas;
		}
		const rgb = hexToRgb(entry.color);
		const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
		gradient.addColorStop(0, rgba(rgb, coreLevel));
		gradient.addColorStop(rimStop * 0.7, rgba(rgb, lerp(coreLevel, rimLevel, 0.45)));
		gradient.addColorStop(rimStop, rgba(rgb, rimLevel));
		gradient.addColorStop(edgeStop, rgba(rgb, edgeLevel));
		gradient.addColorStop(1, rgba(rgb, 0));
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, size, size);
		return canvas;
	});
};

/**
 * One or two spots per second flash marginally brighter for 3-4 frames. Start
 * frames are seeded per second of the loop and wrap, so the schedule is
 * identical on every render and closes across the loop point.
 */
export const buildFlashSchedule = (config: Config, field: SpotField): Map<number, Flash[]> => {
	const {fps, durationInFrames} = config.timeline;
	const seconds = Math.round(durationInFrames / fps);
	const candidates: number[] = [];
	field.spots.forEach((spot, index) => {
		if (spot.brightness > 0) {
			candidates.push(index);
		}
	});

	const schedule = new Map<number, Flash[]>();
	if (candidates.length === 0) {
		return schedule;
	}

	for (let second = 0; second < seconds; second++) {
		const span = config.flash.maxPerSecond - config.flash.minPerSecond;
		const count = config.flash.minPerSecond + Math.round(random(`flash-count-${second}`) * span);
		for (let k = 0; k < count; k++) {
			const pick = Math.floor(random(`flash-spot-${second}-${k}`) * candidates.length);
			const spotIndex = candidates[Math.min(pick, candidates.length - 1)];
			const startFrame =
				(second * fps + Math.floor(random(`flash-start-${second}-${k}`) * fps)) % durationInFrames;
			const frameSpan = config.flash.maxFrames - config.flash.minFrames;
			const durationFrames =
				config.flash.minFrames + Math.round(random(`flash-len-${second}-${k}`) * frameSpan);
			const flash: Flash = {spotIndex, startFrame, durationFrames, boost: config.flash.boost};
			const existing = schedule.get(spotIndex);
			if (existing) {
				existing.push(flash);
			} else {
				schedule.set(spotIndex, [flash]);
			}
		}
	}
	return schedule;
};
