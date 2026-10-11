import polylabel from 'polylabel';
import type { GeoProjection } from 'd3-geo';
import type { Geom } from './types';

export type XY = [number, number];
export type Ring = XY[];

/** Outer+inner rings of every polygon in a (Multi)Polygon, lon/lat. */
export const polygonsOf = (g: Geom): XY[][][] => {
	if (g.type === 'Polygon') return [g.coordinates as XY[][]];
	if (g.type === 'MultiPolygon') return g.coordinates as XY[][][];
	return [];
};

export const projectRing = (p: GeoProjection, ring: XY[]): Ring => {
	const out: Ring = [];
	for (const c of ring) {
		const xy = p(c);
		if (xy) out.push(xy as XY);
	}
	return out;
};

export const ringArea = (r: Ring) => {
	let a = 0;
	for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
	return Math.abs(a / 2);
};

/** Sutherland–Hodgman clip of a ring to an axis-aligned rectangle. */
export const clipRing = (ring: Ring, x0: number, y0: number, x1: number, y1: number): Ring => {
	const edges: [(p: XY) => boolean, (a: XY, b: XY) => XY][] = [
		[(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
		[(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
		[(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
		[(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
	];
	let out = ring;
	for (const [inside, cut] of edges) {
		const input = out;
		out = [];
		if (!input.length) break;
		let prev = input[input.length - 1];
		for (const cur of input) {
			if (inside(cur)) {
				if (!inside(prev)) out.push(cut(prev, cur));
				out.push(cur);
			} else if (inside(prev)) out.push(cut(prev, cur));
			prev = cur;
		}
	}
	return out;
};

/**
 * Pole of inaccessibility of the biggest projected polygon of `g` after
 * clipping to `rect`. Returns the point, its distance to the edge and the
 * clipped area (all in projected px).
 */
export const visualCentre = (p: GeoProjection, g: Geom, rect: [number, number, number, number]) => {
	let best: { rings: Ring[]; area: number } | null = null;
	for (const poly of polygonsOf(g)) {
		const rings = poly.map((r) => clipRing(projectRing(p, r), ...rect)).filter((r) => r.length >= 3);
		if (!rings.length) continue;
		const area = ringArea(rings[0]);
		if (!best || area > best.area) best = { rings, area };
	}
	if (!best) return null;
	const pt = polylabel(best.rings, 2) as unknown as XY & { distance: number };
	return { xy: [pt[0], pt[1]] as XY, distance: pt.distance, area: best.area };
};
