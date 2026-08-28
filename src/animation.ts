import {Easing, interpolate} from 'remotion';
import type {Config} from './config';
import type {Spot} from './spots';

/**
 * Everything time-dependent in the piece is a pure function of the frame number
 * and lives in this file, so the loop can be reasoned about (and verified)
 * without touching the renderer.
 */

export const wrapFrame = (frame: number, durationInFrames: number): number =>
	((frame % durationInFrames) + durationInFrames) % durationInFrames;

/**
 * The rack focus. Soft hold, an 80-frame pull in on an in/out cubic, a sharp
 * hold, then the mirrored pull back out and a soft hold that matches the top of
 * the loop exactly.
 */
export const focusBlurAtFrame = (frame: number, config: Config): number => {
	const {durationInFrames} = config.timeline;
	const {maxBlurPx, minBlurPx, holdSoftEnd, pullInEnd, holdSharpEnd, pullOutEnd} = config.focus;
	const f = wrapFrame(frame, durationInFrames);
	return interpolate(
		f,
		[0, holdSoftEnd, pullInEnd, holdSharpEnd, pullOutEnd, durationInFrames],
		[maxBlurPx, maxBlurPx, minBlurPx, minBlurPx, maxBlurPx, maxBlurPx],
		{
			easing: Easing.inOut(Easing.cubic),
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		},
	);
};

/**
 * Blur spreads a spot's energy over a much larger area, so a soft frame reads
 * dimmer than a sharp one even though the mean luminance is unchanged. Gain the
 * soft passages back up, otherwise the pull reads as an exposure change.
 */
export const exposureGainForBlur = (blurPx: number, config: Config): number => {
	const {maxBlurPx} = config.focus;
	const {blurCompensationGain, blurCompensationExponent} = config.exposure;
	const t = maxBlurPx === 0 ? 0 : Math.min(1, Math.max(0, blurPx / maxBlurPx));
	return 1 + blurCompensationGain * Math.pow(t, blurCompensationExponent);
};

export type Vec2 = {x: number; y: number};

/**
 * Slow diagonal drift of the whole field.
 *
 * `closedDiagonal` (default) walks a very thin ellipse whose long axis is the
 * drift diagonal: the path closes on itself in exactly one loop, so frame 0 and
 * frame `durationInFrames` land on the same offset without the spot field
 * having to repeat spatially.
 *
 * `linearTiled` is the literal reading — a constant one-way translation of
 * exactly `tileCells` grid cells per loop, paired with a spot field that is
 * seeded periodically along that axis so the translation closes the loop.
 */
export const driftOffsetAtFrame = (frame: number, config: Config): Vec2 => {
	const {durationInFrames, fps} = config.timeline;
	const t = wrapFrame(frame, durationInFrames) / durationInFrames;
	const angle = (config.drift.angleDeg * Math.PI) / 180;
	const ux = Math.cos(angle);
	const uy = Math.sin(angle);

	if (config.drift.mode === 'linearTiled') {
		const distance = t * config.drift.tileCells * config.grid.pitchPx * Math.SQRT2;
		return {x: distance * ux, y: distance * uy};
	}

	// Path length of a thin ellipse is ~4 * semi-major axis, so this keeps the
	// average speed at the configured px/sec.
	const seconds = durationInFrames / fps;
	const major = (config.drift.pxPerSecond * seconds) / 4;
	const minor = major * config.drift.lateralRatio;
	const theta = 2 * Math.PI * t;
	const along = major * Math.sin(theta);
	const across = minor * Math.cos(theta);
	return {
		x: along * ux + across * -uy,
		y: along * uy + across * ux,
	};
};

/** Seeded per-spot breathing. Every period divides the loop length. */
export const flickerFactor = (spot: Spot, frame: number, config: Config): number => {
	const f = wrapFrame(frame, config.timeline.durationInFrames);
	const phase = 2 * Math.PI * (f / spot.flickerPeriod + spot.flickerPhase);
	return 1 + config.flicker.amplitude * Math.sin(phase);
};

export type Flash = {
	readonly spotIndex: number;
	readonly startFrame: number;
	readonly durationFrames: number;
	readonly boost: number;
};

/** A raised-cosine blip, so a flash starts and ends at exactly zero. */
export const flashFactor = (
	flashes: readonly Flash[] | undefined,
	frame: number,
	config: Config,
): number => {
	if (!flashes || flashes.length === 0) {
		return 1;
	}
	const {durationInFrames} = config.timeline;
	const f = wrapFrame(frame, durationInFrames);
	let boost = 0;
	for (const flash of flashes) {
		const elapsed = wrapFrame(f - flash.startFrame, durationInFrames);
		if (elapsed < flash.durationFrames) {
			const envelope = 0.5 - 0.5 * Math.cos((2 * Math.PI * elapsed) / flash.durationFrames);
			boost += flash.boost * envelope;
		}
	}
	return 1 + boost;
};

export const spotIntensity = (
	spot: Spot,
	frame: number,
	config: Config,
	flashes?: readonly Flash[],
): number => {
	if (spot.brightness <= 0) {
		return 0;
	}
	const intensity =
		spot.brightness * flickerFactor(spot, frame, config) * flashFactor(flashes, frame, config);
	return Math.max(0, Math.min(1, intensity));
};
