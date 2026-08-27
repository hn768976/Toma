import {random} from 'remotion';
import {microText, rgba} from '../lib/canvas';
import {stepped, steppedInt, TAU} from '../lib/motion';
import {worldMapCells} from '../lib/worldmap';
import {PanelDrawArgs} from './types';

/**
 * "charts" panel bodies for the blue variant.
 *
 * Everything here is texture, not data: bars, rings and rows carry seeded
 * values that reroll on their own schedules so the dashboard reads as live
 * without anything being legible.
 */

const dotGrid = (a: PanelDrawArgs) => {
	const {ctx, x, y, w, h, variant, frame, panel} = a;
	// Land cells are drawn nearly solid rather than as a sparse dot grid: a
	// feature the size of the halftone pitch is destroyed by the dot screen, so
	// the continents have to be near-solid masses for the screen to rebuild
	// them cleanly. The dot structure the viewer sees is the halftone's own.
	const pitch = 20;
	const cols = Math.floor(w / pitch);
	const rows = Math.floor(h / pitch);
	const cells = worldMapCells(cols, rows);
	const ox = x + (w - cols * pitch) / 2 + pitch / 2;
	const oy = y + (h - rows * pitch) / 2 + pitch / 2;

	// Faint ocean grid.
	ctx.fillStyle = rgba(variant.palette.panelBorder, 0.2);
	ctx.beginPath();
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			ctx.moveTo(ox + c * pitch + 2.6, oy + r * pitch);
			ctx.arc(ox + c * pitch, oy + r * pitch, 2.6, 0, TAU);
		}
	}
	ctx.fill();

	// Land.
	ctx.fillStyle = rgba(variant.palette.textPale, 0.92);
	ctx.beginPath();
	for (const cell of cells) {
		const cx = ox + cell.col * pitch;
		const cy = oy + cell.row * pitch;
		ctx.moveTo(cx + 8.2, cy);
		ctx.arc(cx, cy, 8.2, 0, TAU);
	}
	ctx.fill();

	// A handful of pulsing hot spots with expanding rings.
	for (let i = 0; i < 5; i++) {
		const cell = cells[Math.floor(random(`${panel.id}-hot${i}`) * cells.length)];
		if (!cell) continue;
		const cx = ox + cell.col * pitch;
		const cy = oy + cell.row * pitch;
		const t = ((frame + i * 37) % 90) / 90;
		ctx.beginPath();
		ctx.arc(cx, cy, 4 + t * 34, 0, TAU);
		ctx.lineWidth = 5;
		ctx.strokeStyle = rgba(variant.palette.accentB, 0.6 * (1 - t));
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(cx, cy, 8, 0, TAU);
		ctx.fillStyle = rgba(variant.palette.accentB, 0.95);
		ctx.fill();
	}

	// Slow sweep.
	const sweep = x + ((frame * 3.2) % (w + 200)) - 100;
	const grad = ctx.createLinearGradient(sweep - 90, 0, sweep + 90, 0);
	grad.addColorStop(0, rgba(variant.palette.orb, 0));
	grad.addColorStop(0.5, rgba(variant.palette.orb, 0.14));
	grad.addColorStop(1, rgba(variant.palette.orb, 0));
	ctx.fillStyle = grad;
	ctx.fillRect(x, y, w, h);
};

