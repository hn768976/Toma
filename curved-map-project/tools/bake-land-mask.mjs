/**
 * Bakes the Natural Earth 50m land polygons into a bit-packed equirectangular
 * land mask, emitted as a base64 string in src/curved-map/land-mask.data.ts.
 *
 * Run with: node tools/bake-land-mask.mjs
 *
 * Source data: Natural Earth (naturalearthdata.com), public domain.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const MASK_W = 1200;
const MASK_H = 600;

const geo = JSON.parse(
  readFileSync(join(root, "assets", "ne_50m_land.geojson"), "utf8"),
);

/** Every linear ring in the file, flattened out of Polygon / MultiPolygon. */
const rings = [];
for (const feature of geo.features) {
  const g = feature.geometry;
  if (!g) continue;
  if (g.type === "Polygon") {
    for (const ring of g.coordinates) rings.push(ring);
  } else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates) for (const ring of poly) rings.push(ring);
  }
}

/**
 * Scanline fill with the even-odd rule. Holes in the source data are just
 * extra rings, so even-odd punches them out without tracking winding.
 */
const bits = new Uint8Array(Math.ceil((MASK_W * MASK_H) / 8));
const setBit = (index) => {
  bits[index >> 3] |= 1 << (index & 7);
};

for (let y = 0; y < MASK_H; y++) {
  const lat = 90 - ((y + 0.5) / MASK_H) * 180;
  const crossings = [];
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi === yj) continue;
      if (lat < Math.min(yi, yj) || lat >= Math.max(yi, yj)) continue;
      crossings.push(xi + ((lat - yi) / (yj - yi)) * (xj - xi));
    }
  }
  if (crossings.length === 0) continue;
  crossings.sort((a, b) => a - b);
  for (let k = 0; k + 1 < crossings.length; k += 2) {
    const lonStart = crossings[k];
    const lonEnd = crossings[k + 1];
    // Convert the lon span to grid columns (cell centres).
    let x0 = Math.ceil(((lonStart + 180) / 360) * MASK_W - 0.5);
    let x1 = Math.floor(((lonEnd + 180) / 360) * MASK_W - 0.5);
    if (x0 < 0) x0 = 0;
    if (x1 > MASK_W - 1) x1 = MASK_W - 1;
    const rowBase = y * MASK_W;
    for (let x = x0; x <= x1; x++) setBit(rowBase + x);
  }
}

let land = 0;
for (const byte of bits) {
  for (let b = 0; b < 8; b++) if (byte & (1 << b)) land++;
}

const base64 = Buffer.from(bits).toString("base64");
const chunks = base64.match(/.{1,120}/g) ?? [];

const out = `/**
 * Bit-packed equirectangular land mask, baked from Natural Earth 50m land
 * polygons by tools/bake-land-mask.mjs. Do not edit by hand.
 *
 * ${MASK_W}x${MASK_H} cells, row-major from lat +90 down to -90 and lon -180
 * to +180. Bit n of byte n>>3 is set when that cell is land.
 *
 * Map data: Natural Earth (naturalearthdata.com), public domain.
 */

export const MASK_WIDTH = ${MASK_W};
export const MASK_HEIGHT = ${MASK_H};

export const LAND_MASK_BASE64 =
${chunks.map((c) => `  "${c}"`).join(" +\n")};
`;

writeFileSync(join(root, "src", "curved-map", "land-mask.data.ts"), out);
console.log(
  `baked ${MASK_W}x${MASK_H} mask, ${land} land cells (${((land / (MASK_W * MASK_H)) * 100).toFixed(1)}%), ${base64.length} base64 chars`,
);
