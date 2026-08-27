import React, {useLayoutEffect, useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import type {VariantConfig} from '../variants';
import {makeNoise} from './rng';
import {useSurfaces} from './surface';

/**
 * The finishing pass: vignette, then fine grain. The grain is a seeded noise
 * tile rebuilt from `frame % durationInFrames` and repeated across the frame, so
 * it is identical at the loop point and never touches Math.random.
 */
export const GrainPass: React.FC<{cfg: VariantConfig}> = ({cfg}) => {
	const frame = useCurrentFrame() % cfg.timing.durationInFrames;
	const surfaces = useSurfaces();

	const {noiseCanvas, tile} = useMemo(() => {
		const size = cfg.finish.grainTile;
		const cell = cfg.finish.grainCell;
		const noise = document.createElement('canvas');
		noise.width = size;
		noise.height = size;
		const scaled = document.createElement('canvas');
		scaled.width = size * cell;
		scaled.height = size * cell;
		return {noiseCanvas: noise, tile: scaled};
	}, [cfg.finish.grainTile, cfg.finish.grainCell]);

	useLayoutEffect(() => {
		const {ctx, width, height} = surfaces;
		const size = cfg.finish.grainTile;

		// Vignette.
		ctx.save();
		ctx.globalCompositeOperation = 'source-over';
		const radius = Math.hypot(width, height) / 2;
		const vignette = ctx.createRadialGradient(
			width / 2,
			height / 2,
			radius * 0.35,
			width / 2,
			height / 2,
			radius,
		);
		vignette.addColorStop(0, `rgba(0, 0, 0, 0)`);
		vignette.addColorStop(1, `rgba(0, 0, 0, ${cfg.finish.vignette})`);
		ctx.fillStyle = vignette;
		ctx.fillRect(0, 0, width, height);
		ctx.restore();

		// Grain.
		const noiseCtx = noiseCanvas.getContext('2d') as CanvasRenderingContext2D;
		const image = noiseCtx.createImageData(size, size);
		const noise = makeNoise(`grain:${frame}`);
		const data = image.data;
		for (let i = 0; i < data.length; i += 4) {
			// Squared distribution: mostly dark specks with occasional bright ones,
			// so the additive pass sparkles without lifting the blacks to grey.
			const n = noise();
			const value = Math.floor(n * n * 256);
			data[i] = value;
			data[i + 1] = value;
			data[i + 2] = value;
			data[i + 3] = 255;
		}
		noiseCtx.putImageData(image, 0, 0);

		// Blow the noise up with nearest-neighbour sampling so one cell covers a
		// whole block of canvas pixels.
		const tileCtx = tile.getContext('2d') as CanvasRenderingContext2D;
		tileCtx.imageSmoothingEnabled = false;
		tileCtx.clearRect(0, 0, tile.width, tile.height);
		tileCtx.drawImage(noiseCanvas, 0, 0, tile.width, tile.height);

		const pattern = ctx.createPattern(tile, 'repeat');
		if (pattern) {
			ctx.save();
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = cfg.finish.grainAlpha;
			ctx.fillStyle = pattern;
			ctx.fillRect(0, 0, width, height);
			ctx.restore();
		}
	});

	return null;
};
