/**
 * Bakes the Natural Earth 1:50m admin-0 polygons for the 23 template countries
 * into the single data file src/countries.ts.
 *
 * Source: Natural Earth (public domain), via the `world-atlas` npm package,
 * which is a TopoJSON build of ne_50m_admin_0_countries.
 *
 * Boundaries are used AS PUBLISHED. This script never clips, edits or redraws a
 * ring. The only territory handling is whole-part inclusion/exclusion: a
 * disconnected part (island / overseas department) is either kept in full or
 * dropped in full, so nothing on screen is ever a partial, unfilled piece.
 */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {feature} from 'topojson-client';
import {geoCentroid} from 'd3-geo';

const COORD_PRECISION = 4; // ~11 m at the equator; far finer than a 4K pixel

/**
 * keep: undefined            -> every part of the Natural Earth unit is used
 * keep: {lon:[a,b], lat:[c,d]} -> only parts whose bbox centre falls inside the
 *                                 window are used; the rest are out of frame.
 */
const ROWS = [
  {code: 'US', name: 'United States',        ne: 'United States of America', projection: 'albersUsa',
   territories: 'all (50 states; Alaska and Hawaii shown as the standard Albers USA composite insets)'},
  {code: 'CN', name: 'China',                ne: 'China',                    projection: 'mercator',
   territories: 'all'},
  {code: 'IN', name: 'India',                ne: 'India',                    projection: 'mercator',
   territories: 'all (includes Andaman & Nicobar and Lakshadweep)'},
  {code: 'RU', name: 'Russia',               ne: 'Russia',                   projection: 'conicEqualArea',
   territories: 'all (incl. Kaliningrad, Franz Josef Land, Wrangel Island across the antimeridian)'},
  {code: 'JP', name: 'Japan',                ne: 'Japan',                    projection: 'mercator',
   territories: 'all'},
  {code: 'DE', name: 'Germany',              ne: 'Germany',                  projection: 'mercator',
   territories: 'all'},
  {code: 'GB', name: 'United Kingdom',       ne: 'United Kingdom',           projection: 'mercator',
   territories: 'all (Great Britain, Northern Ireland, Hebrides, Orkney, Shetland)'},
  {code: 'FR', name: 'France',               ne: 'France',                   projection: 'mercator',
   territories: 'metropolitan France + Corsica; overseas departments out of frame',
   keep: {lon: [-10, 12], lat: [40, 53]}},
  {code: 'BR', name: 'Brazil',               ne: 'Brazil',                   projection: 'mercator',
   territories: 'all'},
  {code: 'CA', name: 'Canada',               ne: 'Canada',                   projection: 'conicEqualArea',
   territories: 'all (incl. the Arctic Archipelago)'},
  {code: 'ID', name: 'Indonesia',            ne: 'Indonesia',                projection: 'mercator',
   territories: 'all (full archipelago)'},
  {code: 'MX', name: 'Mexico',               ne: 'Mexico',                   projection: 'mercator',
   territories: 'all'},
  {code: 'TR', name: 'Turkey',               ne: 'Turkey',                   projection: 'mercator',
   territories: 'all (Anatolia + East Thrace)'},
  {code: 'SA', name: 'Saudi Arabia',         ne: 'Saudi Arabia',             projection: 'mercator',
   territories: 'all'},
  {code: 'KR', name: 'South Korea',          ne: 'South Korea',              projection: 'mercator',
   territories: 'all (incl. Jeju)'},
  {code: 'AU', name: 'Australia',            ne: 'Australia',                projection: 'mercator',
   territories: 'mainland + Tasmania; Macquarie Island out of frame',
   keep: {lon: [100, 156], lat: [-50, 0]}},
  {code: 'IT', name: 'Italy',                ne: 'Italy',                    projection: 'mercator',
   territories: 'all (incl. Sicily, Sardinia, Pantelleria, Lampedusa)'},
  {code: 'ES', name: 'Spain',                ne: 'Spain',                    projection: 'mercator',
   territories: 'peninsula + Balearics + Ceuta/Melilla; Canary Islands out of frame',
   keep: {lon: [-12, 6], lat: [34, 45]}},
  {code: 'ZA', name: 'South Africa',         ne: 'South Africa',             projection: 'mercator',
   territories: 'mainland; Prince Edward Islands out of frame',
   keep: {lon: [10, 36], lat: [-40, -20]}},
  {code: 'PL', name: 'Poland',               ne: 'Poland',                   projection: 'mercator',
   territories: 'all'},
  {code: 'AE', name: 'United Arab Emirates', ne: 'United Arab Emirates',     projection: 'mercator',
   territories: 'all (incl. Gulf islands)'},
  {code: 'EG', name: 'Egypt',                ne: 'Egypt',                    projection: 'mercator',
   territories: 'all'},
  {code: 'AR', name: 'Argentina',            ne: 'Argentina',                projection: 'mercator',
   territories: 'all (incl. Tierra del Fuego and Isla de los Estados)'},
];

