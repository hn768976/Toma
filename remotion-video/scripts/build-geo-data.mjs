/**
 * Build-time geodata baker for the "North America Data Map" composition.
 *
 * Reads Natural Earth country outlines (world-atlas) and US state outlines
 * (us-atlas), projects them into the flat "map space" that the runtime camera
 * later lifts onto a tilted 3D ground plane, and bakes the result — outlines,
 * state borders, graticule and the land dot-matrix — into a single JSON file.
 *
 * Doing this at build time keeps the render loop free of any point-in-polygon
 * work and keeps d3/topojson out of the browser bundle.
 *
 *   node scripts/build-geo-data.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "src", "usa-map", "data", "map-data.json");

/** Projection: plain Mercator keeps meridians/parallels straight, which is what
 *  gives the reference its ruler-straight graticule once the plane is tilted. */
const MAP_SCALE = 1600;
const MAP_CENTER = [-97, 38];

/** Geographic window we bake. Anything outside is off-frame or fully hazed out. */
const LON_RANGE = [-142, -49];
const LAT_RANGE = [3.5, 61];

/** Lattice pitch of the land dot-matrix, in map units. */
const DOT_SPACING = 10.5;

const COUNTRIES = new Set([
  "United States of America", "Canada", "Mexico", "Guatemala", "Belize",
  "Honduras", "El Salvador", "Nicaragua", "Costa Rica", "Panama", "Cuba",
  "Haiti", "Dominican Rep.", "Jamaica", "Bahamas", "Puerto Rico", "Greenland",
]);

const world = JSON.parse(
  readFileSync(join(ROOT, "node_modules", "world-atlas", "countries-50m.json")),
);
const usa = JSON.parse(
  readFileSync(join(ROOT, "node_modules", "us-atlas", "states-10m.json")),
);
const cities = JSON.parse(
  readFileSync(join(ROOT, "src", "usa-map", "data", "cities.source.json")),
);

// ---------------------------------------------------------------- projection

const raw = geoMercator().center(MAP_CENTER).scale(MAP_SCALE).translate([0, 0]);
const [x0, y0] = raw([LON_RANGE[0], LAT_RANGE[1]]);
const [x1, y1] = raw([LON_RANGE[1], LAT_RANGE[0]]);

const projection = geoMercator()
  .center(MAP_CENTER)
  .scale(MAP_SCALE)
  .translate([0, 0])
  .clipExtent([
    [x0, y0],
    [x1, y1],
  ]);

/** A d3-geo path context that records clipped rings instead of painting them. */
const recorder = () => {
  const rings = [];
  let cur = null;
  return {
    ctx: {
      beginPath() {},
      moveTo(x, y) {
        cur = [x, y];
        rings.push(cur);
      },
      lineTo(x, y) {
        cur.push(x, y);
      },
      closePath() {},
      arc() {},
    },
    rings,
  };
};

const ringsOf = (geojson) => {
  const rec = recorder();
  geoPath(projection, rec.ctx)(geojson);
  return rec.rings;
};

// ------------------------------------------------------------------ outlines

const countryFC = feature(world, world.objects.countries);
const picked = countryFC.features.filter((f) => COUNTRIES.has(f.properties.name));

/** Per-country rings, kept separate so even-odd hole handling stays correct. */
const countryRings = picked.map((f) => ringsOf(f));

const statesFC = feature(usa, usa.objects.states);
const stateRings = statesFC.features.flatMap((f) => ringsOf(f));

/** Drop points that add no visible detail at our output resolution. */
const simplify = (ring, tol) => {
  const out = [ring[0], ring[1]];
  let lx = ring[0];
  let ly = ring[1];
  for (let i = 2; i < ring.length - 2; i += 2) {
    const dx = ring[i] - lx;
    const dy = ring[i + 1] - ly;
    if (dx * dx + dy * dy >= tol * tol) {
      out.push(ring[i], ring[i + 1]);
      lx = ring[i];
      ly = ring[i + 1];
    }
  }
  out.push(ring[ring.length - 2], ring[ring.length - 1]);
  return out;
};

const round = (ring) => ring.map((v) => Math.round(v * 10) / 10);

const coastPaths = countryRings
  .flat()
  .filter((r) => r.length >= 8)
  .map((r) => round(simplify(r, 1.1)))
  .filter((r) => r.length >= 8);

const borderPaths = stateRings
  .filter((r) => r.length >= 8)
  .map((r) => round(simplify(r, 1.6)))
  .filter((r) => r.length >= 8);

// ------------------------------------------------------- land dot-matrix fill

/**
 * Scanline-fills each country's rings on a shared lattice using the even-odd
 * rule, so interior holes (Great Lakes, etc.) stay empty like the reference.
 */
const s = DOT_SPACING;
const cells = new Set();

