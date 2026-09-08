// Shared geometry helpers for the bake step.
// All projection maths lives here so the raster warp and the vector paths
// can never drift out of registration: both go through buildProjection().
import {
  geoMercator,
  geoConicConformal,
  geoPath,
  geoBounds,
  geoArea,
  geoCentroid,
} from 'd3-geo';

export const COMP_WIDTH = 3840;
export const COMP_HEIGHT = 2160;

// The subject country is fitted into this fraction of the frame, which leaves
// enough neighbouring territory around it to read as a region rather than a
// cut-out. Overridable per country via framing.zoom.
const FIT_WIDTH = 0.44;
const FIT_HEIGHT = 0.52;

// framing.bounds names the view itself rather than the subject, so the
// rectangle fills the frame instead of sitting in the central third.
const BOUNDS_FIT = 0.98;

// The push-in crops the frame as it runs, so anything placed for the opening
// framing may be off screen by the end. Everything is culled against the
// tightest framing instead — the rectangle still visible at full push.
export function safeRect(capital, push) {
  const s = push.scale;
  const room = (1 - 1 / s) * push.drift;
  const toCapital = [capital.x - COMP_WIDTH / 2, capital.y - COMP_HEIGHT / 2];
  const reach = Math.hypot(toCapital[0], toCapital[1]) || 1;
  // Matches the transform in CountryMap.tsx: scale about the centre, then a
  // drift toward the capital that the scale has already made room for.
  const cx = COMP_WIDTH / 2 + (toCapital[0] / reach) * room * (COMP_WIDTH / 2);
  const cy = COMP_HEIGHT / 2 + (toCapital[1] / reach) * room * (COMP_HEIGHT / 2);
  const hw = COMP_WIDTH / (2 * s);
  const hh = COMP_HEIGHT / (2 * s);
  return [cx - hw, cy - hh, cx + hw, cy + hh];
}

export const polygon = (coordinates) => ({
  type: 'Feature',
  properties: {},
  geometry: {type: 'Polygon', coordinates},
});

// Splits a country's polygons into the landmass the map is about and the
// territory that sits too far away to share a framing — Alaska and Hawaii on
// the United States, the overseas departments on France, Svalbard on Norway.
// Which of the two the highlight fill covers is the country entry's
// `territories` decision, not something this function assumes.
export function partitionTerritory(subject) {
  if (subject.geometry.type !== 'MultiPolygon') {
    return {main: subject, distant: null};
  }

  const parts = subject.geometry.coordinates.map(polygon);
  const areas = parts.map(geoArea);
  const main = areas.indexOf(Math.max(...areas));
  const centre = geoCentroid(parts[main]);
  const [[w, s], [e, n]] = geoBounds(parts[main]);
  // Two thirds of the main landmass away is already a different map: this is
  // what keeps Sicily and Sardinia in an Italian framing and Alaska out of an
  // American one.
  const reach = Math.hypot(e - w, n - s) * 0.6;

  const near = [];
  const far = [];
  parts.forEach((part, i) => {
    if (i === main) {
      near.push(i);
      return;
    }
    const c = geoCentroid(part);
    const dLon = Math.abs(((c[0] - centre[0] + 540) % 360) - 180);
    const close = Math.hypot(dLon, c[1] - centre[1]) < reach;
    // Small islands close by belong to the main view; anything big or far is
    // its own problem.
    (close && areas[i] >= areas[main] * 0.03 ? near : close ? near : far).push(i);
  });

  const collect = (list) =>
    list.length
      ? {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiPolygon',
            coordinates: list.map((i) => parts[i].geometry.coordinates),
          },
        }
      : null;

  return {main: collect(near), distant: collect(far)};
}

// What the framing is built around: the main landmass, or an explicit rectangle.
export function framingGeometry(subject, framing = {}) {
  if (framing.bounds) {
    const [w, s, e, n] = framing.bounds;
    // Clockwise in lon/lat. d3-geo reads spherical polygons by winding order,
    // and the other way round this rectangle means "the whole globe except
    // this rectangle" — which fits the world into the frame.
    return polygon([[[w, s], [w, n], [e, n], [e, s], [w, s]]]);
  }
  return partitionTerritory(subject).main ?? subject;
}

