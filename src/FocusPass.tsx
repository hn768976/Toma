import React, {useLayoutEffect} from 'react';
import type {Config} from './config';
import type {Theme} from './theme';
import {hexToRgb, rgba} from './colors';

type Props = {
	readonly canvasRef: React.RefObject<HTMLCanvasElement | null>;
	readonly sourceRef: React.RefObject<HTMLCanvasElement | null>;
	readonly bloomRef: React.RefObject<HTMLCanvasElement | null>;
	readonly config: Config;
	readonly theme: Theme;
	readonly blurPx: number;
	readonly exposureGain: number;
	readonly margin: number;
	readonly scale: number;
	readonly bufferWidth: number;
	readonly bufferHeight: number;
	readonly width: number;
	readonly height: number;
};

/**
 * The subject of the piece. One filtered composite of the whole spot buffer —
 * the blur is never applied per spot — plus the finishing passes that have to
 * survive the defocus: bloom on the highlights and the vignette, both applied
 * after the blur so they are not smeared away in the soft sections.
 */
export const FocusPass: React.FC<Props> = ({
	canvasRef,
	sourceRef,
	bloomRef,
	config,
	theme,
	blurPx,
	exposureGain,
	margin,
	scale,
	bufferWidth,
	bufferHeight,
	width,
	height,
}) => {
	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		const source = sourceRef.current;
		if (!canvas || !ctx || !source) {
			return;
		}

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.filter = 'none';
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
		ctx.fillStyle = theme.background;
		ctx.fillRect(0, 0, width, height);

		// Blur and exposure compensation ride in the same filter chain, so the
		// gain is applied before the composite clips rather than after.
		ctx.globalCompositeOperation = 'lighter';
		ctx.filter = `blur(${blurPx}px) brightness(${exposureGain})`;
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(
			source,
			0,
			0,
			bufferWidth * scale,
			bufferHeight * scale,
			-margin,
			-margin,
			bufferWidth,
			bufferHeight,
		);
		ctx.filter = 'none';
		ctx.globalCompositeOperation = 'source-over';

		const bloom = bloomRef.current;
		const bloomCtx = bloom?.getContext('2d');
		if (config.bloom.enabled && bloom && bloomCtx) {
			bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
			bloomCtx.filter = 'none';
			bloomCtx.globalAlpha = 1;
			bloomCtx.globalCompositeOperation = 'copy';
			bloomCtx.imageSmoothingEnabled = true;
			bloomCtx.imageSmoothingQuality = 'high';
			bloomCtx.drawImage(canvas, 0, 0, bloom.width, bloom.height);
			// Multiplying the buffer by itself squares it, which crushes the
			// mid-tones and leaves only the brightest spots to glow.
			bloomCtx.globalCompositeOperation = 'multiply';
			for (let pass = 0; pass < config.bloom.gammaPasses; pass++) {
				bloomCtx.drawImage(bloom, 0, 0, bloom.width, bloom.height);
			}
			bloomCtx.globalCompositeOperation = 'source-over';

			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = config.bloom.alpha;
			ctx.filter = `blur(${config.bloom.blurPx}px)`;
			ctx.drawImage(bloom, 0, 0, bloom.width, bloom.height, 0, 0, width, height);
			ctx.filter = 'none';
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = 'source-over';
		}

		const vignette = hexToRgb(theme.vignette);
		const gradient = ctx.createRadialGradient(
			width / 2,
			height / 2,
			0,
			width / 2,
			height / 2,
			Math.hypot(width, height) / 2,
		);
		gradient.addColorStop(0, rgba(vignette, 0));
		gradient.addColorStop(config.vignette.innerStop, rgba(vignette, 0));
		gradient.addColorStop(0.72, rgba(vignette, config.vignette.strength * 0.28));
		gradient.addColorStop(1, rgba(vignette, config.vignette.strength));
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);
	});

	return (
		<>
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
				}}
			/>
			<canvas
				ref={bloomRef}
				width={Math.round(width * config.bloom.downscale)}
				height={Math.round(height * config.bloom.downscale)}
				style={{display: 'none'}}
			/>
		</>
	);
};
