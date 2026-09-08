// Build step: turns the raw Natural Earth downloads into the per-country
// payloads the compositions render.
//
//   node tools/bake.mjs            bake every country in src/data/countries.json
//   node tools/bake.mjs poland     bake one
//
// Outputs, both in composition space (3840x2160):
//   src/data/geo/<slug>.json     projected SVG paths, city/label positions
//   public/relief/<slug>.png     shaded-relief plate warped to match
//
// Source data is downloaded into data/ on first run. See README.md.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PNG} from 'pngjs';
import {geoPath} from 'd3-geo';
import {
  COMP_WIDTH,
  COMP_HEIGHT,
  buildProjection,
  viewWindow,
  bboxOf,
  intersects,
  toPath,
  pathOfMany,
  ringsOfMany,
  safeRect,
  framingGeometry,
} from './geo.mjs';
import {
  loadSource,
  warpRelief,
  writePlate,
  rasteriseLandMask,
  fillRings,
  shoreChannel,
  PLATE_WIDTH,
  PLATE_HEIGHT,
} from './relief.mjs';
import {widthOf} from './metrics.mjs';
import {ensureSources, DATA_DIR} from './sources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));

const round = (n) => Math.round(n * 10) / 10;

const within = (rect, p, inset = 0) =>
  p &&
  Number.isFinite(p[0]) &&
  p[0] > rect[0] + inset &&
  p[0] < rect[2] - inset &&
  p[1] > rect[1] + inset &&
  p[1] < rect[3] - inset;

// Nonzero winding test against the projected subject rings, used to keep the
// country name over the country's own interior while it looks for a clear spot.
function inside(rings, x, y) {
  let winding = 0;
  for (const ring of rings) {
    const n = ring.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = ring[i * 2];
      const ay = ring[i * 2 + 1];
      const bx = ring[j * 2];
      const by = ring[j * 2 + 1];
      if (ay <= y) {
        if (by > y && (bx - ax) * (y - ay) - (x - ax) * (by - ay) > 0) winding++;
      } else if (by <= y && (bx - ax) * (y - ay) - (x - ax) * (by - ay) < 0) {
        winding--;
      }
    }
  }
  return winding !== 0;
}

// Finds the clearest spot on the country for the name: over land, near the
// cartographic label point, and off the city markers. A country name landing on
// top of its own capital is the single most common way one of these maps goes
// wrong.
//
// The name shrinks until it sits fully over the country. Where even the
// smallest size will not fit — a long thin country like Italy — it settles for
// having its centre on land at the requested size and overhangs the coast,
// which is what a cartographer would do too.
function placeName(sizeTarget, widthAt, base, rings, markers, bounds) {
  const [bx0, by0, bx1, by1] = bounds;
  const radius = 0.3 * Math.min(bx1 - bx0, by1 - by0) + 0.015 * COMP_WIDTH;
  const minSize = 0.028 * COMP_WIDTH;

  const search = (w, h, fits) => {
    let best = null;
    for (let i = 0; i <= 32; i++) {
      for (let j = 0; j <= 22; j++) {
        const x = bx0 + ((bx1 - bx0) * i) / 32;
        const y = by0 + ((by1 - by0) * j) / 22;
        const away = Math.hypot(x - base[0], y - base[1]);
        if (away > radius) continue;
        if (!fits(x, y, w, h)) continue;
        // Cities carry a label to one side, so a marker clears the name only
        // if its label clears it too.
        const blocked = markers.filter(
          (m) =>
            Math.abs(m.x - x) < w / 2 + LABEL_SIZE * 2.5 &&
            Math.abs(m.y - y) < h / 2 + LABEL_SIZE * 0.9,
        ).length;
        const score = blocked * 600 + away;
        if (!best || score < best.score) best = {x, y, score};
      }
    }
    return best;
  };

  const corners = (x, y, w, h) =>
    [
      [x - w / 2, y - h / 2],
      [x + w / 2, y - h / 2],
      [x - w / 2, y + h / 2],
      [x + w / 2, y + h / 2],
    ].every((c) => inside(rings, c[0], c[1]));
  const spine = (x, y, w) =>
    [[x - w / 2, y], [x, y], [x + w / 2, y]].every((c) =>
      inside(rings, c[0], c[1]),
    );

  // Try the whole range of sizes rather than taking the first that fits. A
  // slightly smaller name in the middle of the country beats a full-size one
  // shoved into the one wide corner where it happens to fit.
  let chosen = null;
  for (let size = sizeTarget; size >= minSize; size *= 0.93) {
    const w = widthAt(size);
    const h = size * 1.04;
    const hit = search(w, h, corners) ?? search(w, h, spine);
    if (!hit) continue;
    // Shrinking is expensive: the country name is meant to be the dominant
    // piece of type in frame, so it gives up size only to clear real obstacles.
    const total = hit.score + (1 - size / sizeTarget) * 2500;
    if (!chosen || total < chosen.total) chosen = {x: hit.x, y: hit.y, size, total};
  }
  if (chosen) return {x: chosen.x, y: chosen.y, size: chosen.size};

  const w = widthAt(sizeTarget);
  const hit = search(w, sizeTarget * 1.04, (x, y) => inside(rings, x, y));
  return hit
    ? {x: hit.x, y: hit.y, size: sizeTarget}
    : {x: base[0], y: base[1], size: sizeTarget};
}

