import type { LonLat } from '../rows';

export type Geom = { type: string; coordinates: unknown };

/** Shape of public/data/<id>.json, written by scripts/build-data.mjs. */
export type MapData = {
	id: string;
	window: [number, number, number, number];
	borders: Geom;
	coast: Geom;
	countries: {
		a3: string;
		name: string;
		disputed: boolean;
		labelrank: number;
		neighbours: number[];
		geometry: Geom;
	}[];
	places: { name: string; rank: number; pop: number; cls: string; a3: string; lonlat: LonLat }[];
	roads: { major: boolean; inside: boolean; geometry: Geom }[];
	rivers: { rank: number; geometry: Geom }[];
	lakes: { rank: number; geometry: Geom }[];
	disputed: { geometry: Geom }[];
};
