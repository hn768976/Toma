/**
 * city-layout.ts — deterministic, seeded generation of the city.
 *
 * Everything here is a pure function of the string seed. It is called once
 * (from a `useMemo` in WireCity.tsx) and the result is shared by all three
 * variants, so the three versions show the *same city* from different
 * cameras with different treatments.
 *
 * Randomness comes exclusively from Remotion's `random()`, never Math.random,
 * so the layout is byte-identical on every render and on every machine.
 */

import {random} from 'remotion';

/* ── grid constants ─────────────────────────────────────────────────── */

/** Cells per side of the lattice. */
export const GRID_N = 24;
/** World units per lattice cell. */
export const CELL = 14;
/**
 * Street period. Cells where `i % BLOCK === BLOCK - 1` are left empty, which
 * carves regular streets through the grid so the layout reads as blocks.
 */
export const BLOCK = 4;
/** Radius over which density and height fall off toward the outskirts. */
export const CITY_RADIUS = 150;
/** Half-extent of the lattice in world units. */
export const CITY_EXTENT = ((GRID_N - 1) / 2) * CELL;
/**
 * Height of the tallest landmark tower. Declared as a constant (rather than
 * measured from the generated layout) so the camera paths can be written
 * without depending on the layout — they only need to know how tall the city
 * gets.
 */
export const CITY_TOP = 165;

/** Clearance kept between every camera ground-track sample and any building. */
const CAMERA_CLEARANCE = 6.5;

export type Building = {
	/** Lattice indices, used only for seeding. */
	i: number;
	j: number;
	/** Footprint centre in world units. */
	x: number;
	z: number;
	/** Footprint size. */
	w: number;
	d: number;
	/** Height in world units. Base sits on y = 0. */
	h: number;
	/** h / CITY_TOP, clamped — drives the edge-brightness ramp. */
	heightNorm: number;
	isLandmark: boolean;
};

export type CityLayout = {
	buildings: Building[];
	/** Tallest building actually generated. */
	maxHeight: number;
	/** How many buildings the camera-corridor pass removed. */
	clearedForCamera: number;
};

/** The four landmark towers, as lattice cells near the centre. */
const LANDMARK_CELLS: {i: number; j: number; h: number}[] = [
	{i: 12, j: 12, h: CITY_TOP},
	{i: 9, j: 14, h: 141},
	{i: 14, j: 9, h: 128},
	{i: 16, j: 13, h: 116},
];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** World-space coordinate of lattice index `i`. */
const cellCoord = (i: number) => (i - (GRID_N - 1) / 2) * CELL;

/** True when the lattice cell is a street rather than a building plot. */
export const isStreetCell = (i: number) => i % BLOCK === BLOCK - 1;

/** World coordinate of the street running at lattice index `i`. */
export const streetCoord = (i: number) => cellCoord(i);

export type GroundTrackSample = {x: number; z: number; y: number};

/**
 * Generate the city.
 *
 * @param seed          seed string for `random()`
 * @param cameraTrack   sampled ground positions of every camera path. Any
 *                      building whose footprint comes within CAMERA_CLEARANCE
 *                      of a sample that is below the building's roof is
 *                      removed, which guarantees the camera is never inside a
 *                      building on any variant — including at frame 0.
 */