export function buildProjection(subject, framing = {}) {
  const [[minLon, minLat], [maxLon, maxLat]] = geoBounds(subject);
  const midLon = (minLon + maxLon) / 2;
  const midLat = (minLat + maxLat) / 2;

  // Conic conformal away from the equator (the standard choice for mid- and
  // high-latitude regional maps), Mercator near it.
  const kind =
    framing.projection ?? (Math.abs(midLat) >= 23 ? 'conic' : 'mercator');

  const projection =
    kind === 'conic'
      ? geoConicConformal().parallels([
          minLat + (maxLat - minLat) / 6,
          maxLat - (maxLat - minLat) / 6,
        ])
      : geoMercator();

  projection.rotate([-midLon, 0]).center([0, midLat]);

  // Baseline fit, then scale so the country occupies the framing box and
  // translate so its projected centre lands on the framing anchor.
  projection.fitExtent(
    [
      [0, 0],
      [COMP_WIDTH, COMP_HEIGHT],
    ],
    subject,
  );

  const path = geoPath(projection);
  const b0 = path.bounds(subject);
  const fitW = framing.bounds ? BOUNDS_FIT : FIT_WIDTH;
  const fitH = framing.bounds ? BOUNDS_FIT : FIT_HEIGHT;
  const fit = Math.min(
    (COMP_WIDTH * fitW) / (b0[1][0] - b0[0][0]),
    (COMP_HEIGHT * fitH) / (b0[1][1] - b0[0][1]),
  );
  projection.scale(projection.scale() * fit * (framing.zoom ?? 1));

  const b1 = geoPath(projection).bounds(subject);
  const cx = (b1[0][0] + b1[1][0]) / 2;
  const cy = (b1[0][1] + b1[1][1]) / 2;
  const [tx, ty] = projection.translate();
  projection.translate([
    tx + (COMP_WIDTH / 2 + (framing.offsetX ?? 0) * COMP_WIDTH) - cx,
    ty + (COMP_HEIGHT / 2 + (framing.offsetY ?? 0) * COMP_HEIGHT) - cy,
  ]);

  return projection;
}

// Longitude/latitude window actually visible, sampled by inverting a grid over
// the (over-sized) relief plate. Used to pre-filter the vector layers.
export function viewWindow(projection, margin = 1.35) {
  const w = COMP_WIDTH * margin;
  const h = COMP_HEIGHT * margin;
  const x0 = (COMP_WIDTH - w) / 2;
  const y0 = (COMP_HEIGHT - h) / 2;
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  for (let i = 0; i <= 48; i++) {
    for (let j = 0; j <= 48; j++) {
      const p = projection.invert([x0 + (w * i) / 48, y0 + (h * j) / 48]);
      if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
      minLon = Math.min(minLon, p[0]);
      maxLon = Math.max(maxLon, p[0]);
      minLat = Math.min(minLat, p[1]);
      maxLat = Math.max(maxLat, p[1]);
    }
  }
  return [minLon, minLat, maxLon, maxLat];
}

export const bboxOf = (feature) => {
  if (feature.bbox) return feature.bbox;
  const [[a, b], [c, d]] = geoBounds(feature);
  return [a, b, c, d];
};

export const intersects = (a, b) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

// A d3-geo path context that decimates as it draws. Natural Earth 10m carries
// far more vertices than a 3840px frame can show; dropping points closer than
// MIN_STEP to the last one kept cuts the baked JSON by ~10x with no visible
// difference, and keeps the SVG cheap enough to animate.
const MIN_STEP = 0.6; // composition px
const r1 = (n) => Math.round(n * 10) / 10;

class DecimatingContext {
  constructor(minStep = MIN_STEP) {
    this.parts = [];
    this.min2 = minStep * minStep;
  }
  moveTo(x, y) {
    this.sx = this.lx = x;
    this.sy = this.ly = y;
    this.pending = null;
    this.parts.push(`M${r1(x)},${r1(y)}`);
  }
  lineTo(x, y) {
    const dx = x - this.lx;
    const dy = y - this.ly;
    if (dx * dx + dy * dy < this.min2) {
      // Remember it: if it turns out to be the last point before a close, we
      // still want the outline to reach it rather than cutting the corner.
      this.pending = [x, y];
      return;
    }
    this.lx = x;
    this.ly = y;
    this.pending = null;
    this.parts.push(`L${r1(x)},${r1(y)}`);
  }
  closePath() {
    if (this.pending) {
      const [x, y] = this.pending;
      const dx = x - this.sx;
      const dy = y - this.sy;
      if (dx * dx + dy * dy >= this.min2) this.parts.push(`L${r1(x)},${r1(y)}`);
      this.pending = null;
    }
    this.parts.push('Z');
  }
  arc(x, y, r) {
    this.parts.push(
      `M${r1(x + r)},${r1(y)}A${r},${r} 0 1,1 ${r1(x - r)},${r1(y)}A${r},${r} 0 1,1 ${r1(x + r)},${r1(y)}Z`,
    );
  }
  result() {
    const d = this.parts.join('');
    this.parts = [];
    return d;
  }
}

// Collects projected polygon rings instead of a path string, for the land-mask
// rasteriser. Undecimated: the mask is rasterised at plate resolution.
class RingContext {
  constructor() {
    this.rings = [];
  }
  moveTo(x, y) {
    this.ring = [x, y];
    this.rings.push(this.ring);
  }
  lineTo(x, y) {
    this.ring.push(x, y);
  }
  closePath() {}
  arc() {}
}

export function ringsOfMany(projection, features) {
  const ctx = new RingContext();
  const path = geoPath(projection, ctx);
  for (const f of features) path(f);
  return ctx.rings.filter((r) => r.length >= 6);
}

export function toPath(projection, geometry, minStep) {
  const ctx = new DecimatingContext(minStep);
  geoPath(projection, ctx)(geometry);
  return ctx.result();
}

export function pathOfMany(projection, features, minStep) {
  const ctx = new DecimatingContext(minStep);
  const path = geoPath(projection, ctx);
  for (const f of features) path(f);
  return ctx.result();
}

