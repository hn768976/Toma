import {random} from 'remotion';
import {PanelKind} from '../variants';

export const COMP_W = 3840;
export const COMP_H = 2160;
export const DURATION = 570;

/** The AI orb sits centre-left; diameter is 30% of frame height. */
export const ORB = {
	cx: 1150,
	cy: 1080,
	r: Math.round((0.3 * COMP_H) / 2),
};

export type Depth = 0 | 1 | 2;

export type PanelSlot = {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	depth: Depth;
	/** Which body renderer to use, resolved from the variant's panel kind. */
	role: string;
	/** Frame the panel starts sliding in on. */
	start: number;
	/** Distance from the orb - drives arrival order and the slide direction. */
	dist: number;
};

/**
 * Geometry is shared between the "charts" and "code" variants - only the body
 * renderer changes. The last slot is deliberately wide and short so it can be a
 * line graph in one variant and a CPU waveform strip in another.
 */
const RECTS: {id: string; x: number; y: number; w: number; h: number; depth: Depth}[] = [
	{id: 'p1', x: 1500, y: 320, w: 1080, h: 680, depth: 0},
	{id: 'p2', x: 2500, y: 230, w: 780, h: 520, depth: 0},
	{id: 'p3', x: 3200, y: 470, w: 540, h: 640, depth: 2},
	{id: 'p4', x: 1400, y: 1220, w: 540, h: 540, depth: 0},
	{id: 'p5', x: 1860, y: 1140, w: 940, h: 700, depth: 1},
	{id: 'p6', x: 2720, y: 1060, w: 1060, h: 560, depth: 0},
];

const ROLES: Record<PanelKind, string[]> = {
	charts: ['map', 'bars', 'ringA', 'ringB', 'table', 'line'],
	code: ['code', 'log', 'log', 'proc', 'code', 'strip'],
	gauges: ['arc', 'ringL', 'ringR', 'level'],
};

/**
 * The gauge variant replaces the rectangular cluster with a single radial
 * assembly, so it needs its own boxes: one large arc gauge, two smaller rings
 * flanking it and a semicircular level meter beneath. Each box is the bounding
 * square of its gauge; the renderers derive centre and radius from it.
 */
const GAUGE_RECTS: typeof RECTS = [
	{id: 'gA', x: 2100, y: 300, w: 1100, h: 1100, depth: 0},
	{id: 'gL', x: 1650, y: 830, w: 500, h: 500, depth: 1},
	{id: 'gR', x: 3170, y: 830, w: 500, h: 500, depth: 2},
	{id: 'gV', x: 2230, y: 1380, w: 840, h: 420, depth: 0},
];

/** Panels arrive one at a time between frames 90 and ~250. */
export const PANEL_ARRIVE_START = 90;
export const PANEL_ARRIVE_STAGGER = 25;
export const PANEL_ARRIVE_DURATION = 34;
/** Four gauges instead of six panels, so they are spaced wider to fill the
 *  same arrival window. */
const GAUGE_ARRIVE_STAGGER = 42;

export const buildPanels = (
	kind: PanelKind,
	arrival: 'near-first' | 'far-first'
): PanelSlot[] => {
	const roles = ROLES[kind];
	const rects = kind === 'gauges' ? GAUGE_RECTS : RECTS;
	const stagger = kind === 'gauges' ? GAUGE_ARRIVE_STAGGER : PANEL_ARRIVE_STAGGER;
	const withDist = rects.map((r, i) => {
		const cx = r.x + r.w / 2;
		const cy = r.y + r.h / 2;
		return {
			...r,
			role: roles[i],
			dist: Math.hypot(cx - ORB.cx, cy - ORB.cy),
			start: 0,
		};
	});
	const order = [...withDist].sort((a, b) =>
		arrival === 'near-first' ? a.dist - b.dist : b.dist - a.dist
	);
	order.forEach((p, i) => {
		p.start = PANEL_ARRIVE_START + i * stagger;
	});
	// Keep painting order stable (by id) - arrival order only drives timing.
	return withDist;
};

/* ------------------------------------------------------------------ */
/* Background web                                                      */
/* ------------------------------------------------------------------ */

export type WebNode = {
	x0: number;
	y0: number;
	ax: number;
	ay: number;
	period: number;
	phase: number;
	size: number;
	ringed: boolean;
	accent: boolean;
	appear: number;
	/** Deep nodes sit in the far buffer, the rest in the midground. */
	deep: boolean;
};

const NODE_COUNT = 72;
/** Periods that divide 570 so every node returns to its start on the last frame. */
const NODE_PERIODS = [570, 285, 190];

let webCache: WebNode[] | null = null;

export const webNodes = (): WebNode[] => {
	if (webCache) return webCache;
	webCache = Array.from({length: NODE_COUNT}, (_, i) => {
		const s = `web-node-${i}`;
		return {
			x0: -120 + random(`${s}x`) * (COMP_W + 240),
			y0: -120 + random(`${s}y`) * (COMP_H + 240),
			ax: 22 + random(`${s}ax`) * 52,
			ay: 22 + random(`${s}ay`) * 52,
			period: NODE_PERIODS[i % NODE_PERIODS.length],
			phase: random(`${s}p`) * Math.PI * 2,
			size: 3 + random(`${s}s`) * 8,
			ringed: random(`${s}r`) > 0.78,
			accent: random(`${s}a`) > 0.9,
			appear: random(`${s}ap`) * 34,
			deep: random(`${s}dp`) > 0.55,
		};
	});
	return webCache;
};

/* ------------------------------------------------------------------ */
/* Bokeh                                                               */
/* ------------------------------------------------------------------ */

export type BokehDisc = {
	x: number;
	r: number;
	y0: number;
	speed: number;
	alpha: number;
	sway: number;
	swayPeriod: number;
	phase: number;
	warm: boolean;
};

let bokehCache: BokehDisc[] | null = null;

export const bokehDiscs = (): BokehDisc[] => {
	if (bokehCache) return bokehCache;
	bokehCache = Array.from({length: 34}, (_, i) => {
		const s = `bokeh-${i}`;
		return {
			x: random(`${s}x`) * COMP_W,
			r: 34 + random(`${s}r`) * 96,
			y0: random(`${s}y`) * (COMP_H + 400),
			speed: 0.16 + random(`${s}v`) * 0.42,
			alpha: 0.2 + random(`${s}a`) * 0.38,
			sway: 18 + random(`${s}s`) * 46,
			swayPeriod: NODE_PERIODS[i % NODE_PERIODS.length],
			phase: random(`${s}p`) * Math.PI * 2,
			warm: random(`${s}w`) > 0.72,
		};
	});
	return bokehCache;
};

/* ------------------------------------------------------------------ */
/* Orb assembly dots                                                   */
/* ------------------------------------------------------------------ */

export type OrbDot = {
	angle: number;
	startR: number;
	endR: number;
	delay: number;
	size: number;
	hot: boolean;
};

let orbCache: OrbDot[] | null = null;

export const orbDots = (): OrbDot[] => {
	if (orbCache) return orbCache;
	orbCache = Array.from({length: 190}, (_, i) => {
		const s = `orb-dot-${i}`;
		return {
			angle: (i / 190) * Math.PI * 2 + random(`${s}a`) * 0.05,
			startR: ORB.r * (2.1 + random(`${s}r`) * 3.2),
			endR: ORB.r * (0.985 + random(`${s}e`) * 0.035),
			delay: random(`${s}d`) * 16,
			size: 2.6 + random(`${s}s`) * 5.4,
			hot: random(`${s}h`) > 0.8,
		};
	});
	return orbCache;
};
