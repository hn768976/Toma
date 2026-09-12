/**
 * Renders the halftone world map used by the DataNetwork board into
 * `public/world-dots.png` (white dots on transparency).
 *
 * The component tints/masks that PNG, so the same asset serves every theme
 * and the render stays cheap: one bitmap instead of ~20k live SVG circles.
 *
 * Run with: npm run generate:map
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { feature } from "topojson-client";
import land110m from "world-atlas/land-50m.json" with { type: "json" };

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "world-dots.png");

// Equirectangular window. Antarctica and the high Arctic are cropped the way
// broadcast "world data" graphics usually crop them.
const LON_MIN = -180;
const LON_MAX = 180;
const LAT_MAX = 73;
const LAT_MIN = -56;

// Dot grid resolution across the full window.
const COLS = 440;
const ROWS = Math.round((COLS * (LAT_MAX - LAT_MIN)) / (LON_MAX - LON_MIN));

// Output bitmap: dot pitch in pixels. 16px pitch keeps dots crisp when the
// map is blown up across a 4K board.
const PITCH = 16;
const RADIUS = 5.1;

const WIDTH = COLS * PITCH;
const HEIGHT = ROWS * PITCH;

const landFeature = feature(land110m, land110m.objects.land);
const polygons = [];

const pushPolygon = (rings) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  polygons.push({ rings, minX, minY, maxX, maxY });
};

for (const geometry of landFeature.features) {
  const { type, coordinates } = geometry.geometry;
  if (type === "Polygon") {
    pushPolygon(coordinates);
  } else if (type === "MultiPolygon") {
    for (const rings of coordinates) pushPolygon(rings);
  }
}

const ringContains = (ring, lon, lat) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat) {
      const cross = ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (lon < cross) inside = !inside;
    }
  }
  return inside;
};

const isLand = (lon, lat) => {
  for (const poly of polygons) {
    if (lon < poly.minX || lon > poly.maxX || lat < poly.minY || lat > poly.maxY) {
      continue;
    }
    // Ring 0 is the outer ring, the rest are holes (lakes).
    if (!ringContains(poly.rings[0], lon, lat)) continue;
    let inHole = false;
    for (let r = 1; r < poly.rings.length; r++) {
      if (ringContains(poly.rings[r], lon, lat)) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
};

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");
ctx.clearRect(0, 0, WIDTH, HEIGHT);
ctx.fillStyle = "#ffffff";

let drawn = 0;
for (let row = 0; row < ROWS; row++) {
  const lat = LAT_MAX - ((row + 0.5) / ROWS) * (LAT_MAX - LAT_MIN);
  const cols = [];
  for (let col = 0; col < COLS; col++) {
    const lon = LON_MIN + ((col + 0.5) / COLS) * (LON_MAX - LON_MIN);
    if (isLand(lon, lat)) cols.push(col);
  }
  // Rings that wrap the pole make ray casting report land at every longitude.
  // No real latitude in this window is solid land, so drop those rows.
  if (cols.length > COLS * 0.95) continue;
  for (const col of cols) {
    ctx.beginPath();
    ctx.arc(col * PITCH + PITCH / 2, row * PITCH + PITCH / 2, RADIUS, 0, Math.PI * 2);
    ctx.fill();
    drawn++;
  }
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, await canvas.encode("png"));

console.log(
  `world-dots.png  ${WIDTH}x${HEIGHT}  grid ${COLS}x${ROWS}  ${drawn} land dots`,
);
