import React, {useLayoutEffect} from 'react';
import {useCurrentFrame} from 'remotion';
import type {VariantConfig, VariantName} from '../variants';
import {withAlpha} from './color';
import {getSchedule} from './schedule';
import {useSurfaces} from './surface';

/**
 * The whole-frame overexposure wash. On the brightest return stroke of a burst
 * the background lifts out of near-black for a couple of frames and then falls
 * back. Variants with `frameFlash: null` draw nothing. Held longer than about
 * three frames it stops reading as a flash and starts reading as a background
 * change, so the hold is deliberately short.
 */
export const FrameFlash: React.FC<{cfg: VariantConfig; variant: VariantName}> = ({
	cfg,
	variant,
}) => {
	const frame = useCurrentFrame() % cfg.timing.durationInFrames;
	const surfaces = useSurfaces();

	useLayoutEffect(() => {
		const profile = cfg.frameFlash;
		if (!profile) {
			return;
		}
		const schedule = getSchedule(variant, cfg);

		let strength = 0;
		schedule.events.forEach((event) => {
			if (event.peakIntensity < profile.threshold) {
				return;
			}
			const age = frame - event.peakFrame;
			if (age < 0) {
				return;
			}
			if (age < profile.holdFrames) {
				strength = Math.max(strength, event.peakIntensity);
				return;
			}
			const t = (age - profile.holdFrames) / profile.decayFrames;
			if (t < 1) {
				strength = Math.max(strength, event.peakIntensity * (1 - t) ** 2);
			}
		});

		if (strength <= 0) {
			return;
		}

		const {ctx, width, height} = surfaces;
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		ctx.fillStyle = withAlpha(profile.color, strength);
		ctx.fillRect(0, 0, width, height);
		ctx.restore();
	});

	return null;
};
