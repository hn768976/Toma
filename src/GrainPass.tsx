import React, {useLayoutEffect, useMemo} from 'react';
import {random} from 'remotion';
import type {Config} from './config';
import type {Theme} from './theme';
import {hexToRgb} from './colors';
import {wrapFrame} from './animation';

type Props = {
	readonly config: Config;
	readonly theme: Theme;
	readonly frame: number;
	readonly width: number;
	readonly height: number;
};

/** Small deterministic PRNG, seeded from Remotion's random() so a tile of
 * 65k pixels does not cost 65k string hashes. */
const mulberry32 = (seed: number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const buildGrainTiles = (config: Config, theme: Theme): HTMLCanvasElement[] => {
	const size = config.grain.tileSizePx;
	const shadow = hexToRgb(theme.grainShadow);
	const highlight = hexToRgb(theme.grainHighlight);

	return new Array(config.grain.tileCount).fill(null).map((_, index) => {
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			return canvas;
		}
		const rng = mulberry32(Math.floor(random(`grain-tile-${index}`) * 0xffffffff));
		const image = ctx.createImageData(size, size);
		const data = image.data;
		for (let i = 0; i < data.length; i += 4) {
			// Biased dark so the near-black background keeps its density.
			const level = Math.pow(rng(), config.grain.bias);
			data[i] = shadow.r + (highlight.r - shadow.r) * level;
			data[i + 1] = shadow.g + (highlight.g - shadow.g) * level;
			data[i + 2] = shadow.b + (highlight.b - shadow.b) * level;
			data[i + 3] = 255;
		}
		ctx.putImageData(image, 0, 0);
		return canvas;
	});
};

/**
 * Fine sensor grain, on its own layer above everything else. Real sensor noise
 * does not blur with the image, so the grain is identical in amplitude whether
 * the frame is sharp or fully defocused — holding it steady while the subject
 * softens is a quiet cue that this is a focus change, not a dissolve.
 */
export const GrainPass: React.FC<Props> = ({config, theme, frame, width, height}) => {
	const canvasRef = React.useRef<HTMLCanvasElement>(null);
	const tiles = useMemo(() => buildGrainTiles(config, theme), [config, theme]);

	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx || tiles.length === 0) {
			return;
		}
		const f = wrapFrame(frame, config.timeline.durationInFrames);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.filter = 'none';
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
		ctx.clearRect(0, 0, width, height);

		const tile = tiles[f % tiles.length];
		const pattern = ctx.createPattern(tile, 'repeat');
		if (!pattern) {
			return;
		}
		const size = config.grain.tileSizePx;
		const offsetX = Math.floor(random(`grain-x-${f}`) * size);
		const offsetY = Math.floor(random(`grain-y-${f}`) * size);
		ctx.globalAlpha = config.grain.alpha;
		ctx.translate(offsetX, offsetY);
		ctx.fillStyle = pattern;
		ctx.fillRect(-offsetX, -offsetY, width, height);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = 1;
	});

	return (
		<canvas
			ref={canvasRef}
			width={width}
			height={height}
			style={{
				position: 'absolute',
				inset: 0,
				width: '100%',
				height: '100%',
				display: 'block',
				pointerEvents: 'none',
			}}
		/>
	);
};
