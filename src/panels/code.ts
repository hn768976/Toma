import {random} from 'remotion';
import {rgba} from '../lib/canvas';
import {stepped} from '../lib/motion';
import {TERMINAL_MONO} from '../variants';
import {
	FAKE_SOURCE,
	LOG_ERROR,
	LOG_INFO,
	LOG_SUBSYSTEMS,
	LOG_WARN,
	PROCESS_NAMES,
} from './source';
import {PanelDrawArgs} from './types';

/**
 * "code" panel bodies for the green terminal variant.
 *
 * Where the chart panels reroll a value every few seconds, these never stop:
 * both code windows scroll continuously at different speeds, the logs push a
 * new line up every half second and the strip waveform slides sideways every
 * frame. That change of rhythm is as much of the difference between the two
 * versions as the palette is.
 */

const CODE_SIZE = 34;
const CODE_LINE_H = 46;

const KEYWORDS = new Set([
	'kernel', 'let', 'for', 'in', 'guard', 'else', 'continue', 'emit', 'yield',
	'defer', 'shape', 'bind', 'when', 'into', 'return', 'while', 'lift', 'halt',
	'trace', 'sync', 'self',
]);

type Tok = {s: string; kind: 'kw' | 'fn' | 'str' | 'num' | 'com' | 'punc' | 'id'};

const tokenCache = new Map<string, Tok[]>();

/** Tiny hand-rolled tokeniser - enough to colour the invented language. */
const tokenise = (line: string): Tok[] => {
	const hit = tokenCache.get(line);
	if (hit) return hit;

	const out: Tok[] = [];
	const commentAt = line.indexOf('//');
	const code = commentAt >= 0 ? line.slice(0, commentAt) : line;
	const comment = commentAt >= 0 ? line.slice(commentAt) : '';

	const re = /("[^"]*")|(\b0x[0-9A-Fa-f]+\b|\b\d+(?:\.\d+)?\b)|([A-Za-z_$][A-Za-z0-9_]*)|(\s+)|([^\sA-Za-z0-9_$]+)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(code)) !== null) {
		if (m[1]) out.push({s: m[1], kind: 'str'});
		else if (m[2]) out.push({s: m[2], kind: 'num'});
		else if (m[3]) {
			const after = code.slice(re.lastIndex);
			const isCall = after.startsWith('(');
			out.push({s: m[3], kind: KEYWORDS.has(m[3]) ? 'kw' : isCall ? 'fn' : 'id'});
		} else if (m[4]) out.push({s: m[4], kind: 'punc'});
		else out.push({s: m[5], kind: 'punc'});
	}
	if (comment) out.push({s: comment, kind: 'com'});

	tokenCache.set(line, out);
	return out;
};

const codeWindow = (a: PanelDrawArgs) => {
	const {ctx, x, y, w, h, variant, frame, panel} = a;
	const {palette} = variant;

	const tone: Record<Tok['kind'], [string, number]> = {
		kw: [palette.orbWhite, 0.95],
		fn: [palette.orb, 0.95],
		str: [palette.textPale, 0.85],
		num: [palette.panelBorder, 0.95],
		com: [palette.web, 1],
		punc: [palette.textPale, 0.55],
		id: [palette.textPale, 0.78],
	};

	// The two code windows scroll at different speeds.
	const speed = panel.id === 'p1' ? 2.2 : 3.4;
	const scroll = frame * speed;
	const first = Math.floor(scroll / CODE_LINE_H);
	const offset = scroll - first * CODE_LINE_H;
	const visible = Math.ceil(h / CODE_LINE_H) + 1;

	// Content scrolls continuously, so a line is almost always half in frame at
	// each edge; clip to the content box or it bleeds over the panel header.
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.clip();

	ctx.font = `${CODE_SIZE}px "${TERMINAL_MONO}", monospace`;
	ctx.textBaseline = 'alphabetic';
	ctx.textAlign = 'left';
	const gutterW = 78;

	for (let i = 0; i < visible; i++) {
		const lineNo = first + i;
		const text = FAKE_SOURCE[((lineNo % FAKE_SOURCE.length) + FAKE_SOURCE.length) % FAKE_SOURCE.length];
		const ly = y + i * CODE_LINE_H - offset + CODE_SIZE;
		if (ly < y - CODE_LINE_H || ly > y + h + CODE_LINE_H) continue;

		ctx.fillStyle = rgba(palette.web, 0.9);
		ctx.fillText(String(1000 + (lineNo % 900)).slice(1), x, ly);

		let penX = x + gutterW;
		for (const tok of tokenise(text)) {
			const [color, alpha] = tone[tok.kind];
			if (tok.kind !== 'punc' || tok.s.trim() !== '') {
				ctx.fillStyle = rgba(color, alpha);
				ctx.fillText(tok.s, penX, ly);
			}
			penX += ctx.measureText(tok.s).width;
		}
	}

	// Terminal cursor block riding the scroll.
	if (frame % 30 < 16) {
		const cy = y + h - CODE_LINE_H;
		ctx.fillStyle = rgba(palette.orb, 0.8);
		ctx.fillRect(x + gutterW, cy, CODE_SIZE * 0.62, CODE_SIZE);
	}

	ctx.restore();
};

