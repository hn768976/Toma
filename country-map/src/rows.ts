import rows from './countries.json';

export type LonLat = [number, number];

/** One data row = one composition. See README "How to add a new country". */
export type CountryRow = {
	/** Composition suffix: CountryMap_<id>. Also the data file public/data/<id>.json. */
	id: string;
	/** Natural Earth ADM0_A3 code of the featured country. */
	iso: string;
	/** Printed country name (English, caps). */
	label: string;
	/** Lon/lat box [west, south, east, north] the shot is framed on. */
	frame: [number, number, number, number];
	/** Central meridian of the conic. Defaults to the frame's centre longitude. */
	projectionCenter?: number;
	/** Standard parallels. Default: 1/6 and 5/6 of the frame's latitude span. */
	parallels?: [number, number];
	/** 'country' (default): the featured land inside `frame` fills 55% of the texture
	 * width. 'frame': the frame box itself fills 55%. */
	fitTo?: 'country' | 'frame';
	/** Where the country name goes. Default: pole of inaccessibility of the
	 * largest projected polygon inside the frame. */
	labelLonLat?: LonLat;
	/** Optional printed area [west, south, east, north] in lon/lat: like an atlas
	 * page, the map stops at this graticule-bounded neatline and the sheet beyond
	 * is blank paper. Use it to keep things out of view (e.g. Alaska for USA). */
	printArea?: [number, number, number, number];
	/** Shot width relative to the reference (Mexico = 1). >1 pulls back for compact
	 * countries so neighbours stay in view; label sizes scale with it so text keeps
	 * its on-screen size. */
	zoom?: number;
	/** Place-label overrides: Natural Earth name -> printed name, or null to hide. */
	placeNames?: Record<string, string | null>;
	/** Camera offsets in frame widths [lateral, forward] and yaw (start, end) in
	 * degrees, applied on top of baseYaw (the sheet's rotation under the camera). */
	camera: { start: [number, number]; end: [number, number]; yaw: [number, number]; baseYaw?: number };
	note?: string;
};

export const COUNTRY_ROWS = rows as CountryRow[];