// ---------------------------------------------------------------- city labels
// These sizes must match the type scale in CountryMap.tsx; the widths come from
// the actual woff2 files, via tools/metrics.mjs.
const LABEL_SIZE = 0.0106 * COMP_WIDTH;
const NEIGHBOUR_SIZE = 0.008 * COMP_WIDTH;
const NEIGHBOUR_TRACK = 0.16;
const SEA_SIZE = 0.0084 * COMP_WIDTH;
const SEA_TRACK = 0.08;
const NAME_TRACK = 0.06;

const MARKER_GAP = 0.0068 * COMP_WIDTH;
const MIN_CITY_GAP = 0.021 * COMP_WIDTH; // conurbations collapse to one marker

const ANCHOR_ORDER = ['right', 'left', 'above', 'below'];

function labelBox(city, anchor) {
  // A little wider and taller than the glyphs, so neighbouring labels end up
  // with air between them rather than merely not overlapping.
  const w = widthOf.city(city.name, LABEL_SIZE) + LABEL_SIZE * 0.5;
  const h = LABEL_SIZE * 1.35;
  const {x, y} = city;
  switch (anchor) {
    case 'left':
      return [x - MARKER_GAP - w, y - h / 2, w, h];
    case 'above':
      return [x - w / 2, y - MARKER_GAP - h, w, h];
    case 'below':
      return [x - w / 2, y + MARKER_GAP, w, h];
    default:
      return [x + MARKER_GAP, y - h / 2, w, h];
  }
}

const overlaps = (a, b) =>
  a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];

const fitsIn = (box, rect, inset) =>
  box[0] > rect[0] + inset &&
  box[0] + box[2] < rect[2] - inset &&
  box[1] > rect[1] + inset &&
  box[1] + box[3] < rect[3] - inset;

const overlapArea = (a, b) =>
  Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) *
  Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));

function placeLabels(cities, rect, overrides = {}, obstacles = []) {
  const placed = [...obstacles];
  for (const city of cities) {
    const forced = overrides[city.name];
    const order = forced ? [forced] : ANCHOR_ORDER;
    // If every side is taken, take the least bad one rather than defaulting to
    // whichever happens to be first.
    let chosen = null;
    for (const anchor of order) {
      const box = labelBox(city, anchor);
      if (!fitsIn(box, rect, 24)) continue;
      if (placed.some((b) => overlaps(box, b))) continue;
      chosen = anchor;
      break;
    }
    if (!chosen) {
      // Nowhere clear to put it. Two labels printed on top of each other is
      // worse than one city fewer, so the city goes — except the capital,
      // which always stays and takes the least bad side.
      if (!city.capital) {
        city.drop = true;
        continue;
      }
      chosen = order
        .map((a) => ({
          a,
          cost: placed.reduce((sum, b) => sum + overlapArea(labelBox(city, a), b), 0),
        }))
        .sort((p, q) => p.cost - q.cost)[0].a;
    }
    placed.push(labelBox(city, chosen));
    city.anchor = chosen;
  }
  return cities;
}

// ---------------------------------------------------------------- sea labels

const GRID_W = 200;
const GRID_H = 112;

