import {rgba, mix} from '../lib/canvas';
import {clamp01, springTo, stepped, TAU} from '../lib/motion';
import {PanelDrawArgs} from './types';

/**
 * "gauges" panel bodies for the amber variant.
 *
 * Circular forms replace the rectangular panel cluster entirely: one large arc
 * gauge with a needle and tick scale, two smaller rings flanking it and a
 * semicircular level meter beneath. Where the chart variant updates and the
 * terminal variant scrolls, this one sweeps - needles spring to new targets
 * every 60-90 frames and the rings and meter fill and drain continuously.
 */

/** Classic gauge opening: 135deg round to 45deg, a 270deg sweep. */
const ARC_START = Math.PI * 0.75;
const ARC_SWEEP = Math.PI * 1.5;

const readout = (
	a: PanelDrawArgs,
	cx: number,
	cy: number,
	size: number,
	value: string,
	sub: string
) => {
	const {ctx, bloom, variant} = a;
	const {palette} = variant;
	ctx.font = `${size}px "${variant.glyphFamily}", sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = rgba(palette.accentB, 0.97);
	ctx.fillText(value, cx, cy);
	bloom.font = ctx.font;
	bloom.textAlign = 'center';
	bloom.fillStyle = rgba(palette.orb, 0.5);
	bloom.fillText(value, cx, cy);

	ctx.font = `${size * 0.34}px "${variant.glyphFamily}", sans-serif`;
	ctx.fillStyle = rgba(palette.textPale, 0.66);
	ctx.fillText(sub, cx, cy + size * 0.46);
	ctx.textAlign = 'left';
	bloom.textAlign = 'left';
};

const arcGauge = (a: PanelDrawArgs) => {
	const {ctx, bloom, x, y, w, h, variant, frame, panel} = a;
	const {palette} = variant;
	const cx = x + w / 2;
	const cy = y + h / 2;
	const R = Math.min(w, h) / 2;

	// Needle target resets every 78 frames and springs into place.
	const v = clamp01(springTo(`${panel.id}-needle`, frame, 78, 0, 0.17, 0.09));
	const angle = ARC_START + ARC_SWEEP * v;

	// Track.
	ctx.lineWidth = R * 0.11;
	ctx.lineCap = 'butt';
	ctx.beginPath();
	ctx.arc(cx, cy, R * 0.82, ARC_START, ARC_START + ARC_SWEEP);
	ctx.strokeStyle = rgba(palette.accentA, 0.62);
	ctx.stroke();

	// Value arc.
	ctx.beginPath();
	ctx.arc(cx, cy, R * 0.82, ARC_START, angle);
	const grad = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
	grad.addColorStop(0, rgba(palette.panelBorder, 0.95));
	grad.addColorStop(1, rgba(palette.orb, 0.98));
	ctx.strokeStyle = grad;
	ctx.stroke();
	bloom.lineWidth = R * 0.11;
	bloom.lineCap = 'butt';
	bloom.beginPath();
	bloom.arc(cx, cy, R * 0.82, ARC_START, angle);
	bloom.strokeStyle = rgba(palette.orb, 0.5);
	bloom.stroke();
	ctx.lineCap = 'round';
	bloom.lineCap = 'round';

	// Tick scale.
	const majors = 10;
	const ticks = majors * 5;
	for (let i = 0; i <= ticks; i++) {
		const t = i / ticks;
		const ang = ARC_START + ARC_SWEEP * t;
		const major = i % 5 === 0;
		const r0 = R * 0.9;
		const r1 = r0 + (major ? R * 0.09 : R * 0.045);
		ctx.beginPath();
		ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
		ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
		ctx.lineWidth = major ? 7 : 3.5;
		ctx.strokeStyle = rgba(major ? palette.textPale : palette.accentA, major ? 0.9 : 0.6);
		ctx.stroke();

		if (major) {
			const lr = r1 + R * 0.075;
			ctx.font = `${Math.round(R * 0.075)}px "${variant.glyphFamily}", sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = rgba(palette.textPale, 0.78);
			ctx.fillText(String(i * 2), cx + Math.cos(ang) * lr, cy + Math.sin(ang) * lr);
			ctx.textAlign = 'left';
			ctx.textBaseline = 'alphabetic';
		}
	}

	// Inner detail rings.
	ctx.lineWidth = 3;
	ctx.strokeStyle = rgba(palette.accentA, 0.55);
	ctx.beginPath();
	ctx.arc(cx, cy, R * 0.62, 0, TAU);
	ctx.stroke();
	ctx.strokeStyle = rgba(palette.accentA, 0.3);
	ctx.beginPath();
	ctx.arc(cx, cy, R * 0.5, 0, TAU);
	ctx.stroke();

	// Needle: a tapered blade with a hub.
	const tip = R * 0.72;
	const tail = R * 0.14;
	const halfW = R * 0.035;
	const nx = Math.cos(angle);
	const ny = Math.sin(angle);
	const px = -ny;
	const py = nx;
	ctx.beginPath();
	ctx.moveTo(cx + nx * tip, cy + ny * tip);
	ctx.lineTo(cx + px * halfW - nx * tail, cy + py * halfW - ny * tail);
	ctx.lineTo(cx - px * halfW - nx * tail, cy - py * halfW - ny * tail);
	ctx.closePath();
	ctx.fillStyle = rgba(palette.orbWhite, 0.97);
	ctx.fill();
	bloom.fillStyle = rgba(palette.orb, 0.55);
	bloom.fill();

	ctx.beginPath();
	ctx.arc(cx, cy, R * 0.075, 0, TAU);
	ctx.fillStyle = rgba(palette.orb, 1);
	ctx.fill();
	ctx.lineWidth = 5;
	ctx.strokeStyle = rgba(palette.orbWhite, 0.9);
	ctx.stroke();

	readout(a, cx, cy + R * 0.42, R * 0.2, (v * 20).toFixed(1), 'PRIMARY LOAD');
};

