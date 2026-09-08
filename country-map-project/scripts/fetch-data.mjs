/**
 * Downloads the public-domain source data into .cache/.
 *
 * You only need this if you are rebuilding the baked assets from scratch. The
 * shipped project already contains everything the compositions read at render
 * time — nothing is fetched while rendering.
 *
 *   node scripts/fetch-data.mjs
 *
 * Sources, all public domain:
 *   Natural Earth vectors  — github.com/nvkelso/natural-earth-vector (1:50m)
 *   Natural Earth rasters  — naturalearth.s3.amazonaws.com (official mirror)
 *   NASA Blue Marble       — eoimages.gsfc.nasa.gov (see SATELLITE below)
 *   Country flags          — github.com/hampusborgos/country-flags (Wikimedia-sourced)
 */

import {mkdir, stat, writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache');

const NE_GEOJSON =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const NE_S3 = 'https://naturalearth.s3.amazonaws.com';
const FLAGS = 'https://raw.githubusercontent.com/hampusborgos/country-flags/main/svg';

const VECTORS = [
  'ne_50m_admin_0_countries',
  'ne_50m_admin_0_boundary_lines_land',
  'ne_50m_land',
  'ne_10m_populated_places',
  'ne_50m_coastline',
  'ne_50m_ocean',
  'ne_50m_lakes',
  'ne_50m_geography_marine_polys',
];

/**
 * The satellite base for V3.
 *
 * PREFERRED — NASA Blue Marble Next Generation, 21600x10800 (~500 m/px), public
 * domain. This is what the brief specifies. If your network can reach NASA, set
 * SATELLITE=bluemarble and the builder will use it automatically.
 *
 * FALLBACK — Natural Earth II with shaded relief and water, 21600x10800, public
 * domain, from the official Natural Earth mirror. Same pixel grid, same
 * projection, natural-colour land. Used when eoimages.gsfc.nasa.gov is
 * unreachable. See README → "Satellite base".
 */
const SATELLITE = process.env.SATELLITE ?? 'auto';
const BLUE_MARBLE =
  'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x21600x10800.jpg';

const FLAG_CODES = [
  'us', 'cn', 'in', 'ru', 'jp', 'de', 'gb', 'fr', 'br', 'ca', 'id', 'mx', 'tr',
  'sa', 'kr', 'au', 'it', 'es', 'za', 'pl', 'nl', 'ae', 'sg', 'vn', 'ng', 'eg',
  'ar', 'se', 'th', 'ph', 'ch', 'no', 'cl',
];

const exists = async (p) => {
  try {
    return (await stat(p)).size > 0;
  } catch {
    return false;
  }
};

const download = async (url, dest, {optional = false} = {}) => {
  if (await exists(dest)) {
    console.log(`  cached  ${path.basename(dest)}`);
    return true;
  }
  process.stdout.write(`  get     ${path.basename(dest)} ... `);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
      console.log('ok');
      return true;
    } catch (err) {
      if (attempt === 3) {
        console.log(`failed (${err.message})`);
        if (optional) return false;
        throw err;
      }
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
  return false;
};

const main = async () => {
  await mkdir(path.join(CACHE, 'flags'), {recursive: true});

  console.log('Natural Earth vectors (1:50m):');
  for (const name of VECTORS) {
    await download(`${NE_GEOJSON}/${name}.geojson`, path.join(CACHE, `${name}.geojson`));
  }

  console.log('Natural Earth rasters:');
  await download(`${NE_S3}/10m_raster/GRAY_HR_SR_W.zip`, path.join(CACHE, 'GRAY_HR_SR_W.zip'));

  console.log('Satellite base:');
  let satellite = null;
  if (SATELLITE !== 'naturalearth') {
    const ok = await download(BLUE_MARBLE, path.join(CACHE, 'bluemarble.jpg'), {
      optional: SATELLITE === 'auto',
    });
    if (ok) satellite = 'bluemarble';
  }
  if (!satellite) {
    console.log('  NASA Blue Marble unavailable — falling back to Natural Earth II.');
    await download(`${NE_S3}/10m_raster/NE2_HR_LC_SR_W.zip`, path.join(CACHE, 'NE2_HR_LC_SR_W.zip'));
    satellite = 'naturalearth';
  }
  await writeFile(path.join(CACHE, 'satellite-source.json'), JSON.stringify({satellite}, null, 2));

  console.log('Flags:');
  for (const code of FLAG_CODES) {
    await download(`${FLAGS}/${code}.svg`, path.join(CACHE, 'flags', `${code}.svg`));
  }

  console.log('\nDone. Unzip the rasters, then run: npm run build:assets');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
