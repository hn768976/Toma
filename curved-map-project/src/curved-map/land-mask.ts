/**
 * Decodes the baked Natural Earth land mask and exposes land coverage lookups
 * in geographic coordinates. The decode runs once at module level.
 *
 * Map data: Natural Earth (naturalearthdata.com), public domain.
 */
import { LAND_MASK_BASE64, MASK_HEIGHT, MASK_WIDTH } from "./land-mask.data";

const decodeBase64 = (input: string): Uint8Array => {
  const binary = atob(input);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
};

const BITS = decodeBase64(LAND_MASK_BASE64);

const bitAt = (x: number, y: number): number => {
  if (y < 0 || y >= MASK_HEIGHT) return 0;
  let wrapped = x % MASK_WIDTH;
  if (wrapped < 0) wrapped += MASK_WIDTH;
  const index = y * MASK_WIDTH + wrapped;
  return (BITS[index >> 3] >> (index & 7)) & 1;
};

const colOf = (lon: number): number =>
  ((lon + 180) / 360) * MASK_WIDTH - 0.5;
const rowOf = (lat: number): number => ((90 - lat) / 180) * MASK_HEIGHT - 0.5;

/** True when the single mask cell containing this point is land. */
export const isLand = (lon: number, lat: number): boolean =>
  bitAt(Math.round(colOf(lon)), Math.round(rowOf(lat))) === 1;

/**
 * Fraction of a lon/lat box that is land, averaged over the mask cells it
 * covers. Used to soften coastlines rather than hard-thresholding them, which
 * would alias badly against the dot grid.
 */
export const landCoverage = (
  lon: number,
  lat: number,
  lonSpan: number,
  latSpan: number,
): number => {
  const x0 = Math.round(colOf(lon - lonSpan / 2));
  const x1 = Math.round(colOf(lon + lonSpan / 2));
  const y0 = Math.round(rowOf(lat + latSpan / 2));
  const y1 = Math.round(rowOf(lat - latSpan / 2));
  let hit = 0;
  let total = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      hit += bitAt(x, y);
      total++;
    }
  }
  return total === 0 ? 0 : hit / total;
};