const LOG_LINE_H = 44;
const LOG_PERIOD = 18;

const logOutput = (a: PanelDrawArgs) => {
	const {ctx, x, y, w, h, variant, frame, panel} = a;
	const {palette} = variant;

	const head = Math.floor(frame / LOG_PERIOD);
	const slide = ((frame % LOG_PERIOD) / LOG_PERIOD) * LOG_LINE_H;
	const rows = Math.ceil(h / LOG_LINE_H) + 1;

	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.clip();

	ctx.font = `${28}px "${TERMINAL_MONO}", monospace`;
	ctx.textBaseline = 'alphabetic';
	ctx.textAlign = 'left';

	for (let i = 0; i < rows; i++) {
		const idx = head - i;
		if (idx < 0) continue;
		const seed = `${panel.id}-log${idx}`;
		const roll = random(seed);
		const level = roll > 0.95 ? 'error' : roll > 0.83 ? 'warn' : 'info';
		const pool = level === 'error' ? LOG_ERROR : level === 'warn' ? LOG_WARN : LOG_INFO;
		const msg = pool[Math.floor(random(`${seed}m`) * pool.length)];
		const sub = LOG_SUBSYSTEMS[Math.floor(random(`${seed}s`) * LOG_SUBSYSTEMS.length)];

		const secs = idx * 0.6;
		const stamp = `${String(12 + Math.floor(secs / 3600)).padStart(2, '0')}:${String(
			Math.floor(secs / 60) % 60
		).padStart(2, '0')}:${String(Math.floor(secs) % 60).padStart(2, '0')}.${String(
			Math.floor((secs % 1) * 1000)
		).padStart(3, '0')}`;

		// Newest line sits on the bottom edge; older lines are pushed up.
		const ly = y + h - 12 - i * LOG_LINE_H + slide;
		if (ly < y - LOG_LINE_H || ly > y + h + LOG_LINE_H) continue;

		// accentA is the warning amber and accentB the error red - used here and
		// nowhere else in this variant.
		const color =
			level === 'error' ? palette.accentB : level === 'warn' ? palette.accentA : palette.textPale;

		if (level !== 'info') {
			ctx.fillStyle = rgba(color, 0.16);
			ctx.fillRect(x - 10, ly - 30, w + 20, LOG_LINE_H - 8);
		}

		ctx.fillStyle = rgba(palette.web, 1);
		ctx.fillText(stamp, x, ly);
		const stampW = ctx.measureText(`${stamp}  `).width;
		ctx.fillStyle = rgba(palette.panelBorder, 0.9);
		ctx.fillText(sub, x + stampW, ly);
		const subW = ctx.measureText(`${sub}  `).width;
		ctx.fillStyle = rgba(color, level === 'info' ? 0.85 : 1);
		ctx.fillText(msg, x + stampW + subW, ly);
	}

	ctx.restore();
};

