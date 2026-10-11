import { geoArea, geoConicConformal, geoGraticule, geoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import { FONT_FAMILY } from '../fonts';
import { mulberry32, SEED_COLOURS, SEED_HALFTONE, SEED_PAPER_GRAIN } from '../rng';
import type { CountryRow } from '../rows';
import { polygonsOf, visualCentre, type XY } from './geometry';
import type { Geom, MapData } from './types';

/** Hi-res texture size in "map px". All sizes below are in map px. */
export const TEX = 8192;
/** The outer (low-res) texture covers 2x the hi-res extent around it. */
export const LO_TEX = 4096;
export const LO_SPAN = 2;
/** Where the country name sits in the hi-res texture (u right, v down). */
export const NAME_UV: XY = [0.5, 0.62];

const C = {
	paper: '#F4F1EA',
	sea: '#E4EEF4',
	coastBand: '#BCD3E4',
	coastLine: '#6F98B8',
	featured: '#F4C89A',
	neighbours: ['#B8D49A', '#F0E4A8', '#F0C8C0', '#F4D4A8'],
	disputed: '#E4E0D8',
	lake: '#C8DCEC',
	river: '#7AA8D0',
	graticule: '#9AC0DC',
	border: '#7A6A8A',
	borderHalo: '#F2B6C2',
	roadIn: '#D8603A',
	roadOut: '#E89A7A',
	city: '#1C1C1C',
	neighbourName: '#8C8494',
	name: '#111111',
};

const BASE = {
	name: TEX * 0.024,
	nameSpacing: 0.035,
	city: 88,
	capital: 106,
	neighbour: 128,
	neighbourSpacing: 0.14,
	dot: 10.5,
	capitalSquare: 17,
	coastBand: TEX * 0.003,
	coastLine: 4.6,
	graticule: 6.5,
	river: 5.6,
	border: 5.6,
	borderHalo: 20,
	roadMajorIn: 8.5,
	roadMinorIn: 5.0,
	roadMajorOut: 4.2,
	roadMinorOut: 2.8,
	misregister: 1,
	maxLabels: 35,
	maxFeaturedLabels: 33,
};

// Sizes for the row being drawn (labels x zoom, lines x sqrt(zoom)). Set at the
// start of drawMap; drawing is synchronous so this never leaks between rows.
let S = BASE;
const scaledSizes = (zoom: number) => {
	const t = Math.sqrt(zoom);
	return {
		...BASE,
		name: BASE.name * zoom,
		city: BASE.city * zoom,
		capital: BASE.capital * zoom,
		neighbour: BASE.neighbour * zoom,
		dot: BASE.dot * zoom,
		capitalSquare: BASE.capitalSquare * zoom,
		coastLine: BASE.coastLine * t,
		graticule: BASE.graticule * t,
		river: BASE.river * t,
		border: BASE.border * t,
		borderHalo: BASE.borderHalo * t,
		roadMajorIn: BASE.roadMajorIn * t,
		roadMinorIn: BASE.roadMinorIn * t,
		roadMajorOut: BASE.roadMajorOut * t,
		roadMinorOut: BASE.roadMinorOut * t,
		misregister: BASE.misregister,
	};
};

const font = (weight: number, size: number) => `${weight} ${size}px "${FONT_FAMILY}"`;

// ---------------------------------------------------------------- projection

export const buildProjection = (row: CountryRow, data: MapData) => {
	const [w, s, e, n] = row.frame;
	const lon0 = row.projectionCenter ?? (w + e) / 2;
	const par = row.parallels ?? [s + (n - s) / 6, n - (n - s) / 6];
	const p = geoConicConformal().rotate([-lon0, 0]).parallels(par).scale(1).translate([0, 0]).precision(0.2);

	// With a central meridian away from the frame (Russia) the local north
	// would be tilted; turn the sheet so north is up at the frame centre.
	if (row.projectionCenter !== undefined) {
		const mid: XY = [(w + e) / 2, (s + n) / 2];
		const a = p(mid)!;
		const b = p([mid[0], mid[1] + 0.5])!;
		const deg = (Math.atan2(b[0] - a[0], a[1] - b[1]) * 180) / Math.PI;
		p.angle(deg);
		const a2 = p(mid)!;
		const b2 = p([mid[0], mid[1] + 0.5])!;
		if (Math.abs(b2[0] - a2[0]) > 1e-9) p.angle(-deg);
	}

	const featured = data.countries.find((c) => c.a3 === row.iso);
	if (!featured) throw new Error(`Featured ${row.iso} missing from data`);
	const inFrame = (c: XY) => c[0] >= w && c[0] <= e && c[1] >= s && c[1] <= n;
	let x0 = Infinity;
	let x1 = -Infinity;
	const take = (c: XY) => {
		const xy = p(c);
		if (!xy) return;
		x0 = Math.min(x0, xy[0]);
		x1 = Math.max(x1, xy[0]);
	};
	if (row.fitTo === 'frame') {
		for (let i = 0; i <= 64; i++) {
			const t = i / 64;
			take([w + (e - w) * t, s]);
			take([w + (e - w) * t, n]);
			take([w, s + (n - s) * t]);
			take([e, s + (n - s) * t]);
		}
	} else {
		for (const poly of polygonsOf(featured.geometry)) for (const c of poly[0]) if (inFrame(c)) take(c);
	}
	p.scale((0.55 * TEX) / (x1 - x0));

	// Name position: override or pole of inaccessibility on the projected
	// polygon (clipped to the projected frame box).
	let nameXY: XY;
	if (row.labelLonLat) {
		nameXY = p(row.labelLonLat) as XY;
	} else {
		let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
		for (let i = 0; i <= 32; i++) {
			const t = i / 32;
			for (const c of [[w + (e - w) * t, s], [w + (e - w) * t, n], [w, s + (n - s) * t], [e, s + (n - s) * t]] as XY[]) {
				const xy = p(c)!;
				fx0 = Math.min(fx0, xy[0]); fx1 = Math.max(fx1, xy[0]);
				fy0 = Math.min(fy0, xy[1]); fy1 = Math.max(fy1, xy[1]);
			}
		}
		const vc = visualCentre(p, featured.geometry, [fx0, fy0, fx1, fy1]);
		if (!vc) throw new Error(`No polygon of ${row.iso} inside the frame`);
		nameXY = vc.xy;
	}
	p.translate([TEX * NAME_UV[0] - nameXY[0], TEX * NAME_UV[1] - nameXY[1]]);
	return p;
};

// ---------------------------------------------------------------- colours

/** 4-colour assignment: DSatur greedy over the shared-border graph. */
const assignColours = (data: MapData, featuredIdx: number) => {
	const n = data.countries.length;
	const colour = new Array<number>(n).fill(-1);
	const rng = mulberry32(SEED_COLOURS);
	const tie = data.countries.map(() => rng());
	const eligible = (i: number) => i !== featuredIdx && !data.countries[i].disputed;
	// Countries bordering the featured one go first and never get light orange
	// (closest to the featured peach); with 3 colours for that ring, the rest
	// still has all 4.
	const ring = new Set(data.countries[featuredIdx].neighbours.filter(eligible));
	const others = new Set([...Array(n).keys()].filter((i) => eligible(i) && !ring.has(i)));
	for (const todo of [ring, others])
	while (todo.size) {
		let pick = -1;
		let bestSat = -1;
		let bestDeg = -1;
		for (const i of todo) {
			const sat = new Set(data.countries[i].neighbours.map((j) => colour[j]).filter((c) => c >= 0)).size;
			const deg = data.countries[i].neighbours.length;
			if (sat > bestSat || (sat === bestSat && (deg > bestDeg || (deg === bestDeg && tie[i] > tie[pick])))) {
				pick = i;
				bestSat = sat;
				bestDeg = deg;
			}
		}
		todo.delete(pick);
		const used = new Set(data.countries[pick].neighbours.map((j) => colour[j]));
		const touchesFeatured = data.countries[pick].neighbours.includes(featuredIdx);
		// Light orange (index 3) is closest to the featured peach: avoid it next to the featured country.
		const order = touchesFeatured ? [0, 1, 2, 3] : [0, 2, 1, 3];
		const allowed = (i: number, c: number) => !(c === 3 && data.countries[i].neighbours.includes(featuredIdx));
		let choice = order.find((c) => !used.has(c) && allowed(pick, c));
		if (choice === undefined) {
			// Stuck: free a colour by recolouring the single neighbour that holds it.
			for (const c of order.filter((c) => allowed(pick, c))) {
				const holders = data.countries[pick].neighbours.filter((j) => colour[j] === c);
				if (holders.length !== 1) continue;
				const k = holders[0];
				const kUsed = new Set(data.countries[k].neighbours.filter((j) => j !== pick).map((j) => colour[j]));
				const alt = [0, 1, 2, 3].find((a) => a !== c && !kUsed.has(a) && allowed(k, a));
				if (alt !== undefined) {
					colour[k] = alt;
					choice = c;
					break;
				}
			}
		}
		colour[pick] = choice ?? order.find((c) => !used.has(c)) ?? 0;
	}
	// Min-conflicts repair (deterministic: seeded tie-breaks, fixed iteration cap).
	const allowedC = (i: number, c: number) => !(c === 3 && data.countries[i].neighbours.includes(featuredIdx));
	const clash = (i: number, c: number) => data.countries[i].neighbours.filter((j) => colour[j] === c).length;
	for (let iter = 0; iter < 5000; iter++) {
		const bad = [...Array(n).keys()].filter((i) => eligible(i) && (clash(i, colour[i]) > 0 || !allowedC(i, colour[i])));
		if (!bad.length) break;
		const i = bad[Math.floor(rng() * bad.length)];
		const options = [0, 1, 2, 3].filter((c) => allowedC(i, c) && c !== colour[i]);
		const best = Math.min(...options.map((c) => clash(i, c)));
		const ties = options.filter((c) => clash(i, c) === best);
		colour[i] = ties[Math.floor(rng() * ties.length)];
	}
	return colour;
};

// ---------------------------------------------------------------- labels

type Box = [number, number, number, number];
type Label = { text: string; x: number; y: number; font: string; spacing: number; colour: string; align: CanvasTextAlign; size: number };
type Dot = { x: number; y: number; capital: boolean };

const overlaps = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

const measure = (ctx: CanvasRenderingContext2D, text: string, f: string, size: number, spacing: number) => {
	ctx.font = f;
	ctx.letterSpacing = `${spacing * size}px`;
	const w = ctx.measureText(text).width;
	ctx.letterSpacing = '0px';
	return w;
};

const layoutLabels = (ctx: CanvasRenderingContext2D, row: CountryRow, data: MapData, p: GeoProjection, featuredIdx: number) => {
	const labels: Label[] = [];
	const dots: Dot[] = [];
	const taken: Box[] = [];
	const margin = 260;
	const inTex = (b: Box) => b[0] > margin && b[1] > margin && b[2] < TEX - margin && b[3] < TEX - margin;

	// 1. Featured name (fixed at the focus point).
	const nx = TEX * NAME_UV[0];
	const ny = TEX * NAME_UV[1];
	const nameFont = font(700, S.name);
	const nw = measure(ctx, row.label, nameFont, S.name, S.nameSpacing);
	labels.push({ text: row.label, x: nx, y: ny, font: nameFont, spacing: S.nameSpacing, colour: C.name, align: 'center', size: S.name });
	taken.push([nx - nw / 2 - 60, ny - S.name * 0.45, nx + nw / 2 + 60, ny + S.name * 0.45]);

	// 2. Neighbour names (grey caps) at each neighbour's visual centre in view.
	const rect: [number, number, number, number] = [margin, margin, TEX - margin, TEX - margin];
	data.countries.forEach((c, i) => {
		if (i === featuredIdx || c.disputed) return;
		const text = c.name.toUpperCase();
		const vc = visualCentre(p, c.geometry, rect);
		if (!vc) return;
		const f = font(600, S.neighbour);
		const w = measure(ctx, text, f, S.neighbour, S.neighbourSpacing);
		if (vc.distance < S.neighbour * 0.9 || vc.area < w * S.neighbour * 4 || w / 2 > vc.distance * 2.5) return;
		const box: Box = [vc.xy[0] - w / 2 - 30, vc.xy[1] - S.neighbour * 0.42, vc.xy[0] + w / 2 + 30, vc.xy[1] + S.neighbour * 0.42];
		if (!inTex(box) || taken.some((t) => overlaps(t, box))) return;
		taken.push(box);
		labels.push({ text, x: vc.xy[0], y: vc.xy[1], font: f, spacing: S.neighbourSpacing, colour: C.neighbourName, align: 'center', size: S.neighbour });
	});

	// Per-row place-name overrides (null hides a place), then generic cleanup.
	const rename = (name: string): string => {
		const o = row.placeNames?.[name];
		if (o !== undefined) return o as string;
		// Natural Earth sometimes carries the admin unit in the name.
		return name.replace(/\s+governorate$/i, '');
	};

	// 3. Cities: featured first (capital first), then neighbours; collision pass.
	const skip = /Scientific|Historic|Meteorological/;
	const projected = data.places
		.filter((pl) => !skip.test(pl.cls))
		.map((pl) => ({ ...pl, name: rename(pl.name), xy: p(pl.lonlat) as XY | null }))
		.filter((pl) => pl.name !== null)
		.filter((pl) => pl.xy && pl.xy[0] > margin && pl.xy[0] < TEX - margin && pl.xy[1] > margin && pl.xy[1] < TEX - margin);
	const isCapital = (pl: (typeof projected)[number]) => pl.a3 === row.iso && pl.cls === 'Admin-0 capital';
	const byImportance = (a: (typeof projected)[number], b: (typeof projected)[number]) =>
		Number(isCapital(b)) - Number(isCapital(a)) || a.rank - b.rank || b.pop - a.pop || a.name.localeCompare(b.name);
	// What the camera actually sees of the sheet (around the name), so labels
	// are spent where they can be read.
	const seen = (pl: (typeof projected)[number]) => {
		const [x, y] = pl.xy!;
		const z = row.zoom ?? 1;
		return Math.abs(x - nx) < TEX * 0.22 * z && y > ny - TEX * 0.2 * z && y < ny + TEX * 0.17 * z;
	};
	const featuredAll = projected.filter((pl) => pl.a3 === row.iso);
	const featuredCities = [...featuredAll.filter(seen).sort(byImportance), ...featuredAll.filter((pl) => !seen(pl)).sort(byImportance)];
	const otherAll = projected.filter((pl) => pl.a3 !== row.iso && pl.rank <= 6);
	const otherCities = [...otherAll.filter(seen).sort(byImportance), ...otherAll.filter((pl) => !seen(pl)).sort(byImportance)];

	let count = 0;
	let featuredCount = 0;
	const tryPlace = (pl: (typeof projected)[number]) => {
		const cap = isCapital(pl);
		const size = cap ? S.capital : S.city;
		const f = font(cap ? 600 : 400, size);
		const w = measure(ctx, pl.name, f, size, 0);
		const [x, y] = pl.xy!;
		const r = cap ? S.capitalSquare : S.dot;
		const dotBox: Box = [x - r - 8, y - r - 8, x + r + 8, y + r + 8];
		if (taken.some((t) => overlaps(t, dotBox))) return false;
		const g = r + 22;
		const h = size * 0.74;
		const candidates: [Box, number, number, CanvasTextAlign][] = [
			[[x + g, y - h / 2, x + g + w, y + h / 2], x + g, y, 'left'],
			[[x - g - w, y - h / 2, x - g, y + h / 2], x - g, y, 'right'],
			[[x + g * 0.6, y - g * 0.5 - h, x + g * 0.6 + w, y - g * 0.5], x + g * 0.6, y - g * 0.5 - h / 2, 'left'],
			[[x + g * 0.6, y + g * 0.5, x + g * 0.6 + w, y + g * 0.5 + h], x + g * 0.6, y + g * 0.5 + h / 2, 'left'],
			[[x - g * 0.6 - w, y - g * 0.5 - h, x - g * 0.6, y - g * 0.5], x - g * 0.6, y - g * 0.5 - h / 2, 'right'],
			[[x - g * 0.6 - w, y + g * 0.5, x - g * 0.6, y + g * 0.5 + h], x - g * 0.6, y + g * 0.5 + h / 2, 'right'],
		];
		for (const [box, lx, ly, align] of candidates) {
			const padded: Box = [box[0] - 36, box[1] - 14, box[2] + 36, box[3] + 14];
			if (!inTex(padded) || taken.some((t) => overlaps(t, padded))) continue;
			// Don't park a label next to someone else's dot: it would read as theirs.
			const near: Box = [box[0] - 70, box[1] - 50, box[2] + 70, box[3] + 50];
			if (dots.some((d) => d.x > near[0] && d.x < near[2] && d.y > near[1] && d.y < near[3])) continue;
			taken.push(padded, dotBox);
			labels.push({ text: pl.name, x: lx, y: ly, font: f, spacing: 0, colour: C.city, align, size });
			dots.push({ x, y, capital: cap });
			return true;
		}
		return false;
	};
	for (const pl of featuredCities) {
		if (featuredCount >= S.maxFeaturedLabels) break;
		if (tryPlace(pl)) {
			featuredCount++;
			count++;
		}
	}
	for (const pl of otherCities) {
		if (count >= S.maxLabels) break;
		if (tryPlace(pl)) count++;
	}
	return { labels, dots, cityCount: count };
};

// ---------------------------------------------------------------- tiles

const noiseTile = (seed: number, size: number, amp: number) => {
	const c = document.createElement('canvas');
	c.width = c.height = size;
	const ctx = c.getContext('2d')!;
	const img = ctx.createImageData(size, size);
	const rng = mulberry32(seed);
	for (let i = 0; i < size * size; i++) {
		const v = 255 - Math.round(rng() * amp);
		img.data[i * 4] = v;
		img.data[i * 4 + 1] = v;
		img.data[i * 4 + 2] = Math.max(0, v - 2);
		img.data[i * 4 + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	return c;
};

const halftoneTile = () => {
	// Fine dot screen; jitter-free so it reads as a printed screen.
	const size = 12;
	const c = document.createElement('canvas');
	c.width = c.height = size;
	const ctx = c.getContext('2d')!;
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, size, size);
	const rng = mulberry32(SEED_HALFTONE);
	ctx.fillStyle = '#000';
	ctx.beginPath();
	ctx.arc(size / 2, size / 2, 3.2 + rng() * 0.01, 0, Math.PI * 2);
	ctx.fill();
	return c;
};

// ---------------------------------------------------------------- drawing

/** Projected neatline (graticule-bounded fan) of row.printArea, in map px. */
const printAreaRing = (p: GeoProjection, row: CountryRow): XY[] | null => {
	if (!row.printArea) return null;
	const [w, s, e, n] = row.printArea;
	const pts: XY[] = [];
	const N = 200;
	for (let i = 0; i <= N; i++) pts.push([w + ((e - w) * i) / N, s]);
	for (let i = 0; i <= N; i++) pts.push([e, s + ((n - s) * i) / N]);
	for (let i = 0; i <= N; i++) pts.push([e - ((e - w) * i) / N, n]);
	for (let i = 0; i <= N; i++) pts.push([w, n - ((n - s) * i) / N]);
	return pts.map((c) => p(c) as XY);
};

type View = { canvas: HTMLCanvasElement; k: number; off: number };

const drawView = (
	row: CountryRow,
	view: View,
	data: MapData,
	p: GeoProjection,
	colours: number[],
	featuredIdx: number,
	layout: ReturnType<typeof layoutLabels>,
	tiles: { grain: HTMLCanvasElement; halftone: HTMLCanvasElement },
) => {
	const ctx = view.canvas.getContext('2d')!;
	const ext0 = view.off - 400;
	const ext1 = view.off + view.canvas.width / view.k + 400;
	p.clipExtent([[ext0, ext0], [ext1, ext1]]);
	const path = geoPath(p, ctx);
	const all = (geoms: Geom[]) => ({ type: 'GeometryCollection', geometries: geoms }) as unknown as GeoPermissibleObjects;
	const setT = (dx = 0) => ctx.setTransform(view.k, 0, 0, view.k, (dx - view.off) * view.k, (dx - view.off) * view.k);
	const stroke = (g: GeoPermissibleObjects, colour: string, width: number, alpha = 1, dash: number[] = []) => {
		ctx.globalAlpha = alpha;
		ctx.strokeStyle = colour;
		ctx.lineWidth = width;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		ctx.setLineDash(dash);
		ctx.beginPath();
		path(g);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.globalAlpha = 1;
	};
	const fill = (g: GeoPermissibleObjects, colour: string) => {
		ctx.fillStyle = colour;
		ctx.beginPath();
		path(g);
		ctx.fill('evenodd');
	};
	const full = () => ctx.fillRect(view.off - 10, view.off - 10, view.canvas.width / view.k + 20, view.canvas.width / view.k + 20);

	// Blank sheet, then (optionally) clip the print to the neatline.
	setT(0);
	ctx.fillStyle = C.paper;
	full();
	const neat = printAreaRing(p, row);
	ctx.save();
	if (neat) {
		ctx.beginPath();
		neat.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
		ctx.closePath();
		ctx.clip();
	}

	// --- colour plate (offset by S.misregister px from the line plate)
	setT(S.misregister);
	ctx.fillStyle = C.sea;
	full();
	// Coastal band: darker sea hugging every coast, fading outward.
	for (const [mult, a] of [[2.0, 0.22], [1.4, 0.3], [0.8, 0.38], [0.35, 0.45]] as const) {
		stroke(data.coast as never, C.coastBand, S.coastBand * mult, a);
	}
	data.countries.forEach((c, i) => {
		const colour = i === featuredIdx ? C.featured : c.disputed ? C.disputed : C.neighbours[colours[i]];
		fill(c.geometry as never, colour);
	});
	fill(all(data.lakes.map((l) => l.geometry)), C.lake);

	// Halftone screen on the printed fills (0.5% contrast).
	ctx.globalCompositeOperation = 'multiply';
	ctx.globalAlpha = 0.005;
	const ht = ctx.createPattern(tiles.halftone, 'repeat')!;
	ctx.fillStyle = ht;
	full();
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = 'source-over';

	// --- line plate
	setT(0);
	stroke(data.coast as never, C.coastLine, S.coastLine, 0.9);
	stroke(all(data.lakes.map((l) => l.geometry)), C.coastLine, S.coastLine * 0.7, 0.8);
	for (const [lo, hi, w] of [[0, 5, 1.35], [6, 8, 1], [9, 99, 0.75]]) {
		const rv = data.rivers.filter((r) => r.rank >= lo && r.rank <= hi);
		stroke(all(rv.map((r) => r.geometry)), C.river, S.river * w, 0.95);
	}
	stroke(geoGraticule().step([5, 5]).extent([[-180, -85], [180, 85]])() as never, C.graticule, S.graticule, 0.9);
	stroke(data.borders as never, C.borderHalo, S.borderHalo, 0.45);
	stroke(data.borders as never, C.border, S.border, 0.95);
	if (data.disputed.length) {
		stroke(all(data.disputed.map((d) => d.geometry)), C.paper, S.border * 1.6, 0.9);
		stroke(all(data.disputed.map((d) => d.geometry)), C.border, S.border, 0.95, [26, 18]);
	}
	const roads = (inside: boolean, major: boolean) => all(data.roads.filter((r) => r.inside === inside && r.major === major).map((r) => r.geometry));
	stroke(roads(false, false), C.roadOut, S.roadMinorOut, 0.85);
	stroke(roads(false, true), C.roadOut, S.roadMajorOut, 0.9);
	stroke(roads(true, false), C.roadIn, S.roadMinorIn, 0.9);
	stroke(roads(true, true), C.roadIn, S.roadMajorIn, 0.95);

	// Cities.
	for (const d of layout.dots) {
		if (d.capital) {
			const r = S.capitalSquare;
			ctx.fillStyle = C.city;
			ctx.fillRect(d.x - r, d.y - r, r * 2, r * 2);
			ctx.fillStyle = C.paper;
			ctx.fillRect(d.x - r * 0.5, d.y - r * 0.5, r, r);
			ctx.fillStyle = C.city;
			ctx.fillRect(d.x - r * 0.22, d.y - r * 0.22, r * 0.44, r * 0.44);
		} else {
			ctx.fillStyle = C.city;
			ctx.beginPath();
			ctx.arc(d.x, d.y, S.dot, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	ctx.textBaseline = 'middle';
	for (const l of layout.labels) {
		ctx.font = l.font;
		ctx.letterSpacing = `${l.spacing * l.size}px`;
		ctx.textAlign = l.align;
		ctx.fillStyle = l.colour;
		// letterSpacing adds trailing space after the last glyph; re-centre.
		const dx = l.align === 'center' ? (l.spacing * l.size) / 2 : 0;
		ctx.fillText(l.text, l.x + dx, l.y + l.size * 0.04);
	}
	ctx.letterSpacing = '0px';
	ctx.restore();
	if (neat) {
		setT(0);
		ctx.strokeStyle = C.border;
		ctx.lineWidth = 4;
		ctx.beginPath();
		neat.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
		ctx.closePath();
		ctx.stroke();
	}

	// --- paper grain multiplied over everything
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.globalCompositeOperation = 'multiply';
	ctx.globalAlpha = 0.5;
	ctx.fillStyle = ctx.createPattern(tiles.grain, 'repeat')!;
	ctx.fillRect(0, 0, view.canvas.width, view.canvas.height);
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = 'source-over';
};

export type MapTextures = {
	hi: HTMLCanvasElement;
	lo: HTMLCanvasElement;
	stats: { drawMs: number; cities: number; labels: number; conflicts: number };
};

/**
 * d3-geo treats polygons spherically: a ring wound the "wrong" way means the
 * whole globe minus that ring. Rounding in the data step can flip tiny islands,
 * so fix each polygon's winding and drop degenerate rings.
 */
const fixWinding = (g: Geom): Geom => {
	const polys = (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : null) as XY[][][] | null;
	if (!polys) return g;
	const fixed = polys
		.map((rings) => rings.filter((r) => r.length >= 4))
		.filter((rings) => rings.length > 0)
		.map((rings) => {
			const outer = { type: 'Polygon', coordinates: [rings[0]] } as GeoPermissibleObjects;
			const out = [geoArea(outer) > 2 * Math.PI ? [...rings[0]].reverse() : rings[0]];
			for (const hole of rings.slice(1)) {
				const h = { type: 'Polygon', coordinates: [hole] } as GeoPermissibleObjects;
				// A hole must wind opposite to its outer ring: as a polygon it is "big".
				out.push(geoArea(h) < 2 * Math.PI ? [...hole].reverse() : hole);
			}
			return out;
		});
	return { type: 'MultiPolygon', coordinates: fixed };
};

/** Draws the printed atlas page for one country: hi-res centre + low-res surround. */
export const drawMap = (row: CountryRow, data: MapData): MapTextures => {
	const t0 = performance.now();
	S = scaledSizes(row.zoom ?? 1);
	for (const c of data.countries) c.geometry = fixWinding(c.geometry);
	for (const l of data.lakes) l.geometry = fixWinding(l.geometry);
	const p = buildProjection(row, data);
	const featuredIdx = data.countries.findIndex((c) => c.a3 === row.iso);
	const colours = assignColours(data, featuredIdx);

	const hi = document.createElement('canvas');
	hi.width = hi.height = TEX;
	const lo = document.createElement('canvas');
	lo.width = lo.height = LO_TEX;
	const layout = layoutLabels(hi.getContext('2d')!, row, data, p, featuredIdx);
	const tiles = { grain: noiseTile(SEED_PAPER_GRAIN, 512, 10), halftone: halftoneTile() };

	drawView(row, { canvas: hi, k: 1, off: 0 }, data, p, colours, featuredIdx, layout, tiles);
	drawView(row, { canvas: lo, k: LO_TEX / (TEX * LO_SPAN), off: -(TEX * (LO_SPAN - 1)) / 2 }, data, p, colours, featuredIdx, layout, tiles);
	// Force rasterisation to finish before anything uploads the canvases.
	hi.getContext('2d')!.getImageData(0, 0, 1, 1);
	lo.getContext('2d')!.getImageData(0, 0, 1, 1);
	// Colour-rule audit: touching neighbours sharing a colour, and light orange next to the featured country.
	let conflicts = 0;
	data.countries.forEach((c, i) =>
		c.neighbours.forEach((j) => {
			if (j > i && colours[i] >= 0 && colours[i] === colours[j]) conflicts++;
			if (j === featuredIdx && colours[i] === 3) conflicts++;
		}),
	);
	return { hi, lo, stats: { drawMs: performance.now() - t0, cities: layout.cityCount, labels: layout.labels.length, conflicts } };
};