// Chamfer distance, in grid cells, from every free cell to the nearest blocked
// one. Cells outside the grid count as blocked, so a label is never anchored
// where it would run off the frame.
function distanceField(blocked, gw, gh) {
  const dist = new Float32Array(gw * gh);
  const BIG = 1e6;
  for (let i = 0; i < dist.length; i++) dist[i] = blocked[i] ? 0 : BIG;
  const relax = (at, from, cost) => {
    const v = dist[from] + cost;
    if (v < dist[at]) dist[at] = v;
  };
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const at = j * gw + i;
      if (i === 0 || j === 0 || i === gw - 1 || j === gh - 1) {
        if (dist[at] > 1) dist[at] = 1;
      }
      if (i > 0) relax(at, at - 1, 1);
      if (j > 0) relax(at, at - gw, 1);
      if (i > 0 && j > 0) relax(at, at - gw - 1, 1.414);
      if (i < gw - 1 && j > 0) relax(at, at - gw + 1, 1.414);
    }
  }
  for (let j = gh - 1; j >= 0; j--) {
    for (let i = gw - 1; i >= 0; i--) {
      const at = j * gw + i;
      if (i < gw - 1) relax(at, at + 1, 1);
      if (j < gh - 1) relax(at, at + gw, 1);
      if (i < gw - 1 && j < gh - 1) relax(at, at + gw + 1, 1.414);
      if (i > 0 && j < gh - 1) relax(at, at + gw - 1, 1.414);
    }
  }
  return dist;
}

const gridOf = (rect, gw = GRID_W, gh = GRID_H) => ({
  gw,
  gh,
  stepX: (rect[2] - rect[0]) / gw,
  stepY: (rect[3] - rect[1]) / gh,
  x: (i) => rect[0] + (i + 0.5) * ((rect[2] - rect[0]) / gw),
  y: (j) => rect[1] + (j + 0.5) * ((rect[3] - rect[1]) / gh),
});

// Natural Earth sets some marine names in full caps ("INDIAN OCEAN") and others
// in title case; the map wants one voice.
const titleCase = (name) =>
  name === name.toUpperCase()
    ? name
        .toLowerCase()
        .replace(/(^|[\s-])([a-z])/g, (_, sep, c) => sep + c.toUpperCase())
    : name;

const pointInRing = (ring, x, y) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

// Which sea a lon/lat falls in, against the Natural Earth marine polygons.
function pointInFeature(feature, x, y) {
  const polys =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  return polys.some(
    ([outer, ...holes]) =>
      pointInRing(outer, x, y) && !holes.some((h) => pointInRing(h, x, y)),
  );
}

// The visible pole of inaccessibility: the point of a shape, inside the
// framing, furthest from its own edge. Natural Earth ships a label point per
// country, but on a regional map the big neighbour's label point is usually
// hundreds of miles off frame — this is what puts UNITED STATES on the part of
// the United States you can actually see.
function poleOfVisibility(rings, rect) {
  const g = gridOf(rect);
  const cover = fillRings(rings, g.gw, g.gh, {
    scaleX: g.gw / (rect[2] - rect[0]),
    scaleY: g.gh / (rect[3] - rect[1]),
    offsetX: rect[0],
    offsetY: rect[1],
    subrows: 2,
  });
  const blocked = new Uint8Array(g.gw * g.gh);
  let cells = 0;
  for (let i = 0; i < blocked.length; i++) {
    const on = cover[i] >= 128;
    if (on) cells++;
    blocked[i] = on ? 0 : 1;
  }
  const area = cells * g.stepX * g.stepY;
  if (!cells) return null;

  const dist = distanceField(blocked, g.gw, g.gh);
  let best = -1;
  let at = -1;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] < 1e5 && dist[i] > best) {
      best = dist[i];
      at = i;
    }
  }
  if (at < 0 || best <= 0) return null;
  return {
    x: g.x(at % g.gw),
    y: g.y(Math.floor(at / g.gw)),
    clearance: best * g.stepX,
    area,
  };
}

