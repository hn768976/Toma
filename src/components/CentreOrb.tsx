import React, {useLayoutEffect} from 'react';
import {useDash} from '../context';
import {mix, rgba} from '../lib/canvas';
import {ORB, orbDots} from '../lib/layout';
import {clamp01, easeOutQuint, lerp, ramp, TAU} from '../lib/motion';
import {resetScene, shouldDraw} from '../lib/scene';

/** 95 frames divides 570 exactly, so the pulse closes on the last frame. */
const PULSE_PERIOD = 95;

/**
 * The AI orb. Dots converge inward from a wide radius between frames 40 and 82
 * to form the rim, the body fades up behind them, then the centre glyph
 * appears. The rim brightness pulses +/-10% for the rest of the shot.
 */
export const CentreOrb: React.FC = () => {
	const {scene, variant, frame, fontsReady} = useDash();

	useLayoutEffect(() => {
		resetScene(scene, frame);
		if (!shouldDraw(scene, 'orb', frame)) return;

		const ctx = scene.layers.sharp.ctx;
		const bloom = scene.layers.bloom.ctx;
		const {palette} = variant;
		const {cx, cy, r} = ORB;

		const solid = ramp(frame, 62, 92);
		const glyphA = ramp(frame, 76, 98);
		const pulse = 1 + 0.1 * Math.sin((TAU * frame) / PULSE_PERIOD);
		const breath = r * (1 + 0.006 * Math.sin((TAU * frame) / PULSE_PERIOD));

		/* ---- body ------------------------------------------------------ */
		if (solid > 0) {
			ctx.beginPath();
			ctx.arc(cx, cy, breath, 0, TAU);
			ctx.fillStyle = rgba(palette.bgDeep, 0.52 * solid);
			ctx.fill();

			const body = ctx.createRadialGradient(cx, cy, 0, cx, cy, breath);
			body.addColorStop(0, rgba(palette.orb, 0.07 * solid));
			body.addColorStop(0.55, rgba(palette.orb, 0.1 * solid));
			body.addColorStop(0.86, rgba(palette.orb, 0.2 * solid));
			body.addColorStop(1, rgba(palette.orb, 0.36 * solid));
			ctx.fillStyle = body;
			ctx.fill();

			// Inner detail rings.
			ctx.lineWidth = 2.5;
			ctx.strokeStyle = rgba(palette.orb, 0.42 * solid);
			ctx.beginPath();
			ctx.arc(cx, cy, breath * 0.93, 0, TAU);
			ctx.stroke();
			ctx.strokeStyle = rgba(palette.orb, 0.2 * solid);
			ctx.beginPath();
			ctx.arc(cx, cy, breath * 0.8, 0, TAU);
			ctx.stroke();
		}

		/* ---- rim ------------------------------------------------------- */
		if (solid > 0) {
			const halo = ctx.createRadialGradient(cx, cy, breath * 0.9, cx, cy, breath * 1.28);
			halo.addColorStop(0, rgba(palette.orb, 0.22 * solid * pulse));
			halo.addColorStop(1, rgba(palette.orb, 0));
			ctx.fillStyle = halo;
			ctx.beginPath();
			ctx.arc(cx, cy, breath * 1.28, 0, TAU);
			ctx.fill();

			ctx.lineWidth = 7 * pulse;
			ctx.strokeStyle = rgba(palette.orbWhite, 0.95 * solid);
			ctx.beginPath();
			ctx.arc(cx, cy, breath, 0, TAU);
			ctx.stroke();

			bloom.lineWidth = 10 * pulse;
			bloom.strokeStyle = rgba(palette.orb, 0.7 * solid);
			bloom.beginPath();
			bloom.arc(cx, cy, breath, 0, TAU);
			bloom.stroke();

			// Rotating tick collar plus two dashed arcs.
			const spin = frame * 0.0016;
			ctx.lineWidth = 3;
			ctx.strokeStyle = rgba(palette.orb, 0.42 * solid);
			ctx.beginPath();
			for (let i = 0; i < 84; i++) {
				const ang = spin + (i / 84) * TAU;
				const long = i % 7 === 0;
				const r0 = breath * 1.045;
				const r1 = r0 + (long ? 26 : 12);
				ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
				ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
			}
			ctx.stroke();

			ctx.lineWidth = 5;
			ctx.strokeStyle = rgba(palette.orbWhite, 0.55 * solid);
			for (let k = 0; k < 3; k++) {
				const a0 = -spin * 2.4 + (k / 3) * TAU;
				ctx.beginPath();
				ctx.arc(cx, cy, breath * 1.16, a0, a0 + 0.44);
				ctx.stroke();
			}
		}

		/* ---- assembling dots ------------------------------------------- */
		for (const d of orbDots()) {
			const p = easeOutQuint(clamp01((frame - 40 - d.delay) / 42));
			if (p <= 0) continue;
			const rr = lerp(d.startR, d.endR * (breath / r), p);
			const ang = d.angle + frame * 0.0009;
			const settled = lerp(1, 0.6, solid);
			const a = clamp01(p * 1.6) * settled;
			ctx.beginPath();
			ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, d.size, 0, TAU);
			ctx.fillStyle = rgba(d.hot ? palette.orbWhite : palette.orb, a);
			ctx.fill();
		}

		/* ---- centre glyph ---------------------------------------------- */
		if (glyphA > 0 && fontsReady) {
			ctx.textAlign = 'left';
			ctx.textBaseline = 'alphabetic';

			const base = r * variant.glyphScale;
			const gap = base * variant.glyphLineGap;

			// Measure every line first: the whole block is centred on the orb by
			// its ink box, not by its em box, so a line with no descenders is not
			// pushed off centre. For a single line this reduces to centring that
			// line's own ascent/descent on cy.
			const lines = variant.glyph.map((line) => {
				const size = Math.round(base * line.scale);
				const font = `${size}px "${variant.glyphFamily}", sans-serif`;
				ctx.font = font;
				const chars = line.text.split('');
				const track = size * (line.tracking ?? variant.glyphTracking);
				const widths = chars.map((c) => ctx.measureText(c).width);
				const width = widths.reduce((sum, v) => sum + v, 0) + track * (chars.length - 1);
				const m = ctx.measureText(line.text);
				return {
					font,
					chars,
					track,
					widths,
					width,
					asc: m.actualBoundingBoxAscent,
					desc: m.actualBoundingBoxDescent,
				};
			});

			const blockH =
				lines.reduce((sum, l) => sum + l.asc + l.desc, 0) + gap * (lines.length - 1);

			const blink =
				variant.glyphBlinkCycle === null
					? true
					: frame % variant.glyphBlinkCycle < variant.glyphBlinkCycle / 2;

			let top = cy - blockH / 2;
			lines.forEach((line, li) => {
				const baseline = top + line.asc;
				const isLastLine = li === lines.length - 1;
				ctx.font = line.font;
				bloom.font = line.font;
				let penX = cx - line.width / 2;
				line.chars.forEach((ch, i) => {
					const isCursor = isLastLine && i === line.chars.length - 1;
					const visible = variant.glyphBlinkCycle === null || !isCursor || blink;
					if (visible) {
						ctx.fillStyle = rgba(palette.orbWhite, 0.97 * glyphA);
						ctx.fillText(ch, penX, baseline);
						bloom.fillStyle = rgba(palette.orb, 0.55 * glyphA);
						bloom.fillText(ch, penX, baseline);
					}
					penX += line.widths[i] + line.track;
				});
				top += line.asc + line.desc + gap;
			});
		}
	}, [scene, variant, frame, fontsReady]);

	return null;
};
