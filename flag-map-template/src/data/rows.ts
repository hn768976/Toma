// The template data. One row = one composition (FlagMap-<id>).
//
// Adding a country:  one row with kind 'country', its ISO code and a flag in
//                    src/flags/flags.ts.
// Adding a region:   one row with kind 'region', its members (ISO codes or a
//                    Natural Earth continent) and a fill colour.
import type {FlagId} from '../flags/flags';

/** [minLon, minLat, maxLon, maxLat]. Longitudes may exceed ±180 when the row sets centerLon. */
export type BBox = [number, number, number, number];

export type Member =
  | string
  | {
      /** ISO / Natural Earth ADM0_A3 code. */
      iso: string;
      /** Hard-clip this member's polygons to a lon/lat box (e.g. Russia west of the Urals). */
      clip?: BBox;
      /** Keep only this member's polygons whose centroid falls inside this box. */
      within?: BBox;
    };

export type Top =
  | {
      flag: FlagId;
      /** Point in the flag (0..1, from top-left) that should land inside the shape: the key emblem. */
      focus: {x: number; y: number};
      /** Where in the shape the focus point goes: its most interior point (default) or its bbox centre. */
      anchor?: 'interior' | 'center';
      /**
       * Scale relative to "cover" (default 1). Below 1 only for flags whose
       * emblem sits on a plain field: the field is extended with `pad` (its
       * own colour) so the whole emblem fits inside the shape (EU stars).
       */
      zoom?: number;
      pad?: string;
    }
  | {fill: string; side?: string};

export type Row = {
  id: string;
  label: string;
  kind: 'country' | 'region';
  /** Country: ISO code. */
  iso?: string;
  /** Natural Earth worldview to use for this country (default: Natural Earth default). */
  worldview?: 'IND' | 'PAK';
  /** Map scale. 50m is the default; 10m for very small countries. */
  scale?: '50m' | '10m';
  /** Region: explicit member list. */
  members?: Member[];
  /** Region: every Natural Earth feature on this continent (minus `exclude`). */
  continent?: string;
  exclude?: string[];
  /** Main territory: keep only polygons whose centroid falls inside this box. */
  within?: BBox;
  /** Drop islands smaller than this fraction of the shape's area (default 0.003). */
  minIsland?: number;
  /** Always keep the largest polygon of every member, however small (e.g. Malta in the EU). */
  keepAllMembers?: boolean;
  /** Centre longitude for antimeridian handling / projection (default: computed). */
  centerLon?: number;
  /** Projection override (default: chosen from the shape's extent and latitude). */
  projection?: 'conic' | 'mercator' | 'azimuthal' | 'polar-south';
  top: Top;
};

// ------------------------------------------------------------------ member lists
export const EU27 = [
  'AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'IRL',
  'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE',
];
// Natural Earth draws two de-facto areas separately; both are de-jure EU territory
// of member states (Northern Cyprus -> Cyprus, Åland -> Finland).
const EU_EXTRA = ['CYN', 'ALD'];

