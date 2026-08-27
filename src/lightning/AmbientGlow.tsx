import React, {useLayoutEffect} from 'react';
import {useCurrentFrame} from 'remotion';
import type {VariantConfig, VariantName} from '../variants';
import {withAlpha} from './color';
import {radialWash} from './draw';
import {getBolt} from './geometry';
import {afterglowAmount, getSchedule} from './schedule';
import {paintGlow, useSurfaces} from './surface';

/**
 * Two things happen here, both on the quarter-size glow surface:
 *
 *  - drifting cloud-like haze in the upper third, which brightens when a bolt
 *    fires because dense air scatters the light;
 *  - a broad wash around every recently lit channel, extending well past the
 *    channel itself and decaying more slowly than the bolt does.
 */
export const AmbientGlow: React.FC<{cfg: VariantConfig; variant: VariantName}> = ({
	cfg,
	variant,
}) => {
	const frame = useCurrentFrame() % cfg.timing.durationInFrames;
	const surfaces = useSurfaces();

	useLayoutEffect(() => {
		const {width, height} = surfaces;
		const {ambient, palette} = cfg;
		const schedule = getSchedule(variant, cfg);

		// Strongest afterglow anywhere in the frame, used to lift the haze.
		let peak = 0;
		const active = schedule.lightings
			.map((lighting) => ({
				lighting,
				amount: afterglowAmount(lighting, frame, ambient.glowDecayFrames),
			}))
			.filter((entry) => entry.amount > 0);
		active.forEach((entry) => {
			peak = Math.max(peak, entry.amount);
		});

		paintGlow(surfaces, (ctx, scale) => {
			// Haze: a few wide, very low contrast bands drifting across the top.
			// The drift is a full turn over one loop, so it closes seamlessly.
			const turn = (frame / cfg.timing.durationInFrames) * Math.PI * 2;
			for (let i = 0; i < ambient.hazeBands; i++) {
				const phase = (i / ambient.hazeBands) * Math.PI * 2;
				const x =
					(((i + 0.5) / ambient.hazeBands) * width +
						Math.sin(turn + phase) * ambient.hazeDrift * width) *
					scale;
				const y =
					(0.06 + 0.62 * ((i * 0.37) % 1)) * ambient.hazeHeight * height * scale;
				const radius = (0.3 + 0.22 * ((i * 0.61) % 1)) * width * scale;
				const alpha = ambient.hazeAlpha * (0.4 + 0.6 * ((i * 0.29) % 1));
				radialWash(
					ctx,
					x,
					y,
					radius,
					withAlpha(palette.haze, alpha * (1 + peak * ambient.hazeLift) * 0.1),
					withAlpha(palette.haze, 0),
					1,
					0.42,
				);
			}

			// Wash around each lit channel.
			active.forEach(({lighting, amount}) => {
				const bolt = getBolt({
					seed: lighting.seed,
					cfg: cfg.bolt,
					origin: {x: lighting.originX, y: lighting.originY},
					travel: lighting.travel,
					drift: lighting.drift,
				});
				const main = bolt.strokes[0];
				const step = Math.max(1, Math.floor(main.points.length / ambient.glowSamples));
				for (let i = 0; i < main.points.length; i += step) {
					const point = main.points[i];
					// The wash is widest near the origin and tightens towards the tip.
					const radius = ambient.glowRadius * (1 - 0.45 * main.travel[i]) * scale;
					radialWash(
						ctx,
						point.x * scale,
						point.y * scale,
						radius,
						withAlpha(palette.glowWide, ambient.glowAlpha * amount * 0.14),
						withAlpha(palette.glowWide, 0),
					);
				}
			});
		});
	});

	return null;
};