const processList = (a: PanelDrawArgs) => {
	const {ctx, bloom, x, y, w, h, variant, frame, panel} = a;
	const {palette} = variant;
	const rowH = 62;
	const rows = Math.min(PROCESS_NAMES.length, Math.floor(h / rowH));

	ctx.font = `${28}px "${TERMINAL_MONO}", monospace`;
	ctx.textBaseline = 'alphabetic';
	ctx.textAlign = 'left';

	for (let i = 0; i < rows; i++) {
		const ry = y + i * rowH;
		const pct = stepped(`${panel.id}-proc${i}`, frame, 90 + i * 17, i * 29, 14);
		const label = PROCESS_NAMES[i];

		ctx.fillStyle = rgba(palette.textPale, 0.85);
		ctx.fillText(label, x, ry + 28);

		const pctText = `${Math.round(pct * 100)}`.padStart(3, ' ');
		ctx.textAlign = 'right';
		ctx.fillStyle = rgba(palette.orb, 0.95);
		ctx.fillText(pctText, x + w, ry + 28);
		ctx.textAlign = 'left';

		const barY = ry + 38;
		const barW = w - 90;
		ctx.fillStyle = rgba(palette.web, 0.9);
		ctx.fillRect(x, barY, barW, 12);
		ctx.fillStyle = rgba(palette.orb, 0.95);
		ctx.fillRect(x, barY, barW * pct, 12);
		bloom.fillStyle = rgba(palette.orb, 0.45);
		bloom.fillRect(x, barY, barW * pct, 12);
	}
};

/** Seeded pseudo-waveform - continuous in `t` so it scrolls smoothly. */
const wave = (seed: string, t: number) => {
	const i = Math.floor(t);
	const f = t - i;
	const a = random(`${seed}#${i}`);
	const b = random(`${seed}#${i + 1}`);
	const s = f * f * (3 - 2 * f);
	return a + (b - a) * s;
};

const cpuStrip = (a: PanelDrawArgs) => {
	const {ctx, bloom, x, y, w, h, variant, frame, panel} = a;
	const {palette} = variant;
	const half = h / 2 - 8;

	const traces: [string, string, number][] = [
		[`${panel.id}-cpu`, palette.orb, y + half * 0.5],
		[`${panel.id}-mem`, palette.panelBorder, y + h - half * 0.5],
	];

	ctx.lineWidth = 5;
	for (const [seed, color, mid] of traces) {
		const path = new Path2D();
		const steps = 150;
		for (let i = 0; i <= steps; i++) {
			const px = x + (w / steps) * i;
			const t = (frame * 0.09) + i * 0.11;
			const v = wave(seed, t) * 0.7 + wave(`${seed}b`, t * 2.7) * 0.3;
			const py = mid + (v - 0.5) * half * 1.5;
			if (i === 0) path.moveTo(px, py);
			else path.lineTo(px, py);
		}
		ctx.strokeStyle = rgba(color, 0.95);
		ctx.stroke(path);
		bloom.lineWidth = 5;
		bloom.strokeStyle = rgba(color, 0.4);
		bloom.stroke(path);

		ctx.beginPath();
		ctx.moveTo(x, mid);
		ctx.lineTo(x + w, mid);
		ctx.lineWidth = 2.5;
		ctx.strokeStyle = rgba(palette.web, 1);
		ctx.stroke();
		ctx.lineWidth = 5;
	}

	// Grid ticks sliding with the trace.
	const tickGap = 90;
	const shift = (frame * 2.7) % tickGap;
	ctx.lineWidth = 2;
	ctx.strokeStyle = rgba(palette.web, 0.8);
	ctx.beginPath();
	for (let px = x - shift; px < x + w; px += tickGap) {
		ctx.moveTo(px, y);
		ctx.lineTo(px, y + h);
	}
	ctx.stroke();

	ctx.font = `${26}px "${TERMINAL_MONO}", monospace`;
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = rgba(palette.textPale, 0.8);
	ctx.fillText(
		`CPU ${Math.round(wave(`${panel.id}-cpu`, frame * 0.09) * 100)}%   MEM ${Math.round(
			wave(`${panel.id}-mem`, frame * 0.09) * 100
		)}%`,
		x,
		y + 26
	);
};

export const drawCodePanel = (a: PanelDrawArgs) => {
	switch (a.panel.role) {
		case 'code':
			return codeWindow(a);
		case 'log':
			return logOutput(a);
		case 'proc':
			return processList(a);
		case 'strip':
			return cpuStrip(a);
		default:
			return undefined;
	}
};
