import React, {useLayoutEffect} from 'react';
import type {Config} from './config';
import type {Flash} from './animation';
import {driftOffsetAtFrame, spotIntensity} from './animation';
import type {SpotField} from './spots';

type Props = {
	readonly canvasRef: React.RefObject<HTMLCanvasElement | null>;
	readonly field: SpotField;
	readonly sprites: readonly HTMLCanvasElement[];
	readonly flashes: Map<number, Flash[]>;
	readonly frame: number;
	readonly config: Config;
	readonly margin: number;
	/** 1 for a full-resolution buffer, <1 while the frame is heavily defocused. */
	readonly scale: number;
	readonly bufferWidth: number;
	readonly bufferHeight: number;
};

/**
 * Draws the spot field, sharp and at full brightness, into an offscreen buffer.
 * Nothing here knows about focus — the blur is a single filtered composite done
 * once by <FocusPass>, never per spot.
 *
 * The buffer is larger than the frame on every side so that off-screen spots
 * still bleed into the edges once they are blurred. When the frame is heavily
 * defocused the field is drawn into the top-left corner of the same buffer at
 * half scale; at 64px of blur the lost detail is invisible and the filter costs
 * a quarter as much.
 */
export const SpotGrid: React.FC<Props> = ({
	canvasRef,
	field,
	sprites,
	flashes,
	frame,
	config,
	margin,
	scale,
	bufferWidth,
	bufferHeight,
}) => {
	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) {
			return;
		}

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.filter = 'none';
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const drift = driftOffsetAtFrame(frame, config);
		ctx.scale(scale, scale);
		// Overlapping spots have to add rather than occlude: that additive bleed
		// between neighbours is what makes the soft passages read as light.
		ctx.globalCompositeOperation = 'lighter';
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';

		for (let i = 0; i < field.spots.length; i++) {
			const spot = field.spots[i];
			const intensity = spotIntensity(spot, frame, config, flashes.get(i));
			if (intensity <= 0.002) {
				continue;
			}
			const sprite = sprites[spot.colorIndex];
			if (!sprite) {
				continue;
			}
			const x = spot.x + drift.x + margin;
			const y = spot.y + drift.y + margin;
			const diameter = spot.radius * 2;
			ctx.globalAlpha = intensity;
			ctx.drawImage(sprite, x - spot.radius, y - spot.radius, diameter, diameter);
		}

		ctx.globalAlpha = 1;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = 'source-over';
	});

	return (
		<canvas
			ref={canvasRef}
			width={bufferWidth}
			height={bufferHeight}
			style={{display: 'none'}}
		/>
	);
};