// Natural Earth's marine polygons are whole oceans and seas, so their centroids
// are usually nowhere near the framing. Instead: find the open water furthest
// from any coast inside the visible rectangle, and ask which sea that is. That
// puts "Baltic Sea" in the middle of the visible Baltic, the way a cartographer
// would set it.
function seaLabels(mask, projection, rect, marine, limit = 3) {
  const k = PLATE_WIDTH / COMP_WIDTH;
  const g = gridOf(rect);
  const blocked = new Uint8Array(g.gw * g.gh);
  for (let j = 0; j < g.gh; j++) {
    for (let i = 0; i < g.gw; i++) {
      const px = Math.round(g.x(i) * k);
      const py = Math.round(g.y(j) * k);
      const land =
        px < 0 || py < 0 || px >= PLATE_WIDTH || py >= PLATE_HEIGHT
          ? 255
          : mask[py * PLATE_WIDTH + px];
      blocked[j * g.gw + i] = land >= 128 ? 1 : 0;
    }
  }
  const dist = distanceField(blocked, g.gw, g.gh);

  const cells = [];
  for (let j = 0; j < g.gh; j++) {
    for (let i = 0; i < g.gw; i++) {
      const d = dist[j * g.gw + i];
      if (d > 3 && d < 1e5) cells.push({i, j, d});
    }
  }
  cells.sort((a, b) => b.d - a.d);

  const out = [];
  const used = [];
  const taken = new Set();
  for (const cell of cells) {
    if (out.length >= limit) break;
    if (used.some((u) => Math.hypot(u.i - cell.i, u.j - cell.j) < g.gw * 0.16)) continue;
    const x = g.x(cell.i);
    const y = g.y(cell.j);
    const ll = projection.invert([x, y]);
    if (!ll) continue;
    const sea = marine.features.find(
      (f) =>
        f.properties.name &&
        intersects(bboxOf(f), [ll[0], ll[1], ll[0], ll[1]]) &&
        pointInFeature(f, ll[0], ll[1]),
    );
    if (!sea || taken.has(sea.properties.name)) continue;
    // Only label water that has room for the word, and only where the whole
    // word stays comfortably inside the framing.
    const half = widthOf.small(sea.properties.name, SEA_SIZE, SEA_TRACK) / 2;
    if (cell.d * g.stepX < half) continue;
    const edge = 0.022 * COMP_WIDTH;
    if (!within(rect, [x - half, y], edge) || !within(rect, [x + half, y], edge))
      continue;
    taken.add(sea.properties.name);
    used.push(cell);
    out.push({name: titleCase(sea.properties.name), x: round(x), y: round(y)});
  }
  return out;
}

// --------------------------------------------------------------------- bake

