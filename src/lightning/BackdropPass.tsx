import React, {useLayoutEffect} from 'react';
import {useCurrentFrame} from 'remotion';
import type {VariantConfig} from '../variants';
import {blend} from './color';
import {useSurfaces} from './surface';

/**
 * Clears the frame and lays down the near-black background with its very faint
 * vertical gradient. Runs first, so every later pass composites onto a clean
 * canvas — which is also what makes the whole draw idempotent.
 */
export const BackdropPass: React.FC<{cfg: VariantConfig}> = ({cfg}) => {
	// Subscribing to the frame is what re-runs this pass every frame.
	useCurrentFrame();
	const surfaces = useSurfaces();

	useLayoutEffect(() => {
		const {ctx, width, height} = surfaces;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
		ctx.clearRect(0, 0, width, height);

		const gradient = ctx.createLinearGradient(0, 0, 0, height);
		gradient.addColorStop(
			0,
			blend(cfg.palette.background, cfg.palette.haze, cfg.ambient.backgroundTopMix),
		);
		gradient.addColorStop(
			1,
			blend(cfg.palette.background, cfg.palette.haze, cfg.ambient.backgroundBottomMix),
		);
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);
	});

	return null;
};
