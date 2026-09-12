// Rasterizes the world-atlas land outline into a regular lon/lat lattice of
// "LED" dots and bakes the result into a TypeScript source file, so the
// Remotion project ships the geometry as plain data and needs no geo
// dependency (or network) at render time.
//
// Run from the scratchpad:  node gen-world-dots.mjs <outfile.ts>
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";

const OUT = process.argv[2];
if (!OUT) throw new Error("usage: node gen-world-dots.mjs <outfile.ts>");

// Lattice step, in degrees. Smaller = denser dot matrix.
const STEP = 1.7;
// Latitude window. Cuts Antarctica and the empty high Arctic so the map
// fills the frame the way the reference footage does.
const LAT_MIN = -57;
const LAT_MAX = 83;
const LON_MIN = -180;
const LON_MAX = 180;

const topo = JSON.parse(
  readFileSync(
    process.env.WORLD_ATLAS_LAND ??
      new URL("../node_modules/world-atlas/land-50m.json", import.meta.url),
  ),
);
const land = feature(topo, topo.objects.land);

// Natural Earth's land outlines are NOT cut at the antimeridian: Eurasia
// (and a handful of Pacific islands) have rings whose longitudes jump from
// +180 to -180 mid-ring. Ray-casting such a ring as if it were a flat
// polygon smears it into a band across every longitude, which marks whole
// oceans as land. So unwrap each ring first - walk it adding +/-360
// wherever a step would exceed 180 degrees - which turns it back into a
// simple polygon in a continuous longitude window (possibly outside
// [-180, 180]). The sample point is then shifted into that same window
// before testing.
const unwrapRing = (ring) => {
  const out = [];
  let prev = null;
  for (const [lon, lat] of ring) {
    let x = lon;
    if (prev !== null) {
      while (x - prev > 180) x -= 360;
      while (prev - x > 180) x += 360;
    }
    out.push([x, lat]);
    prev = x;
  }
  return out;
};

const meanLon = (ring) =>
  ring.reduce((acc, p) => acc + p[0], 0) / (ring.length || 1);