/** Per-country fit tweak. 1 = pure auto-fit from the projected bounding box. */
const SCALE_OVERRIDE = {};

const topo = JSON.parse(
  readFileSync(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url), 'utf8'),
);
const fc = feature(topo, topo.objects.countries);

const round = (v) => Number(v.toFixed(COORD_PRECISION));

const ringBboxCentre = (ring) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ring) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return [(x0 + x1) / 2, (y0 + y1) / 2];
};

const out = [];
for (const row of ROWS) {
  const f = fc.features.find((x) => x.properties.name === row.ne);
  if (!f) throw new Error(`Natural Earth unit not found: ${row.ne}`);

  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;

  const kept = polys.filter((poly) => {
    if (!row.keep) return true;
    const [cx, cy] = ringBboxCentre(poly[0]);
    const {lon, lat} = row.keep;
    return cx >= lon[0] && cx <= lon[1] && cy >= lat[0] && cy <= lat[1];
  });
  if (kept.length === 0) throw new Error(`keep window removed every part of ${row.ne}`);

  const coordinates = kept.map((poly) => poly.map((ring) => ring.map(([x, y]) => [round(x), round(y)])));
  const geometry = {type: 'MultiPolygon', coordinates};

  out.push({
    code: row.code,
    name: row.name,
    neName: row.ne,
    projection: row.projection,
    rotateLon: Number(geoCentroid(geometry)[0].toFixed(2)),
    territories: row.territories,
    scaleOverride: SCALE_OVERRIDE[row.code] ?? 1,
    partsInSource: polys.length,
    partsUsed: kept.length,
    geometry,
  });

  const vtx = coordinates.reduce((a, p) => a + p.reduce((b, r) => b + r.length, 0), 0);
  console.log(
    `${row.code} ${row.name.padEnd(22)} parts ${String(kept.length).padStart(3)}/${String(polys.length).padEnd(3)} vertices ${vtx}`,
  );
}

const header = `/**
 * GENERATED FILE - do not edit by hand. Run \`npm run bake\` to regenerate.
 *
 * The country list AND the Natural Earth geometry for all 23 template
 * countries, in one file.
 *
 * Geometry source: Natural Earth, 1:50m Cultural Vectors, Admin 0 - Countries
 * (naturalearthdata.com). Natural Earth is in the PUBLIC DOMAIN.
 * Delivered here via the \`world-atlas\` npm package, a TopoJSON build of the
 * same data. Boundaries are reproduced AS PUBLISHED: no ring is clipped,
 * edited or redrawn. Coordinates are rounded to ${COORD_PRECISION} decimal places
 * (~11 m), which is far below one pixel at 3840x2160.
 *
 * \`territories\` records, per country, whether every part of the Natural Earth
 * unit is drawn or whether disconnected parts are left out of frame. Parts are
 * only ever kept or dropped whole, so no partial, unfilled piece of the subject
 * country can appear on screen.
 */

export type ProjectionName = 'mercator' | 'conicEqualArea' | 'albersUsa';

export type MultiPolygon = {
  readonly type: 'MultiPolygon';
  readonly coordinates: number[][][][];
};

export type Country = {
  /** Stable short code; used to build the composition id, e.g. PL_GlitchMapGreen. */
  readonly code: string;
  /** Display name. Never rendered into the video - buyers add their own labels. */
  readonly name: string;
  /** The Natural Earth \`name\` property this geometry came from. */
  readonly neName: string;
  readonly projection: ProjectionName;
  /** Longitude the projection is rotated to, from the spherical centroid. */
  readonly rotateLon: number;
  /** Human-readable record of the territories decision. */
  readonly territories: string;
  /** Multiplies the auto-fit scale. 1 = pure auto-fit from the bounding box. */
  readonly scaleOverride: number;
  readonly partsInSource: number;
  readonly partsUsed: number;
  readonly geometry: MultiPolygon;
};

export const COUNTRIES: readonly Country[] = `;

mkdirSync(new URL('../src', import.meta.url), {recursive: true});
const body = JSON.stringify(out).replace(/\},\{"code"/g, '},\n{"code"');
writeFileSync(new URL('../src/countries.ts', import.meta.url), header + body + ' as const;\n');
console.log('\nwrote src/countries.ts');