export const generateCity = (
	seed: string,
	cameraTrack: GroundTrackSample[],
): CityLayout => {
	const candidates: Building[] = [];

	for (let i = 0; i < GRID_N; i++) {
		if (isStreetCell(i)) continue;
		for (let j = 0; j < GRID_N; j++) {
			if (isStreetCell(j)) continue;

			const landmark = LANDMARK_CELLS.find((l) => l.i === i && l.j === j);

			const baseX = cellCoord(i);
			const baseZ = cellCoord(j);
			const dist = Math.hypot(baseX, baseZ);
			// 1 at the centre, 0 at CITY_RADIUS and beyond.
			const core = clamp01(1 - dist / CITY_RADIUS);

			// Density: dense centre, sparse outskirts.
			const keep = random(`keep-${i}-${j}-${seed}`);
			if (!landmark && keep > 0.28 + 0.72 * Math.pow(core, 0.38)) continue;

			// Height: power distribution (many low, a few very tall), then
			// scaled down toward the outskirts.
			const r = random(`h-${i}-${j}-${seed}`);
			const raw = 5 + 96 * Math.pow(r, 1.9);
			let h = raw * (0.3 + 1.0 * Math.pow(core, 1.3));
			h = Math.max(3.5, h);
			if (landmark) h = landmark.h;

			const w = CELL * (0.42 + 0.34 * random(`w-${i}-${j}-${seed}`));
			const d = CELL * (0.42 + 0.34 * random(`d-${i}-${j}-${seed}`));

			const jx = (random(`jx-${i}-${j}-${seed}`) - 0.5) * (CELL - w) * 0.8;
			const jz = (random(`jz-${i}-${j}-${seed}`) - 0.5) * (CELL - d) * 0.8;

			candidates.push({
				i,
				j,
				x: baseX + jx,
				z: baseZ + jz,
				w,
				d,
				h,
				heightNorm: clamp01(h / CITY_TOP),
				isLandmark: Boolean(landmark),
			});
		}
	}

	// Camera-corridor pass — see the doc comment on `cameraTrack` above.
	const buildings = candidates.filter((b) => {
		const hw = b.w / 2 + CAMERA_CLEARANCE;
		const hd = b.d / 2 + CAMERA_CLEARANCE;
		for (const s of cameraTrack) {
			if (s.y > b.h + CAMERA_CLEARANCE) continue; // camera flies over it
			if (Math.abs(s.x - b.x) < hw && Math.abs(s.z - b.z) < hd) return false;
		}
		return true;
	});

	return {
		buildings,
		maxHeight: buildings.reduce((m, b) => Math.max(m, b.h), 0),
		clearedForCamera: candidates.length - buildings.length,
	};
};

/* ── derived geometry ───────────────────────────────────────────────── */

/**
 * The 12 edges of every building, flattened into the pair-per-segment layout
 * `LineSegmentsGeometry.setPositions` expects (6 floats per segment).
 *
 * All 180 buildings go into ONE geometry, so the whole wireframe city is a
 * single instanced draw call rather than 180 separate Line objects.
 */
export const buildEdgePositions = (buildings: Building[]): Float32Array => {
	const out = new Float32Array(buildings.length * 12 * 6);
	let o = 0;

	for (const b of buildings) {
		const x0 = b.x - b.w / 2;
		const x1 = b.x + b.w / 2;
		const z0 = b.z - b.d / 2;
		const z1 = b.z + b.d / 2;
		const y0 = 0;
		const y1 = b.h;

		const seg = (
			ax: number,
			ay: number,
			az: number,
			bx: number,
			by: number,
			bz: number,
		) => {
			out[o++] = ax;
			out[o++] = ay;
			out[o++] = az;
			out[o++] = bx;
			out[o++] = by;
			out[o++] = bz;
		};

		// bottom ring
		seg(x0, y0, z0, x1, y0, z0);
		seg(x1, y0, z0, x1, y0, z1);
		seg(x1, y0, z1, x0, y0, z1);
		seg(x0, y0, z1, x0, y0, z0);
		// top ring
		seg(x0, y1, z0, x1, y1, z0);
		seg(x1, y1, z0, x1, y1, z1);
		seg(x1, y1, z1, x0, y1, z1);
		seg(x0, y1, z1, x0, y1, z0);
		// verticals
		seg(x0, y0, z0, x0, y1, z0);
		seg(x1, y0, z0, x1, y1, z0);
		seg(x1, y0, z1, x1, y1, z1);
		seg(x0, y0, z1, x0, y1, z1);
	}

	return out;
};

/**
 * Per-segment colours, matching `buildEdgePositions` (6 floats per segment:
 * rgb at each end). `mix` receives the building's normalised height and
 * returns the linear rgb to use.
 */
export const buildEdgeColors = (
	buildings: Building[],
	mix: (heightNorm: number, b: Building) => [number, number, number],
): Float32Array => {
	const out = new Float32Array(buildings.length * 12 * 6);
	let o = 0;
	for (const b of buildings) {
		const [r, g, bl] = mix(b.heightNorm, b);
		for (let e = 0; e < 12; e++) {
			out[o++] = r;
			out[o++] = g;
			out[o++] = bl;
			out[o++] = r;
			out[o++] = g;
			out[o++] = bl;
		}
	}
	return out;
};
