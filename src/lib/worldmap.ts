/**
 * A coarse dot-matrix world map. Landmasses are stored as rough lon/lat
 * polygons and rasterised once into a grid of cells; the result is cached
 * because it never changes between frames.
 *
 * The outlines are hand-drawn approximations - detailed enough to read as a
 * world map at panel size, nowhere near accurate enough to be a data source.
 */

type Poly = [number, number][];

const LAND: Poly[] = [
	// North America
	[
		[-168, 66], [-150, 70], [-125, 70], [-95, 73], [-80, 73], [-62, 60],
		[-55, 47], [-70, 42], [-80, 25], [-97, 16], [-105, 20], [-118, 30],
		[-125, 40], [-125, 48], [-140, 60],
	],
	// Greenland
	[[-55, 60], [-42, 61], [-20, 70], [-25, 82], [-45, 83], [-58, 76]],
	// South America
	[
		[-81, 10], [-60, 12], [-50, 0], [-35, -6], [-38, -22], [-48, -25],
		[-58, -38], [-65, -45], [-73, -52], [-75, -45], [-71, -30], [-70, -18],
		[-81, -5],
	],
	// Africa
	[
		[-17, 15], [0, 20], [12, 32], [25, 32], [35, 30], [43, 12], [51, 12],
		[43, -2], [40, -15], [35, -25], [25, -34], [18, -34], [12, -18],
		[9, -1], [0, 5], [-8, 5],
	],
	// Europe
	[
		[-10, 36], [-9, 44], [-5, 48], [0, 51], [5, 58], [12, 56], [20, 60],
		[30, 66], [40, 66], [45, 55], [40, 45], [28, 40], [22, 38], [15, 38],
		[8, 44], [3, 42], [-2, 36],
	],
	// Asia
	[
		[45, 55], [60, 70], [80, 74], [105, 77], [130, 72], [150, 70],
		[170, 68], [180, 64], [180, 55], [160, 55], [142, 45], [130, 35],
		[122, 30], [110, 20], [100, 10], [95, 15], [80, 8], [72, 20],
		[62, 25], [58, 38], [50, 40], [45, 45],
	],
	// Australia
	[
		[113, -22], [130, -11], [142, -11], [150, -20], [153, -28], [147, -38],
		[135, -35], [125, -33], [115, -34],
	],
	// British Isles
	[[-8, 51], [-2, 51], [-1, 58], [-6, 58]],
	// Japan
	[[130, 32], [141, 40], [145, 44], [140, 36], [134, 33]],
	// Madagascar
	[[43, -13], [50, -16], [48, -25], [44, -20]],
	// New Zealand
	[[166, -46], [174, -41], [178, -37], [172, -42]],
	// Indonesia / Borneo
	[[95, 5], [119, 6], [125, 0], [112, -8], [100, -3]],
	// Papua New Guinea
	[[131, -2], [150, -6], [147, -10], [134, -8]],
];

const pointInPoly = (px: number, py: number, poly: Poly) => {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const [xi, yi] = poly[i];
		const [xj, yj] = poly[j];
		if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}
	return inside;
};

export type MapCell = {col: number; row: number};

const cache = new Map<string, MapCell[]>();

/**
 * Rasterise the land polygons onto a `cols` x `rows` grid.
 * Latitude spans 82N..-56S, longitude -180..180.
 */
export const worldMapCells = (cols: number, rows: number): MapCell[] => {
	const key = `${cols}x${rows}`;
	const hit = cache.get(key);
	if (hit) return hit;
	const cells: MapCell[] = [];
	for (let row = 0; row < rows; row++) {
		const lat = 82 - ((row + 0.5) / rows) * 138;
		for (let col = 0; col < cols; col++) {
			const lon = -180 + ((col + 0.5) / cols) * 360;
			if (LAND.some((poly) => pointInPoly(lon, lat, poly))) {
				cells.push({col, row});
			}
		}
	}
	cache.set(key, cells);
	return cells;
};