// Flatten every polygon into { rings, bbox } so a point only gets tested
// against the polygons whose bounding box could contain it.
const polygons = [];
const collect = (geom) => {
  if (geom.type === "Polygon") addPolygon(geom.coordinates);
  else if (geom.type === "MultiPolygon") geom.coordinates.forEach(addPolygon);
};
const addPolygon = (rawRings) => {
  // The exterior ring establishes the longitude window; every hole is
  // unwrapped too, then slid by whole turns into that same window so the
  // even-odd test below sees one coherent polygon.
  const exterior = unwrapRing(rawRings[0]);
  const anchor = meanLon(exterior);
  const rings = [exterior];
  for (let i = 1; i < rawRings.length; i++) {
    const hole = unwrapRing(rawRings[i]);
    const turns = Math.round((anchor - meanLon(hole)) / 360);
    rings.push(turns === 0 ? hole : hole.map(([x, y]) => [x + turns * 360, y]));
  }

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
for (const f of land.features ?? [land]) collect(f.geometry ?? f);

// Even-odd crossing test across every ring of one polygon, which handles
// interior rings (lakes) without a separate hole pass.
const inPolygon = (poly, x, y) => {
  if (x < poly.minX || x > poly.maxX || y < poly.minY || y > poly.maxY) {
    return false;
  }
  let inside = false;
  for (const ring of poly.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
};

// The TopoJSON is quantized, so a lattice latitude can land exactly on the
// quantization grid and put ring vertices right on the scanline. Probe a
// hair off-lattice (by an offset that is not a multiple of the quantization
// step) so a sample point never coincides with a vertex.
const PROBE_DLON = 0.000713;
const PROBE_DLAT = 0.000431;

// A polygon lives in an unwrapped longitude window, so the sample point has
// to be tried at lon, lon-360 and lon+360 to find its representative there.
const TURNS = [0, -360, 360];

const isLand = (lon, lat) => {
  const x = lon + PROBE_DLON;
  const y = lat + PROBE_DLAT;
  for (const poly of polygons) {
    if (y < poly.minY || y > poly.maxY) continue;
    for (const turn of TURNS) {
      const xs = x + turn;
      if (xs < poly.minX || xs > poly.maxX) continue;
      if (inPolygon(poly, xs, y)) return true;
    }
  }
  return false;
};

// Sanity net for the antimeridian handling above: a wrapped ring that gets
// ray-cast flat reads as land across a whole latitude band, which is easy to
// miss by eye on a stylised dot map. Fail the build instead.
const SELFTEST = [
  // Open ocean - must be false.
  [0, 71.1, false, "Norwegian Sea"],
  [0, 0, false, "Gulf of Guinea / Null Island"],
  [-30, 40, false, "mid Atlantic"],
  [-150, 0, false, "central Pacific"],
  [170, 0, false, "west Pacific"],
  [80, -20, false, "Indian Ocean"],
  [-40, -20, false, "South Atlantic"],
  [-170, 60, false, "Bering Sea"],
  [150, 55, false, "Sea of Okhotsk"],
  [-25, 30, false, "east Atlantic"],
  // Land - must be true.
  [20, 5, true, "Congo basin"],
  [10, 0, true, "Gabon (coast sits just west of 10E)"],
  [-100, 40, true, "Kansas"],
  [100, 47, true, "Mongolia"],
  [134, -25, true, "central Australia"],
  [-60, -10, true, "Amazonia"],
  [-45, 72, true, "Greenland"],
  [78, 22, true, "central India"],
  [10, 50, true, "Germany"],
  [-150, 65, true, "interior Alaska"],
  [175, 66, true, "Chukotka (past the antimeridian)"],
];

const failures = SELFTEST.filter(
  ([lon, lat, expected]) => isLand(lon, lat) !== expected,
).map(
  ([lon, lat, expected, name]) =>
    `  ${name} (${lon}, ${lat}): expected ${expected ? "land" : "ocean"}`,
);
if (failures.length > 0) {
  throw new Error(
    `land lookup self-test failed:\n${failures.join("\n")}\n` +
      "Antimeridian unwrapping or the point-in-polygon test is wrong.",
  );
}
console.log(`land lookup self-test: ${SELFTEST.length}/${SELFTEST.length} ok`);

const dots = [];
for (let lat = LAT_MAX; lat >= LAT_MIN; lat -= STEP) {
  for (let lon = LON_MIN; lon <= LON_MAX; lon += STEP) {
    if (isLand(lon, lat)) dots.push([round(lon), round(lat)]);
  }
}

function round(v) {
  return Math.round(v * 100) / 100;
}

// Emit as a flat Float32-friendly number list (lon, lat, lon, lat, ...):
// half the tokens of an array-of-pairs and it unpacks straight into a
// typed array at module load.
const flat = dots.flat();
const body = [];
for (let i = 0; i < flat.length; i += 24) {
  body.push("  " + flat.slice(i, i + 24).join(", ") + ",");
}

const ts = `// GENERATED FILE - do not edit by hand.
// Produced by tools/gen-world-dots.mjs from world-atlas land-50m.json
// (Natural Earth, public domain) at a ${STEP} degree lattice over
// lon [${LON_MIN}, ${LON_MAX}] / lat [${LAT_MIN}, ${LAT_MAX}].
//
// ${dots.length} land dots, stored flat as lon, lat, lon, lat, ... so the
// payload stays small and unpacks directly into a typed array.

export const WORLD_DOT_STEP_DEG = ${STEP};
export const WORLD_LON_MIN = ${LON_MIN};
export const WORLD_LON_MAX = ${LON_MAX};
export const WORLD_LAT_MIN = ${LAT_MIN};
export const WORLD_LAT_MAX = ${LAT_MAX};
export const WORLD_DOT_COUNT = ${dots.length};

const RAW: number[] = [
${body.join("\n")}
];

export const WORLD_DOTS = new Float32Array(RAW);
`;

writeFileSync(OUT, ts);
console.log(`wrote ${OUT}: ${dots.length} dots, ${(ts.length / 1024).toFixed(1)} KiB`);
