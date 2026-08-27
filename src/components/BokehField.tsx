import React, {useLayoutEffect} from 'react';
import {useDash} from '../context';
import {mix, rgba} from '../lib/canvas';
import {bokehDiscs, COMP_H} from '../lib/layout';
import {ramp, TAU} from '../lib/motion';
import {resetScene, shouldDraw} from '../lib/scene';

/**
 * Soft out-of-focus discs drifting upward and wrapping. Lives in the far
 * buffer so it picks up the full depth-of-field blur.
 */
export const BokehField: React.FC = () => {
	const {scene, variant, frame, fontsReady} = useDash();

	useLayoutEffect(() => {
		resetScene(scene, frame);
		if (!shouldDraw(scene, 'bokeh', frame)) return;
		const ctx = scene.layers.far.ctx;
		const {palette} = variant;
		const reveal = 0.38 + ramp(frame, 0, 90) * 0.62;

		for (const d of bokehDiscs()) {
			const span = COMP_H + d.r * 2;
			const raw = (d.y0 - frame * d.speed) % span;
			const y = (raw < 0 ? raw + span : raw) - d.r;
			const x = d.x + d.sway * Math.sin((TAU * frame) / d.swayPeriod + d.phase);

			const base = d.warm
				? mix(palette.orb, palette.orbWhite, 0.55)
				: mix(palette.web, palette.orb, 0.4);
			const a = d.alpha * reveal;
			const g = ctx.createRadialGradient(x, y, 0, x, y, d.r);
			g.addColorStop(0, rgba(base, a * 0.34));
			g.addColorStop(0.62, rgba(base, a * 0.42));
			g.addColorStop(0.9, rgba(base, a * 0.95));
			g.addColorStop(1, rgba(base, 0));
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(x, y, d.r, 0, TAU);
			ctx.fill();
		}
	}, [scene, variant, frame, fontsReady]);

	return null;
};