async function bakeCountry(slug, config, layers, reliefSource) {
  const {countries, places, marine, lakes, boundaries} = layers;

  const subject = countries.features.find(
    (f) => f.properties.ADM0_A3 === config.adm0a3,
  );
  if (!subject) throw new Error(`no Natural Earth country with ADM0_A3=${config.adm0a3}`);

  const framing = config.framing ?? {};
  const framed = framingGeometry(subject, framing);
  const projection = buildProjection(framed, framing);
  const project = (lon, lat) => projection([lon, lat]);
  const win = viewWindow(projection);

  const visible = (f) => intersects(bboxOf(f), win);

  // Every country polygon in view. The full-detail rings become the land mask
  // baked into the relief plate's alpha; a heavily decimated copy is all the
  // shoreline stroke needs.
  const inView = countries.features.filter(visible);
  const landRings = ringsOfMany(projection, inView);
  const subjectRings = ringsOfMany(projection, [subject]);

  // The push-in crops as it runs, so every label is culled against the framing
  // that survives to the end of the clip, not the one it starts with.
  const capitalFeature = places.features.find(
    (f) => f.properties.ADM0_A3 === config.adm0a3 && f.properties.ADM0CAP === 1,
  );
  if (!capitalFeature) {
    throw new Error(`no Natural Earth capital for ${config.adm0a3}`);
  }
  const capitalAt = project(
    capitalFeature.properties.LONGITUDE,
    capitalFeature.properties.LATITUDE,
  );
  const rect = safeRect({x: capitalAt[0], y: capitalAt[1]}, push);

  // A neighbour earns a label only if it holds enough of the frame to carry
  // one. Natural Earth's own label point is used when it is on screen;
  // otherwise the label goes to the middle of whatever part of that country is
  // visible, which is the only way the big neighbour off the top of the frame
  // gets named at all.
  const MIN_AREA = 0.0012 * COMP_WIDTH * COMP_HEIGHT;
  const MAX_NEIGHBOURS = 12;

  // Countries sharing a land border with the subject, straight out of Natural
  // Earth's boundary lines. On a map of Italy, Slovenia earns its label and
  // Algeria does not, however much of the frame Algeria happens to fill.
  const adjacent = new Set();
  for (const line of boundaries.features) {
    const {ADM0_A3_L: left, ADM0_A3_R: right} = line.properties;
    if (left === config.adm0a3 && right) adjacent.add(right);
    if (right === config.adm0a3 && left) adjacent.add(left);
  }

  // Natural Earth's NAME runs to "United States of America"; BRK_NAME is the
  // map-label form, and ABBREV catches the few that are still too long.
  const shortName = (p) => {
    const name = p.BRK_NAME || p.NAME || '';
    return (name.length > 18 && p.ABBREV ? p.ABBREV : name).toUpperCase();
  };

  const neighbourBox = (name, x, y) => {
    const w =
      widthOf.small(name, NEIGHBOUR_SIZE, NEIGHBOUR_TRACK) + NEIGHBOUR_SIZE * 1.2;
    const h = NEIGHBOUR_SIZE * 1.6;
    return [x - w / 2, y - h / 2, w, h];
  };

  // Then rank by how much of the frame each one actually holds, rather than by
  // how big the country is — a country clipping the corner of the frame is not
  // a prominent one.
  const seenIn = inView
    .filter((f) => f.properties.ADM0_A3 !== config.adm0a3)
    .map((f) => ({f, pole: poleOfVisibility(ringsOfMany(projection, [f]), rect)}))
    .filter((n) => n.pole && n.pole.area >= MIN_AREA)
    .sort((a, b) => {
      const near = Number(adjacent.has(b.f.properties.ADM0_A3)) -
        Number(adjacent.has(a.f.properties.ADM0_A3));
      return near || b.pole.area - a.pole.area;
    });

  const neighbours = [];
  const neighbourBoxes = [];
  for (const {f, pole} of seenIn) {
    if (neighbours.length >= MAX_NEIGHBOURS) break;
    const name = shortName(f.properties);
    if (!name) continue;

    // Natural Earth's own label point when it is on screen, otherwise the
    // middle of whatever part of the country is visible — which is the only way
    // the big neighbour off the top of the frame gets named at all.
    const labelled = project(f.properties.LABEL_X, f.properties.LABEL_Y);
    const inset = 0.02 * COMP_WIDTH;
    const at =
      labelled && fitsIn(neighbourBox(name, labelled[0], labelled[1]), rect, inset)
        ? {x: labelled[0], y: labelled[1]}
        : pole;

    const box = neighbourBox(name, at.x, at.y);
    if (!fitsIn(box, rect, inset)) continue;
    // A neighbour's name struck through the subject country reads as a mistake;
    // better to leave that neighbour unnamed.
    if (
      [box[0], box[0] + box[2] / 2, box[0] + box[2]].some((px) =>
        inside(subjectRings, px, at.y),
      )
    )
      continue;
    // A country name half on top of its neighbour's is worse than one missing
    // name, and the more prominent country has already been placed.
    if (neighbourBoxes.some((b) => overlaps(box, b))) continue;
    neighbourBoxes.push(box);
    neighbours.push({name, x: round(at.x), y: round(at.y)});
  }

  const mask = rasteriseLandMask(landRings);
  const seas = seaLabels(mask, projection, rect, marine);

  const exclude = new Set(config.cities?.exclude ?? []);
  // Natural Earth carries a few transliterations a news map would not use.
  const rename = config.cities?.rename ?? {};
  const candidates = places.features
    .filter((f) => f.properties.ADM0_A3 === config.adm0a3)
    .filter((f) => !exclude.has(f.properties.NAME))
    .sort((a, b) => (b.properties.POP_MAX ?? 0) - (a.properties.POP_MAX ?? 0));

  const maxCities = config.maxCities ?? 12;
  let picked = [];
  const seen = new Set();
  // `veto` lets a second pass rule out positions the country name has since
  // claimed.
  const take = (f, veto = () => false) => {
    if (!f || seen.has(f.properties.NAME)) return;
    const p = project(f.properties.LONGITUDE, f.properties.LATITUDE);
    if (!within(rect, p, 0.022 * COMP_WIDTH)) return;
    // Neighbouring cities in one conurbation (Katowice/Bytom/Gliwice, say)
    // become an unreadable knot of markers; keep the largest of the cluster.
    if (picked.some((c) => Math.hypot(c.x - p[0], c.y - p[1]) < MIN_CITY_GAP)) return;
    if (veto(p)) return;
    seen.add(f.properties.NAME);
    picked.push({
      name: rename[f.properties.NAME] ?? f.properties.NAME,
      capital: f.properties.ADM0CAP === 1,
      x: round(p[0]),
      y: round(p[1]),
    });
  };
  take(capitalFeature); // the capital is never dropped for population
  for (const f of candidates) {
    if (picked.length >= maxCities) break;
    take(f);
  }
  const capital = picked.find((c) => c.capital) ?? picked[0];

  // Bounds of the framed part of the country, not of every scattered island:
  // the country name is sized and placed against what is actually on screen.
  const b = geoPath(projection).bounds(framed);
  const subjectBox = [b[0][0], b[0][1], b[1][0], b[1][1]].map(round);

  // Country name: sized to sit across roughly half the country's width, then
  // clamped so a wide country does not get a headline and a narrow one does not
  // get a whisper.
  const widthAt = (size) => widthOf.display(config.name, size, NAME_TRACK);
  // Size against the geometric mean of the country's projected extent, so a
  // long thin country gets a name in proportion to its presence in the frame
  // rather than to its narrowest dimension.
  const span = Math.sqrt(
    (subjectBox[2] - subjectBox[0]) * (subjectBox[3] - subjectBox[1]),
  );
  const target =
    Math.min(
      Math.max((0.5 * span) / widthAt(1), 0.028 * COMP_WIDTH),
      0.052 * COMP_WIDTH,
    ) * (config.nameScale ?? 1);

  const labelPoint = project(
    subject.properties.LABEL_X,
    subject.properties.LABEL_Y,
  );
  const chosen = config.nameAt
    ? {...(([x, y]) => ({x, y}))(project(config.nameAt[0], config.nameAt[1])), size: target}
    : placeName(
        target,
        widthAt,
        labelPoint,
        subjectRings,
        picked,
        subjectBox,
      );

  const nameSize = chosen.size;
  const nameAt = {
    x: chosen.x + (config.nameOffset?.[0] ?? 0) * COMP_WIDTH,
    y: chosen.y + (config.nameOffset?.[1] ?? 0) * COMP_HEIGHT,
  };
  const nameWidth = widthAt(nameSize);
  const nameBox = [
    nameAt.x - nameWidth / 2,
    nameAt.y - nameSize * 0.52,
    nameWidth,
    nameSize * 1.04,
  ];

  // The name is the dominant piece of type in frame, so it is placed first and
  // the city labels route around it.
  // A marker sitting under the country name cannot be read, so those cities are
  // dropped and the next-largest ones take their places.
  const underName = (x, y) =>
    x > nameBox[0] - MARKER_GAP &&
    x < nameBox[0] + nameBox[2] + MARKER_GAP &&
    y > nameBox[1] - MARKER_GAP &&
    y < nameBox[1] + nameBox[3] + MARKER_GAP;

  const evicted = picked.filter((c) => !c.capital && underName(c.x, c.y));
  if (evicted.length) {
    for (const c of evicted) seen.delete(c.name);
    picked = picked.filter((c) => !evicted.includes(c));
    for (const f of candidates) {
      if (picked.length >= maxCities) break;
      take(f, (p) => underName(p[0], p[1]));
    }
  }

  // Every marker is an obstacle too, so one city's label never lands on
  // another's dot.
  const markerBoxes = picked.map((c) => [
    c.x - MARKER_GAP * 0.7,
    c.y - MARKER_GAP * 0.7,
    MARKER_GAP * 1.4,
    MARKER_GAP * 1.4,
  ]);
  const seaBoxes = seas.map((s) => {
    const w = widthOf.small(s.name, SEA_SIZE, SEA_TRACK);
    return [s.x - w / 2, s.y - SEA_SIZE * 0.7, w, SEA_SIZE * 1.4];
  });
  placeLabels(picked, rect, config.cities?.anchors ?? {}, [
    nameBox,
    ...markerBoxes,
    ...neighbourBoxes,
    ...seaBoxes,
  ]);
  picked = picked.filter((c) => !c.drop);

  const geo = {
    slug,
    name: config.name,
    subjectBox,
    subject: toPath(projection, subject, 0.5),
    borders: pathOfMany(projection, boundaries.features.filter(visible), 1.2),
    lakes: pathOfMany(
      projection,
      lakes.features.filter((f) => visible(f) && (f.properties.scalerank ?? 0) <= 4),
      1.2,
    ),
    neighbours,
    seas,
    cities: picked,
    capital: {x: capital.x, y: capital.y},
    nameAt: {x: round(nameAt.x), y: round(nameAt.y)},
    nameSize: round(nameSize),
  };

  fs.mkdirSync(path.join(ROOT, 'src/data/geo'), {recursive: true});
  fs.writeFileSync(
    path.join(ROOT, 'src/data/geo', `${slug}.json`),
    JSON.stringify(geo),
  );

  const png = warpRelief(reliefSource, projection, {
    gain: config.reliefGain ?? 1.7,
    mask,
    shore: shoreChannel(mask),
  });
  fs.mkdirSync(path.join(ROOT, 'public/relief'), {recursive: true});
  await writePlate(png, path.join(ROOT, 'public/relief', `${slug}.png`));

  return geo;
}