export const MIDDLE_EAST = [
  'SAU', 'KWT', 'BHR', 'QAT', 'ARE', 'OMN', // Gulf states
  'YEM', 'IRQ', 'IRN', 'SYR', 'LBN', 'JOR', 'ISR', 'PSE', 'TUR', 'EGY',
];
export const SOUTHEAST_ASIA = ['BRN', 'KHM', 'IDN', 'LAO', 'MYS', 'MMR', 'PHL', 'SGP', 'THA', 'TLS', 'VNM'];
// KAS = Siachen Glacier, drawn separately by Natural Earth between India and Pakistan.
export const SOUTH_ASIA = ['IND', 'PAK', 'BGD', 'LKA', 'NPL', 'BTN', 'MDV', 'AFG', 'KAS'];
export const SOUTH_AMERICA_COUNTRIES = ['ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'GUY', 'PRY', 'PER', 'SUR', 'URY', 'VEN'];
// French Guiana is part of France's Natural Earth feature; without it the
// continent would have a notch between Suriname and Brazil.
const FRENCH_GUIANA: Member = {iso: 'FRA', within: [-55, 1, -51, 7]};
export const LATIN_AMERICA = [
  'MEX', 'GTM', 'BLZ', 'SLV', 'HND', 'NIC', 'CRI', 'PAN', // Mexico + Central America
  'CUB', 'DOM', 'PRI', // Spanish/Portuguese-speaking Caribbean
  ...SOUTH_AMERICA_COUNTRIES,
];
export const NORDICS = ['DNK', 'FIN', 'ISL', 'NOR', 'SWE', 'ALD'];

// ------------------------------------------------------------------ regions
export const REGIONS: Row[] = [
  {
    id: 'EuropeanUnion', label: 'European Union', kind: 'region',
    members: [...EU27, ...EU_EXTRA], within: [-11, 34, 35, 71], minIsland: 0.0005, keepAllMembers: true,
    top: {flag: 'EU', focus: {x: 0.5, y: 0.54}, zoom: 0.4, pad: '#003399'},
  },
  {id: 'Africa', label: 'Africa', kind: 'region', continent: 'Africa', top: {fill: '#E8A33A'}},
  {
    id: 'Asia', label: 'Asia', kind: 'region', continent: 'Asia', exclude: ['RUS', 'IOA'], within: [25, -11, 150, 56],
    top: {fill: '#C8384A'},
  },
  {
    id: 'Europe', label: 'Europe', kind: 'region', continent: 'Europe', within: [-25, 34, 61, 71.5],
    members: [{iso: 'RUS', clip: [-180, 0, 60, 90]}], exclude: ['RUS'], minIsland: 0.001,
    top: {fill: '#2E4FB8'},
  },
  {
    id: 'NorthAmerica', label: 'North America', kind: 'region', continent: 'North America', centerLon: -100,
    top: {fill: '#1F9A9A'},
  },
  {
    id: 'SouthAmerica', label: 'South America', kind: 'region', members: [...SOUTH_AMERICA_COUNTRIES, FRENCH_GUIANA],
    within: [-82, -56, -34, 13],
    top: {fill: '#2FA05A'},
  },
  {
    id: 'Oceania', label: 'Oceania', kind: 'region', continent: 'Oceania', exclude: ['ATC'], centerLon: 150,
    within: [110, -48, 185, 0], minIsland: 0.0004,
    top: {fill: '#2A88D8'},
  },
  {
    id: 'Antarctica', label: 'Antarctica', kind: 'region', members: ['ATA'], projection: 'polar-south',
    top: {fill: '#DCEBF5', side: '#9DBBD6'},
  },
  {id: 'MiddleEast', label: 'Middle East', kind: 'region', members: MIDDLE_EAST, keepAllMembers: true, top: {fill: '#C8963A'}},
  {
    id: 'SoutheastAsia', label: 'Southeast Asia', kind: 'region', members: SOUTHEAST_ASIA, keepAllMembers: true,
    minIsland: 0.0015, top: {fill: '#1FA67A'},
  },
  {
    id: 'SouthAsia', label: 'South Asia', kind: 'region', members: SOUTH_ASIA, keepAllMembers: true,
    within: [60, 0, 98, 38], top: {fill: '#E87A2A'},
  },
  {
    id: 'LatinAmerica', label: 'Latin America', kind: 'region', members: [...LATIN_AMERICA, FRENCH_GUIANA],
    within: [-118, -56, -34, 33], top: {fill: '#E8604A'},
  },
  {
    id: 'Nordics', label: 'Nordic Countries', kind: 'region', members: NORDICS, keepAllMembers: true,
    within: [-25, 54, 32, 71.5], minIsland: 0.001, top: {fill: '#4A78A8'},
  },
];

// ------------------------------------------------------------------ countries
const c = (
  id: string, label: string, iso: string, flag: FlagId, focus: {x: number; y: number},
  extra: Partial<Row> = {}, anchor?: 'interior' | 'center',
): Row => ({
  id, label, kind: 'country', iso, top: {flag, focus, ...(anchor ? {anchor} : {})}, ...extra,
});

export const COUNTRIES: Row[] = [
  c('USA', 'United States', 'USA', 'USA', {x: 0.2, y: 0.27}, {within: [-125, 24, -66, 50]}),
  c('China', 'China', 'CHN', 'China', {x: 0.25, y: 0.3}),
  c('Japan', 'Japan', 'JPN', 'Japan', {x: 0.5, y: 0.5}, {within: [128, 30, 146, 46]}),
  c('Germany', 'Germany', 'DEU', 'Germany', {x: 0.5, y: 0.5}),
  c('UK', 'United Kingdom', 'GBR', 'UK', {x: 0.5, y: 0.5}, {within: [-9, 49, 2, 61]}, 'center'),
  c('India', 'India', 'IND', 'India', {x: 0.5, y: 0.5}, {worldview: 'IND', within: [67, 6, 98, 38]}),
  c('France', 'France', 'FRA', 'France', {x: 0.5, y: 0.5}, {within: [-6, 41, 10, 52]}),
  c('Italy', 'Italy', 'ITA', 'Italy', {x: 0.5, y: 0.5}),
  c('Canada', 'Canada', 'CAN', 'Canada', {x: 0.5, y: 0.52}, {}, 'center'),
  c('Brazil', 'Brazil', 'BRA', 'Brazil', {x: 0.5, y: 0.5}),
  c('Russia', 'Russia', 'RUS', 'Russia', {x: 0.5, y: 0.5}, {centerLon: 100, minIsland: 0.0008}),
  c('SouthKorea', 'South Korea', 'KOR', 'SouthKorea', {x: 0.5, y: 0.5}),
  c('Australia', 'Australia', 'AUS', 'Australia', {x: 0.44, y: 0.5}, {within: [112, -44, 154, -10]}, 'center'),
  c('Spain', 'Spain', 'ESP', 'Spain', {x: 0.3, y: 0.5}, {within: [-10, 35, 5, 44]}),
  c('Mexico', 'Mexico', 'MEX', 'Mexico', {x: 0.5, y: 0.5}),
  c('Indonesia', 'Indonesia', 'IDN', 'Indonesia', {x: 0.5, y: 0.5}, {minIsland: 0.0015}),
  c('Netherlands', 'Netherlands', 'NLD', 'Netherlands', {x: 0.5, y: 0.5}, {scale: '10m', within: [3, 50, 8, 54]}),
  c('UAE', 'United Arab Emirates', 'ARE', 'UAE', {x: 0.4, y: 0.5}, {scale: '10m'}),
  c('Turkiye', 'Türkiye', 'TUR', 'Turkiye', {x: 0.42, y: 0.5}),
  c('Switzerland', 'Switzerland', 'CHE', 'Switzerland', {x: 0.5, y: 0.5}, {scale: '10m'}),
  c('Argentina', 'Argentina', 'ARG', 'Argentina', {x: 0.5, y: 0.5}),
  c('SouthAfrica', 'South Africa', 'ZAF', 'SouthAfrica', {x: 0.4, y: 0.5}, {within: [15, -36, 34, -21]}),
  c('Nigeria', 'Nigeria', 'NGA', 'Nigeria', {x: 0.5, y: 0.5}),
  c('Egypt', 'Egypt', 'EGY', 'Egypt', {x: 0.5, y: 0.5}),
  c('Pakistan', 'Pakistan', 'PAK', 'Pakistan', {x: 0.625, y: 0.5}, {worldview: 'PAK'}),
];

export const ROWS: Row[] = [...REGIONS, ...COUNTRIES];
export const ROW_BY_ID: Record<string, Row> = Object.fromEntries(ROWS.map((r) => [r.id, r]));