const bars = (a: PanelDrawArgs) => {
	const {ctx, bloom, x, y, w, h, variant, frame, panel} = a;
	const {palette} = variant;

	// Large value readout.
	const readoutH = 92;
	const digits = 4;
	let value = '';
	for (let i = 0; i < digits; i++) {
		value += String(steppedInt(`${panel.id}-d${i}`, frame, 130 + i * 47, i * 61, 10));
	}
	ctx.font = `${readoutH}px "${variant.glyphFamily}", sans-serif`;
	ctx.textBaseline = 'alphabetic';
	ctx.textAlign = 'left';
	ctx.fillStyle = rgba(palette.orbWhite, 0.94);
	ctx.fillText(`${value.slice(0, 2)}.${value.slice(2)}`, x, y + readoutH * 0.78);
	bloom.font = ctx.font;
	bloom.fillStyle = rgba(palette.orb, 0.5);
	bloom.fillText(`${value.slice(0, 2)}.${value.slice(2)}`, x, y + readoutH * 0.78);

	const labelW = w * 0.4;
	microText(ctx, x + w - labelW, y + readoutH * 0.34, labelW, 22, `${panel.id}-unit`, random, rgba(palette.textPale, 0.6));
	microText(ctx, x, y + readoutH * 0.95, w * 0.5, 22, `${panel.id}-sub`, random, rgba(palette.textPale, 0.45));

	// Bar chart.
	const top = y + readoutH * 1.35;
	const bh = h - (top - y);
	const count = 15;
	const gap = 10;
	const bw = (w - gap * (count - 1)) / count;
	const hotIndex = steppedInt(`${panel.id}-hot`, frame, 210, 0, count);
	for (let i = 0; i < count; i++) {
		const v = 0.16 + stepped(`${panel.id}-bar${i}`, frame, 300 + i * 19, i * 41) * 0.84;
		const bx = x + i * (bw + gap);
		const bhh = bh * v;
		const by = top + bh - bhh;
		const hot = i === hotIndex;
		const grad = ctx.createLinearGradient(0, by, 0, top + bh);
		grad.addColorStop(0, rgba(hot ? palette.accentB : palette.orb, 0.95));
		grad.addColorStop(1, rgba(hot ? palette.accentB : palette.orb, 0.22));
		ctx.fillStyle = grad;
		ctx.fillRect(bx, by, bw, bhh);
		ctx.fillStyle = rgba(hot ? palette.accentB : palette.orbWhite, 0.95);
		ctx.fillRect(bx, by, bw, 8);
	}
	ctx.strokeStyle = rgba(palette.panelBorder, 0.4);
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.moveTo(x, top + bh + 4);
	ctx.lineTo(x + w, top + bh + 4);
	ctx.stroke();
};

const ringGauge = (a: PanelDrawArgs, rings: number) => {
	const {ctx, bloom, x, y, w, h, variant, frame, panel} = a;
	const {palette} = variant;
	const cx = x + w / 2;
	const cy = y + h * 0.44;
	const outer = Math.min(w, h * 0.9) / 2;

	for (let k = 0; k < rings; k++) {
		const r = outer * (1 - k * 0.3);
		const v = 0.15 + stepped(`${panel.id}-ring${k}`, frame, 240 + k * 73, k * 88, 22) * 0.8;
		const width = outer * 0.13;
		ctx.lineWidth = width;
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, TAU);
		ctx.strokeStyle = rgba(palette.panelBorder, 0.3);
		ctx.stroke();

		const start = -Math.PI / 2 + k * 0.6;
		ctx.beginPath();
		ctx.arc(cx, cy, r, start, start + TAU * v);
		ctx.strokeStyle = rgba(k === 0 ? palette.orb : palette.accentB, 0.92);
		ctx.stroke();

		bloom.lineWidth = width;
		bloom.beginPath();
		bloom.arc(cx, cy, r, start, start + TAU * v);
		bloom.strokeStyle = rgba(k === 0 ? palette.orb : palette.accentB, 0.4);
		bloom.stroke();
	}

	// Rotating tick scale.
	const spin = (frame * 0.0035) % TAU;
	ctx.lineWidth = 5;
	ctx.strokeStyle = rgba(palette.textPale, 0.5);
	ctx.beginPath();
	for (let i = 0; i < 48; i++) {
		const ang = spin + (i / 48) * TAU;
		const long = i % 6 === 0;
		const r0 = outer * 1.1;
		const r1 = r0 + (long ? 26 : 13);
		ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
		ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
	}
	ctx.stroke();

	// Centre percentage.
	const pct = 10 + Math.round(stepped(`${panel.id}-pct`, frame, 190, 33, 18) * 89);
	const size = outer * 0.52;
	ctx.font = `${size}px "${variant.glyphFamily}", sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = rgba(palette.orbWhite, 0.95);
	ctx.fillText(String(pct), cx, cy);
	ctx.textAlign = 'left';

	const rowY = y + h - 58;
	microText(ctx, x, rowY, w, 22, `${panel.id}-rowA`, random, rgba(palette.textPale, 0.55));
	microText(ctx, x, rowY + 34, w * 0.7, 22, `${panel.id}-rowB`, random, rgba(palette.textPale, 0.38));
};

const table = (a: PanelDrawArgs) => {
	const {ctx, x, y, w, h, variant, frame, panel} = a;
	const {palette} = variant;
	const rowH = 58;
	const rows = Math.floor(h / rowH);
	const colX = [0, w * 0.46, w * 0.66, w * 0.84];

	for (let r = 0; r < rows; r++) {
		const ry = y + r * rowH;
		if (r % 2 === 0) {
			ctx.fillStyle = rgba(palette.panelBorder, 0.14);
			ctx.fillRect(x, ry, w, rowH - 8);
		}
		const flagged = random(`${panel.id}-flag${r}#${Math.floor(frame / 150)}`) > 0.88;
		const tone = flagged ? palette.accentB : palette.textPale;
		microText(ctx, x + colX[0] + 12, ry + 14, w * 0.4, 24, `${panel.id}-r${r}c0`, random, rgba(tone, flagged ? 0.9 : 0.62));
		for (let c = 1; c < 4; c++) {
			const bw = 58 + stepped(`${panel.id}-r${r}c${c}`, frame, 260 + r * 13 + c * 29, r * 37 + c * 11) * 72;
			ctx.fillStyle = rgba(c === 3 ? palette.orb : tone, c === 3 ? 0.8 : 0.5);
			ctx.fillRect(x + colX[c], ry + 14, bw, 24);
		}
		ctx.fillStyle = rgba(palette.panelBorder, 0.4);
		ctx.fillRect(x, ry + rowH - 8, w, 3);
	}
};