// A tileable noise plate for the grain pass. Written once; identical for every
// country and both style versions.
function writeGrain(file, size = 256) {
  if (fs.existsSync(file)) return;
  const png = new PNG({width: size, height: size, colorType: 0, inputColorType: 0});
  const data = Buffer.alloc(size * size);
  let seed = 20240917;
  for (let i = 0; i < data.length; i++) {
    // xorshift, so the plate is byte-identical on every machine.
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed |= 0;
    // Centred on mid-grey: an overlay blend of flat 128 is a no-op, so the
    // grain adds contrast noise rather than lifting the whole frame.
    data[i] = 128 + (((seed >>> 8) & 0xff) - 128) * 0.55;
  }
  png.data = data;
  return writePlate(png, file);
}

// ---------------------------------------------------------------------- main

const only = process.argv.slice(2);
const registry = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/data/countries.json'), 'utf8'),
);
// Shared with src/timing.ts so the cull matches the push the composition runs.
const push = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/push.json'), 'utf8'),
);

await ensureSources();

console.log('reading Natural Earth layers…');
const layers = {
  countries: read('ne_10m_admin_0_countries.geojson'),
  places: read('ne_10m_populated_places.geojson'),
  marine: read('ne_50m_geography_marine_polys.geojson'),
  lakes: read('ne_10m_lakes.geojson'),
  boundaries: read('ne_10m_admin_0_boundary_lines_land.geojson'),
};
const reliefSource = loadSource(path.join(DATA_DIR, 'SR_HR.raw'));

