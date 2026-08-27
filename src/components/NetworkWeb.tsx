import React, {useLayoutEffect} from 'react';
import {random} from 'remotion';
import {useDash} from '../context';
import {mix, rgba} from '../lib/canvas';
import {webNodes} from '../lib/layout';
import {clamp01, ramp, TAU} from '../lib/motion';
import {resetScene, shouldDraw} from '../lib/scene';

const LINK_DIST = 500;

/**
 * Scattered nodes drifting on closed elliptical paths, with the links
 * recomputed from the drifted positions on every frame. The magenta accent is
 * used here and nowhere else.
 */
export const NetworkWeb: React.FC = () => {
	const {scene, variant, frame, fontsReady} = useDash();

	useLayoutEffect(() => {
		resetScene(scene, frame);
		if (!shouldDraw(scene, 'web', frame)) return;
		// Split across two buffers: the deepest third of the nodes take the full
		// 24px defocus, the rest sit in the midground so the web still reads as
		// structure rather than being blurred away to nothing.
		const far = scene.layers.far.ctx;
		const midground = scene.layers.mid.ctx;
		const {palette} = variant;
		// The raw web colour sits close enough to the backdrop that the dot
		// screen cannot separate them once the defocus blur has spread it. Push
		// it toward the orb hue so the links survive both.
		const lineColor = mix(palette.web, palette.orb, 0.62);
		const nodeColor = mix(palette.web, palette.orbWhite, 0.5);
		const nodes = webNodes();
		const global = 0.34 + ramp(frame, 0, 70) * 0.76;

		const pos = nodes.map((n) => {
			const t = (TAU * frame) / n.period + n.phase;
			return {
				x: n.x0 + n.ax * Math.sin(t),
				y: n.y0 + n.ay * Math.cos(t),
				vis: clamp01((frame - n.appear) / 22),
			};
		});

		// Links, recomputed each frame from the drifted positions.
		for (let i = 0; i < pos.length; i++) {
			for (let j = i + 1; j < pos.length; j++) {
				const dx = pos[i].x - pos[j].x;
				const dy = pos[i].y - pos[j].y;
				const d = Math.hypot(dx, dy);
				if (d > LINK_DIST) continue;
				const near = 1 - d / LINK_DIST;
				const accent = random(`link-${i}-${j}`) > 0.915;
				const a = Math.min(1, Math.pow(near, 1.35) * 1.1 * global * pos[i].vis * pos[j].vis);
				if (a < 0.01) continue;
				const ctx = nodes[i].deep && nodes[j].deep ? far : midground;
				ctx.beginPath();
				ctx.moveTo(pos[i].x, pos[i].y);
				ctx.lineTo(pos[j].x, pos[j].y);
				// A line thinner than ~1/3 of the dot pitch barely moves a cell's
				// average luminance, so the dot screen erases it. Web lines are
				// deliberately heavy for their brightness.
				ctx.lineWidth = accent ? 8 : 7;
				ctx.strokeStyle = rgba(accent ? palette.accentA : lineColor, Math.min(1, accent ? a * 1.5 : a));
				ctx.stroke();
			}
		}

		// Nodes.
		nodes.forEach((n, i) => {
			const p = pos[i];
			if (p.vis <= 0) return;
			const ctx = n.deep ? far : midground;
			const color = n.accent ? palette.accentA : nodeColor;
			ctx.beginPath();
			ctx.arc(p.x, p.y, n.size * 1.7, 0, TAU);
			ctx.fillStyle = rgba(color, Math.min(1, 1.05 * global * p.vis));
			ctx.fill();
			if (n.ringed) {
				ctx.beginPath();
				ctx.arc(p.x, p.y, n.size * 4.6, 0, TAU);
				ctx.lineWidth = 5;
				ctx.strokeStyle = rgba(color, Math.min(1, 0.55 * global * p.vis));
				ctx.stroke();
			}
		});
	}, [scene, variant, frame, fontsReady]);

	return null;
};