const lineGraph = (a: PanelDrawArgs) => {
	const {ctx, bloom, x, y, w, h, variant, frame, panel} = a;
	const {palette} = variant;

	ctx.strokeStyle = rgba(palette.panelBorder, 0.26);
	ctx.lineWidth = 3;
	ctx.beginPath();
	for (let i = 0; i <= 4; i++) {
		const gy = y + (h / 4) * i;
		ctx.moveTo(x, gy);
		ctx.lineTo(x + w, gy);
	}
	for (let i = 0; i <= 8; i++) {
		const gx = x + (w / 8) * i;
		ctx.moveTo(gx, y);
		ctx.lineTo(gx, y + h);
	}
	ctx.stroke();

	const pts = 44;
	const seriesY = (s: number, i: number) => {
		const v = stepped(`${panel.id}-s${s}p${i}`, frame, 320 + i * 7 + s * 53, i * 23 + s * 97, 26);
		return y + h - (0.1 + v * 0.82) * h;
	};

	for (let s = 0; s < 2; s++) {
		const color = s === 0 ? palette.orb : palette.accentB;
		ctx.beginPath();
		for (let i = 0; i < pts; i++) {
			const px = x + (w / (pts - 1)) * i;
			const py = seriesY(s, i);
			if (i === 0) ctx.moveTo(px, py);
			else ctx.lineTo(px, py);
		}
		if (s === 0) {
			ctx.lineTo(x + w, y + h);
			ctx.lineTo(x, y + h);
			ctx.closePath();
			const fill = ctx.createLinearGradient(0, y, 0, y + h);
			fill.addColorStop(0, rgba(color, 0.3));
			fill.addColorStop(1, rgba(color, 0));
			ctx.fillStyle = fill;
			ctx.fill();
		}
		const stroke = new Path2D();
		for (let i = 0; i < pts; i++) {
			const px = x + (w / (pts - 1)) * i;
			const py = seriesY(s, i);
			if (i === 0) stroke.moveTo(px, py);
			else stroke.lineTo(px, py);
		}
		ctx.lineWidth = s === 0 ? 8 : 5;
		ctx.strokeStyle = rgba(color, s === 0 ? 0.95 : 0.7);
		ctx.stroke(stroke);
		if (s === 0) {
				bloom.lineWidth = 8;
			bloom.strokeStyle = rgba(color, 0.45);
			bloom.stroke(stroke);
		}
	}

	// Travelling marker.
	const mi = Math.floor((frame / 4) % pts);
	const mx = x + (w / (pts - 1)) * mi;
	const my = seriesY(0, mi);
	ctx.beginPath();
	ctx.arc(mx, my, 14, 0, TAU);
	ctx.fillStyle = rgba(palette.orbWhite, 0.95);
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(mx, y);
	ctx.lineTo(mx, y + h);
	ctx.lineWidth = 4;
	ctx.strokeStyle = rgba(palette.orbWhite, 0.35);
	ctx.stroke();

	microText(ctx, x + 8, y + 8, w * 0.24, 22, `${panel.id}-lg`, random, rgba(palette.textPale, 0.5));
};

export const drawChartsPanel = (a: PanelDrawArgs) => {
	switch (a.panel.role) {
		case 'map':
			return dotGrid(a);
		case 'bars':
			return bars(a);
		case 'ringA':
			return ringGauge(a, 2);
		case 'ringB':
			return ringGauge(a, 1);
		case 'table':
			return table(a);
		case 'line':
			return lineGraph(a);
		default:
			return undefined;
	}
};