await writeGrain(path.join(ROOT, 'public/grain.png'));

const baked = [];
for (const [slug, config] of Object.entries(registry)) {
  if (only.length && !only.includes(slug)) continue;
  const t = Date.now();
  const geo = await bakeCountry(slug, config, layers, reliefSource);
  baked.push(slug);
  console.log(
    `${slug}: ${geo.cities.length} cities, ${geo.neighbours.length} neighbours, ` +
      `${geo.seas.length} sea labels  (${((Date.now() - t) / 1000).toFixed(1)}s)`,
  );
}

// Regenerate the barrel so Root.tsx can register compositions for whatever is
// baked, without a dynamic import webpack cannot follow.
const slugs = Object.keys(registry).filter((s) =>
  fs.existsSync(path.join(ROOT, 'src/data/geo', `${s}.json`)),
);
const ident = (slug) => slug.replace(/-(.)/g, (_, c) => c.toUpperCase());
fs.writeFileSync(
  path.join(ROOT, 'src/data/geo/index.ts'),
  '// Generated by tools/bake.mjs — do not edit.\n' +
    "import type {CountryGeo} from '../types';\n" +
    slugs.map((s) => `import ${ident(s)} from './${s}.json';`).join('\n') +
    '\n\nexport const GEO: Record<string, CountryGeo> = {\n' +
    slugs.map((s) => `  '${s}': ${ident(s)},`).join('\n') +
    '\n} as unknown as Record<string, CountryGeo>;\n',
);
console.log(`registered: ${slugs.join(', ')}`);
