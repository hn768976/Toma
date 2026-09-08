// Fetches the public-domain Natural Earth source data the bake step reads.
// Nothing here runs at render time: the outputs are committed under
// src/data/geo and public/relief, and data/ is disposable.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');

const VECTOR = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const RASTER = 'https://raw.githubusercontent.com/nvkelso/natural-earth-raster/master/10m_rasters';

const FILES = [
  [`${VECTOR}/ne_10m_admin_0_countries.geojson`, 'ne_10m_admin_0_countries.geojson'],
  [`${VECTOR}/ne_10m_admin_0_boundary_lines_land.geojson`, 'ne_10m_admin_0_boundary_lines_land.geojson'],
  [`${VECTOR}/ne_10m_lakes.geojson`, 'ne_10m_lakes.geojson'],
  [`${VECTOR}/ne_10m_populated_places.geojson`, 'ne_10m_populated_places.geojson'],
  [`${VECTOR}/ne_50m_geography_marine_polys.geojson`, 'ne_50m_geography_marine_polys.geojson'],
  [`${RASTER}/SR_HR/SR_HR.tif`, 'SR_HR.tif'],
];

async function download(url, file) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return;
    } catch (err) {
      if (attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
    }
  }
}

// Minimal reader for the one TIFF shape Natural Earth ships SR_HR in:
// 8-bit, single band, uncompressed, stripped. Saves pulling in a GeoTIFF
// dependency for a single build-time conversion.
function tiffToRaw(tifPath, rawPath) {
  const buf = fs.readFileSync(tifPath);
  const le = buf.toString('ascii', 0, 2) === 'II';
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  if (u16(2) !== 42) throw new Error('not a classic TIFF');

  const tags = new Map();
  const ifd = u32(4);
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e);
    const type = u16(e + 2);
    const n = u32(e + 4);
    const size = {1: 1, 2: 1, 3: 2, 4: 4}[type] ?? 4;
    const at = n * size <= 4 ? e + 8 : u32(e + 8);
    const values = [];
    for (let k = 0; k < n; k++) {
      const o = at + k * size;
      values.push(size === 2 ? u16(o) : size === 4 ? u32(o) : buf[o]);
    }
    tags.set(tag, values);
  }

  const width = tags.get(256)[0];
  const height = tags.get(257)[0];
  const bits = tags.get(258)?.[0] ?? 1;
  const compression = tags.get(259)?.[0] ?? 1;
  const samples = tags.get(277)?.[0] ?? 1;
  if (bits !== 8 || compression !== 1 || samples !== 1) {
    throw new Error(
      `unsupported TIFF (bits=${bits} compression=${compression} samples=${samples}); ` +
        'convert SR_HR.tif to a raw 8-bit band yourself and save it as data/SR_HR.raw',
    );
  }

  const offsets = tags.get(273);
  const counts = tags.get(279);
  const out = Buffer.alloc(width * height);
  let at = 0;
  for (let i = 0; i < offsets.length; i++) {
    buf.copy(out, at, offsets[i], offsets[i] + counts[i]);
    at += counts[i];
  }
  if (at !== out.length) throw new Error(`decoded ${at} bytes, expected ${out.length}`);
  fs.writeFileSync(rawPath, out);
}

export async function ensureSources() {
  fs.mkdirSync(DATA_DIR, {recursive: true});
  for (const [url, name] of FILES) {
    const file = path.join(DATA_DIR, name);
    if (name === 'SR_HR.tif' && fs.existsSync(path.join(DATA_DIR, 'SR_HR.raw'))) continue;
    if (fs.existsSync(file) && fs.statSync(file).size > 0) continue;
    console.log(`downloading ${name}…`);
    await download(url, file);
  }
  const raw = path.join(DATA_DIR, 'SR_HR.raw');
  if (!fs.existsSync(raw)) {
    console.log('decoding SR_HR.tif → SR_HR.raw…');
    tiffToRaw(path.join(DATA_DIR, 'SR_HR.tif'), raw);
  }
}
