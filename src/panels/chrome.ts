import {random} from 'remotion';
import {microText, mix, rgba, roundRect} from '../lib/canvas';
import {PanelSlot} from '../lib/layout';
import {Variant} from '../variants';

export const HEADER_H = 68;
export const PAD_X = 30;
export const PAD_Y = 24;

/** Panel border weight at 4K - thin, but thick enough to survive the dot screen. */
export const BORDER_W = 8;

export const contentBox = (panel: PanelSlot) => ({
	x: panel.x + PAD_X,
	y: panel.y + HEADER_H + PAD_Y * 0.6,
	w: panel.w - PAD_X * 2,
	h: panel.h - HEADER_H - PAD_Y * 1.6,
});

/**
 * Dark semi-transparent body, thin bright outline, a header strip with an
 * illegible title. Identical for every panel kind - only the body differs.
 */
export const drawPanelChrome = (
	ctx: CanvasRenderingContext2D,
	bloom: CanvasRenderingContext2D,
	panel: PanelSlot,
	variant: Variant,
	frame: number
) => {
	const {palette} = variant;
	const {x, y, w, h} = panel;
	const radius = 12;

	roundRect(ctx, x, y, w, h, radius);
	// The raw panel fill sits almost exactly on the backdrop's luminance, which
	// the dot screen cannot separate. A small push toward the border colour is
	// what makes a panel read as a panel once it is rebuilt out of dots.
	ctx.fillStyle = rgba(mix(palette.panelFill, palette.panelBorder, 0.04), 0.88);
	ctx.fill();

	// Faint top-down sheen so the fill is not flat.
	const sheen = ctx.createLinearGradient(x, y, x, y + h);
	sheen.addColorStop(0, rgba(palette.panelBorder, 0.11));
	sheen.addColorStop(0.4, rgba(palette.panelBorder, 0.02));
	sheen.addColorStop(1, rgba(palette.bgDeep, 0.14));
	ctx.fillStyle = sheen;
	ctx.fill();

	roundRect(ctx, x, y, w, h, radius);
	ctx.lineWidth = BORDER_W;
	ctx.strokeStyle = rgba(mix(palette.panelBorder, palette.orbWhite, 0.4), 0.96);
	ctx.stroke();

	// Bright corner ticks.
	const tick = 44;
	ctx.strokeStyle = rgba(palette.orbWhite, 0.75);
	ctx.lineWidth = BORDER_W + 3;
	const corners: [number, number, number, number][] = [
		[x, y + tick, x, y],
		[x, y, x + tick, y],
		[x + w - tick, y, x + w, y],
		[x + w, y, x + w, y + tick],
		[x, y + h - tick, x, y + h],
		[x, y + h, x + tick, y + h],
		[x + w - tick, y + h, x + w, y + h],
		[x + w, y + h, x + w, y + h - tick],
	];
	ctx.beginPath();
	for (const [ax, ay, bx, by] of corners) {
		ctx.moveTo(ax, ay);
		ctx.lineTo(bx, by);
	}
	ctx.stroke();

	// Header: illegible title + status pips + divider.
	microText(ctx, x + PAD_X, y + HEADER_H / 2 - 12, w * 0.42, 24, `${panel.id}-title`, random, rgba(palette.textPale, 0.72));
	for (let i = 0; i < 3; i++) {
		const on = random(`${panel.id}-pip${i}#${Math.floor(frame / 40) + i}`) > 0.4;
		ctx.beginPath();
		ctx.arc(x + w - PAD_X - i * 38, y + HEADER_H / 2, 10, 0, Math.PI * 2);
		ctx.fillStyle = rgba(on ? palette.orb : palette.panelBorder, on ? 0.9 : 0.28);
		ctx.fill();
	}
	ctx.beginPath();
	ctx.moveTo(x + 1, y + HEADER_H);
	ctx.lineTo(x + w - 1, y + HEADER_H);
	ctx.lineWidth = 4;
	ctx.strokeStyle = rgba(palette.panelBorder, 0.6);
	ctx.stroke();

	// Everything bright about the chrome goes into the bloom buffer too.
	roundRect(bloom, x, y, w, h, radius);
	bloom.lineWidth = BORDER_W;
	bloom.strokeStyle = rgba(palette.panelBorder, 0.55);
	bloom.stroke();
};
