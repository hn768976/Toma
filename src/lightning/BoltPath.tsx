import React, {useLayoutEffect} from 'react';
import type {BoltConfig, Palette} from '../variants';
import {strokeTapered, type PassParts} from './draw';
import type {Bolt} from './geometry';
import {paintGlow, useSurfaces} from './surface';

/**
 * Draws one generated channel in four passes, compositing additively:
 *
 *   1. wide atmospheric glow — very wide, very low alpha, shadowBlur 90
 *   2. outer glow           — medium width, low alpha, shadowBlur 40
 *   3. mid channel          — the palette's channel colour, shadowBlur 14
 *   4. hot core             — a thin near-white stroke, no blur
 *
 * Every blurred halo — passes 1 and 2, the mid channel's own glow, and the
 * core's bloom — is laid down on the quarter-size glow surface and composited
 * up; a halo carries no width detail, and blurring at quarter size costs a
 * sixteenth as much. The crisp mid channel and the core are then drawn at full
 * resolution so the core stays a hairline. The thin white core inside the wide
 * soft glow is the whole effect — a single thick semi-transparent stroke reads
 * flat.
 */
const GLOW: PassParts = {halo: true, sharp: true};
const HALO: PassParts = {halo: true, sharp: false};
const SHARP: PassParts = {halo: false, sharp: true};

export const BoltPath: React.FC<{
	bolt: Bolt;
	cfg: BoltConfig;
	palette: Palette;
	/** 0..1 brightness of this return stroke. */
	amount: number;
}> = ({bolt, cfg, palette, amount}) => {
	const surfaces = useSurfaces();

	useLayoutEffect(() => {
		if (amount <= 0) {
			return;
		}
		const gain = amount * cfg.peakBrightness;
		const bands = cfg.taperBands;

		// Passes 1 and 2, plus the core bloom, on the glow surface.
		paintGlow(surfaces, (ctx, scale) => {
			bolt.strokes.forEach((stroke) => {
				strokeTapered(
					ctx,
					stroke,
					{
						color: palette.glowWide,
						alpha: cfg.alpha.wide * gain * stroke.brightness,
						width: cfg.width.wide * stroke.width,
						tipWidth: cfg.tipWidth,
						blur: cfg.blur.wide,
					},
					bands,
					scale,
					GLOW,
				);
				strokeTapered(
					ctx,
					stroke,
					{
						color: palette.glowOuter,
						alpha: cfg.alpha.outer * gain * stroke.brightness,
						width: cfg.width.outer * stroke.width,
						tipWidth: cfg.tipWidth,
						blur: cfg.blur.outer,
					},
					bands,
					scale,
					GLOW,
				);
				// The mid channel's halo; its crisp stroke is drawn at full size below.
				strokeTapered(
					ctx,
					stroke,
					{
						color: palette.channel,
						alpha: cfg.alpha.channel * gain * stroke.brightness,
						width: cfg.width.channel * stroke.width,
						tipWidth: cfg.tipWidth,
						blur: cfg.blur.channel,
					},
					bands,
					scale,
					HALO,
				);
				// Generous bloom on the core.
				strokeTapered(
					ctx,
					stroke,
					{
						color: palette.core,
						alpha: cfg.bloom.alpha * gain * stroke.brightness,
						width: cfg.bloom.width * stroke.width,
						tipWidth: cfg.tipWidth,
						blur: cfg.bloom.blur,
					},
					bands,
					scale,
					HALO,
				);
			});
		});

		// The crisp mid channel and the hot core, at full resolution.
		const {ctx} = surfaces;
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		bolt.strokes.forEach((stroke) => {
			strokeTapered(
				ctx,
				stroke,
				{
					color: palette.channel,
					alpha: cfg.alpha.channel * gain * stroke.brightness,
					width: cfg.width.channel * stroke.width,
					tipWidth: cfg.tipWidth,
					blur: cfg.blur.channel,
				},
				bands,
				1,
				SHARP,
			);
			strokeTapered(
				ctx,
				stroke,
				{
					color: palette.core,
					alpha: cfg.alpha.core * gain * stroke.brightness,
					width: cfg.width.core * stroke.width,
					tipWidth: cfg.tipWidth,
					blur: cfg.blur.core,
				},
				bands,
				1,
				SHARP,
			);
		});
		ctx.restore();
	});

	return null;
};