const ringGauge = (a: PanelDrawArgs, period: number, phase: number) => {
	const {ctx, bloom, x, y, w, h, variant, frame, panel} = a;
	const {palette} = variant;
	const cx = x + w / 2;
	const cy = y + h / 2;
	const R = Math.min(w, h) / 2;

	// Fills and drains on a period that divides the 570-frame duration.
	const v = 0.5 - 0.5 * Math.cos((TAU * frame) / period + phase);

	ctx.lineWidth = R * 0.2;
	ctx.lineCap = 'butt';
	ctx.beginPath();
	ctx.arc(cx, cy, R * 0.72, 0, TAU);
	ctx.strokeStyle = rgba(palette.accentA, 0.62);
	ctx.stroke();

	const start = -Math.PI / 2;
	ctx.beginPath();
	ctx.arc(cx, cy, R * 0.72, start, start + TAU * v);
	ctx.strokeStyle = rgba(palette.orb, 0.97);
	ctx.stroke();
	bloom.lineWidth = R * 0.2;
	bloom.lineCap = 'butt';
	bloom.beginPath();
	bloom.arc(cx, cy, R * 0.72, start, start + TAU * v);
	bloom.strokeStyle = rgba(palette.orb, 0.5);
	bloom.stroke();
	ctx.lineCap = 'round';
	bloom.lineCap = 'round';

	// Slowly counter-rotating tick collar.
	const spin = -frame * 0.004 + phase;
	ctx.lineWidth = 4;
	ctx.strokeStyle = rgba(palette.textPale, 0.5);
	ctx.beginPath();
	for (let i = 0; i < 36; i++) {
		const ang = spin + (i / 36) * TAU;
		const long = i % 6 === 0;
		const r0 = R * 0.9;
		const r1 = r0 + (long ? R * 0.1 : R * 0.05);
		ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
		ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
	}
	ctx.stroke();

	ctx.lineWidth = 3;
	ctx.strokeStyle = rgba(palette.accentA, 0.5);
	ctx.beginPath();
	ctx.arc(cx, cy, R * 0.5, 0, TAU);
	ctx.stroke();

	// Big value inside the ring, small readout under it.
	ctx.font = `${Math.round(R * 0.46)}px "${variant.glyphFamily}", sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = rgba(palette.accentB, 0.97);
	ctx.fillText(String(Math.round(v * 100)), cx, cy);
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';

	const trim = stepped(`${panel.id}-sub`, frame, 66, 23, 16);
	readout(
		a,
		cx,
		cy + R * 1.3,
		R * 0.26,
		(trim * 4 + 0.4).toFixed(2),
		panel.id === 'gL' ? 'FLUX' : 'BIAS'
	);
};

const levelMeter = (a: PanelDrawArgs) => {
	const {ctx, bloom, x, y, w, h, variant, frame, panel} = a;
	const {palette} = variant;
	const cx = x + w / 2;
	const cy = y + h;
	const R = w / 2;

	// Oscillates on its own period, offset from the rings.
	const v =
		0.5 -
		0.42 * Math.cos((TAU * frame) / 114) -
		0.08 * Math.cos((TAU * frame) / 38 + 1.1);
	const level = clamp01(v);

	const segs = 34;
	const gap = 0.008;
	const segSpan = Math.PI / segs;
	for (let i = 0; i < segs; i++) {
		const t = i / (segs - 1);
		const a0 = Math.PI + i * segSpan + gap;
		const a1 = a0 + segSpan - gap * 2;
		const on = t <= level;
		ctx.lineWidth = R * 0.16;
		ctx.lineCap = 'butt';
		ctx.beginPath();
		ctx.arc(cx, cy, R * 0.78, a0, a1);
		ctx.strokeStyle = on
			? rgba(t > 0.82 ? palette.orbWhite : mix(palette.panelBorder, palette.orb, t), 0.97)
			: rgba(palette.accentA, 0.5);
		ctx.stroke();
		if (on) {
			bloom.lineWidth = R * 0.16;
			bloom.lineCap = 'butt';
			bloom.beginPath();
			bloom.arc(cx, cy, R * 0.78, a0, a1);
			bloom.strokeStyle = rgba(palette.orb, 0.4);
			bloom.stroke();
		}
	}
	ctx.lineCap = 'round';
	bloom.lineCap = 'round';

	// Marker riding the level.
	const mAng = Math.PI + Math.PI * level;
	ctx.beginPath();
	ctx.moveTo(cx + Math.cos(mAng) * R * 0.6, cy + Math.sin(mAng) * R * 0.6);
	ctx.lineTo(cx + Math.cos(mAng) * R * 0.94, cy + Math.sin(mAng) * R * 0.94);
	ctx.lineWidth = 8;
	ctx.strokeStyle = rgba(palette.orbWhite, 0.95);
	ctx.stroke();

	ctx.lineWidth = 4;
	ctx.strokeStyle = rgba(palette.accentA, 0.6);
	ctx.beginPath();
	ctx.arc(cx, cy, R * 0.52, Math.PI, TAU);
	ctx.stroke();

	// Baseline plus a secondary trim value.
	ctx.beginPath();
	ctx.moveTo(cx - R, cy);
	ctx.lineTo(cx + R, cy);
	ctx.lineWidth = 5;
	ctx.strokeStyle = rgba(palette.panelBorder, 0.7);
	ctx.stroke();

	const trim = stepped(`${panel.id}-trim`, frame, 84, 17, 20);
	readout(a, cx, cy - R * 0.2, R * 0.24, `${Math.round(level * 100)}.${Math.round(trim * 9)}`, 'BUFFER LEVEL');
};

export const drawGaugesPanel = (a: PanelDrawArgs) => {
	switch (a.panel.role) {
		case 'arc':
			return arcGauge(a);
		case 'ringL':
			// 190 and 114 both divide 570, so both rings close on the last frame.
			return ringGauge(a, 190, 0);
		case 'ringR':
			return ringGauge(a, 114, Math.PI * 0.7);
		case 'level':
			return levelMeter(a);
		default:
			return undefined;
	}
};