for (const rings of countryRings) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const r of rings) {
    for (let i = 1; i < r.length; i += 2) {
      if (r[i] < minY) minY = r[i];
      if (r[i] > maxY) maxY = r[i];
    }
  }
  if (!Number.isFinite(minY)) continue;

  for (let iy = Math.ceil(minY / s); iy <= Math.floor(maxY / s); iy++) {
    const y = iy * s;
    const xs = [];
    for (const r of rings) {
      const n = r.length / 2;
      for (let k = 0; k < n; k++) {
        const ax = r[2 * k];
        const ay = r[2 * k + 1];
        const j = (k + 1) % n;
        const bx = r[2 * j];
        const by = r[2 * j + 1];
        if (ay === by) continue;
        if (y >= Math.min(ay, by) && y < Math.max(ay, by)) {
          xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
        }
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let ix = Math.ceil(xs[k] / s); ix <= Math.floor(xs[k + 1] / s); ix++) {
        cells.add(ix * 100000 + iy);
      }
    }
  }
}

// ---------------------------------------------------------------- city points

const cityPts = cities.map((c) => {
  const [px, py] = raw([c.lon, c.lat]);
  return { n: c.n, w: c.w, x: Math.round(px * 10) / 10, y: Math.round(py * 10) / 10 };
});

/** Dot brightness: a floor plus a halo bleeding out of every nearby city. */
const dots = [];
for (const key of cells) {
  const ix = Math.round(key / 100000);
  const iy = key - ix * 100000;
  const x = ix * s;
  const y = iy * s;
  let lit = 0;
  for (const c of cityPts) {
    const dx = x - c.x;
    const dy = y - c.y;
    const d2 = dx * dx + dy * dy;
    const r = 40 + c.w * 190;
    if (d2 < r * r) lit += c.w * (1 - Math.sqrt(d2) / r) ** 2;
  }
  // 0..5 brightness bucket, so the renderer can batch by fill colour.
  const b = Math.min(5, Math.round(Math.min(1, lit * 1.35) * 5));
  dots.push(ix, iy, b);
}

// ------------------------------------------------------------------ graticule

const grat = [];
for (let lon = -180; lon <= -20; lon += 10) {
  const a = raw([lon, -12]);
  const b = raw([lon, 74]);
  grat.push([a[0], a[1], b[0], b[1]].map((v) => Math.round(v * 10) / 10));
}
for (let lat = -10; lat <= 70; lat += 10) {
  const a = raw([-180, lat]);
  const b = raw([-20, lat]);
  grat.push([a[0], a[1], b[0], b[1]].map((v) => Math.round(v * 10) / 10));
}

// ------------------------------------------------------------- routes (arcs)

/**
 * Deterministic hub-and-spoke network: every city links to a handful of its
 * nearest neighbours, weighted so big hubs reach further. Seeded so the baked
 * output is stable across runs.
 */
let seed = 0x2f6e2b1;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const routes = [];
const seen = new Set();
// Arcs link hubs only; the long tail of small cities just lights the map.
const ROUTE_MIN_WEIGHT = 0.38;
const order = cityPts
  .map((_, i) => i)
  .filter((i) => cityPts[i].w >= ROUTE_MIN_WEIGHT)
  .sort((a, b) => cityPts[b].w - cityPts[a].w);

for (const i of order) {
  const a = cityPts[i];
  const links = a.w > 0.7 ? 4 : a.w > 0.5 ? 3 : 2;
  const near = cityPts
    .map((c, j) => ({ j, d: Math.hypot(c.x - a.x, c.y - a.y) - c.w * 120 }))
    .filter((o) => o.j !== i && cityPts[o.j].w >= ROUTE_MIN_WEIGHT)
    .sort((p, q) => p.d - q.d)
    .slice(0, links + 3);

  let added = 0;
  for (const o of near) {
    if (added >= links) break;
    const key = Math.min(i, o.j) * 1000 + Math.max(i, o.j);
    if (seen.has(key)) continue;
    seen.add(key);
    added++;
    routes.push({
      a: i,
      b: o.j,
      // Sign + magnitude of the sideways bow, and the pulse's phase offset.
      c: Math.round((rnd() * 0.34 + 0.1) * (rnd() < 0.5 ? -1 : 1) * 100) / 100,
      p: Math.round(rnd() * 100) / 100,
    });
  }
}

// ----------------------------------------------------------------- emit

const data = {
  meta: {
    scale: MAP_SCALE,
    center: MAP_CENTER,
    dotSpacing: s,
    lonRange: LON_RANGE,
    latRange: LAT_RANGE,
  },
  coast: coastPaths,
  borders: borderPaths,
  graticule: grat,
  dots,
  cities: cityPts,
  routes,
};

writeFileSync(OUT, JSON.stringify(data));

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`coast rings   ${coastPaths.length}`);
console.log(`state rings   ${borderPaths.length}`);
console.log(`graticule     ${grat.length}`);
console.log(`dots          ${dots.length / 3}`);
console.log(`cities        ${cityPts.length}`);
console.log(`routes        ${routes.length}`);
console.log(`written       ${OUT} (${kb(JSON.stringify(data).length)})`);
