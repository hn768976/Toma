import { isLand } from "./landmask";
import { mulberry32 } from "./random";

/**
 * All globe geometry is built exactly once, here at module level, and shared by
 * every composition and every frame. Nothing in this file looks at the frame
 * number - the clip animates by rotating a group and by feeding uniforms, never
 * by rebuilding buffers.
 *
 * Convention: unit sphere, +Y is the north pole, lon 0 faces +Z (the camera).
 */

const DEG = Math.PI / 180;

export const lonLatToVec3 = (
  lonDeg: number,
  latDeg: number,
): [number, number, number] => {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const c = Math.cos(lat);
  return [c * Math.sin(lon), Math.sin(lat), c * Math.cos(lon)];
};

// ---------------------------------------------------------------- continents

/** Row pitch in degrees. Measured off the reference, which runs a 1 deg grid. */
const LAT_STEP = 1;
/**
 * Longitude pitch near the equator.
 *
 * Deliberately 1.25 and not 1.0. The globe turns 0.6 deg per frame (360 deg
 * over 600), so with a 1 deg pitch the dot lattice lands exactly three pitches
 * on from where it started every five frames: continent interiors then repeat
 * at 6 Hz and the dot field visibly strobes instead of gliding. At 1.25 the
 * shift is 0.48 pitches per frame, so the lattice only realigns every 25 frames
 * - by which point the globe has turned 15 deg and the coastlines have moved
 * far enough that nothing reads as a repeat.
 *
 * Latitude is not affected: the spin is about the polar axis, so rows never
 * move along themselves.
 */
const LON_STEP = 1.25;

/**
 * Pitch steps up in powers of two toward the poles. Every step stays a multiple
 * of the base pitch, so the dots remain column-aligned - that is what gives the
 * reference its engineered, vertically-striped look - while density stays
 * roughly even instead of bunching into a solid mass at the caps.
 */
const lonStepAt = (absLat: number): number => {
  if (absLat > 83) return LON_STEP * 8;
  if (absLat > 75) return LON_STEP * 4;
  if (absLat > 60) return LON_STEP * 2;
  return LON_STEP;
};

const buildContinentDots = () => {
  const rng = mulberry32(0x5eed01);
  const pos: number[] = [];
  const sizeMul: number[] = [];
  const accent: number[] = [];

  for (let i = 0; i < 180 / LAT_STEP; i++) {
    const lat = -90 + (i + 0.5) * LAT_STEP;
    const step = lonStepAt(Math.abs(lat));
    for (let lon = -180; lon < 180; lon += step) {
      if (!isLand(lon, lat)) continue;
      const [x, y, z] = lonLatToVec3(lon, lat);
      pos.push(x, y, z);
      // A few larger, darker dots scattered through, breaking the uniformity.
      const isAccent = rng() < 0.035;
      accent.push(isAccent ? 1 : 0);
      sizeMul.push(isAccent ? 1.45 + rng() * 0.45 : 0.9 + rng() * 0.2);
    }
  }

  return {
    count: pos.length / 3,
    position: new Float32Array(pos),
    sizeMul: new Float32Array(sizeMul),
    accent: new Float32Array(accent),
  };
};

export const CONTINENT_DOTS = buildContinentDots();

// --------------------------------------------------------------------- nodes

const NODE_TARGET = 96;
/** Minimum angular gap between nodes, in degrees, relaxed if placement stalls. */
const NODE_MIN_SEP = 10;

const buildNodes = () => {
  const rng = mulberry32(0x5eed02);
  const pts: [number, number, number][] = [];
  let minSep = Math.cos(NODE_MIN_SEP * DEG);
  let attempts = 0;

  while (pts.length < NODE_TARGET && attempts < 400000) {
    attempts++;
    // Uniform on the sphere, then rejected unless it lands on a continent.
    const lat = Math.asin(2 * rng() - 1) / DEG;
    const lon = rng() * 360 - 180;
    if (!isLand(lon, lat)) continue;
    const p = lonLatToVec3(lon, lat);
    let ok = true;
    for (const q of pts) {
      if (p[0] * q[0] + p[1] * q[1] + p[2] * q[2] > minSep) {
        ok = false;
        break;
      }
    }
    if (!ok) {
      // Relax the spacing rather than spin forever if the land is full.
      if (attempts % 40000 === 0) minSep = Math.cos((NODE_MIN_SEP - 2) * DEG);
      continue;
    }
    pts.push(p);
  }

  const position = new Float32Array(pts.length * 3);
  const phase = new Float32Array(pts.length);
  const pulses = new Float32Array(pts.length);
  const cycles = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    position.set(pts[i], i * 3);
    phase[i] = rng();
    // Only a minority pulse, and each completes a whole number of cycles per
    // loop so the 600th frame lands exactly on the 0th.
    pulses[i] = rng() < 0.32 ? 1 : 0;
    cycles[i] = 2 + Math.floor(rng() * 3);
  }

  return { count: pts.length, position, phase, pulses, cycles, pts };
};

export const NODES = buildNodes();

// -------------------------------------------------------------------- chords

/** Nodes closer than this (degrees apart) may be linked. */
const CHORD_MAX_DEG = 30;
/** Cap on links per node - keeps clusters legible instead of matting together. */
const CHORD_MAX_PER_NODE = 6;

const buildChords = () => {
  const { pts } = NODES;
  const cosMax = Math.cos(CHORD_MAX_DEG * DEG);
  const degreeCount = new Int32Array(pts.length);
  const seen = new Set<number>();
  const pairs: { a: number; b: number; w: number }[] = [];

  // Consider candidate pairs shortest-first so the cap keeps the tight,
  // triangulated local clusters and drops the long stragglers.
  const cand: { a: number; b: number; d: number }[] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dot =
        pts[i][0] * pts[j][0] + pts[i][1] * pts[j][1] + pts[i][2] * pts[j][2];
      if (dot <= cosMax) continue;
      cand.push({ a: i, b: j, d: Math.acos(Math.min(1, dot)) / DEG });
    }
  }
  cand.sort((p, q) => p.d - q.d);

  for (const c of cand) {
    if (degreeCount[c.a] >= CHORD_MAX_PER_NODE) continue;
    if (degreeCount[c.b] >= CHORD_MAX_PER_NODE) continue;
    const key = c.a * 10000 + c.b;
    if (seen.has(key)) continue;
    seen.add(key);
    degreeCount[c.a]++;
    degreeCount[c.b]++;
    // Opacity falls with angular distance, so links fade rather than snap.
    const t = c.d / CHORD_MAX_DEG;
    const w = 1 - Math.max(0, Math.min(1, (t - 0.3) / 0.7));
    pairs.push({ a: c.a, b: c.b, w: 0.25 + 0.75 * w });
  }

  // One merged ribbon buffer: four vertices and two triangles per chord. The
  // chords are static in object space (the whole globe spins as one group), so
  // this is built once; only the shader uniforms change per frame.
  const n = pairs.length;
  const position = new Float32Array(n * 4 * 3);
  const other = new Float32Array(n * 4 * 3);
  const side = new Float32Array(n * 4);
  const alpha = new Float32Array(n * 4);
  const index = new Uint32Array(n * 6);

  for (let k = 0; k < n; k++) {
    const A = pts[pairs[k].a];
    const B = pts[pairs[k].b];
    const ends = [A, A, B, B];
    const opp = [B, B, A, A];
    for (let v = 0; v < 4; v++) {
      position.set(ends[v], (k * 4 + v) * 3);
      other.set(opp[v], (k * 4 + v) * 3);
      side[k * 4 + v] = v % 2 === 0 ? -1 : 1;
      alpha[k * 4 + v] = pairs[k].w;
    }
    const o = k * 4;
    index.set([o, o + 1, o + 2, o + 2, o + 1, o + 3], k * 6);
  }

  return { count: n, position, other, side, alpha, index, pairs };
};

export const CHORDS = buildChords();

// ---------------------------------------------------------------- travellers

/** A handful of dots running the chords. Rare on purpose - the reference is calm. */
const TRAVELLER_COUNT = 14;

const buildTravellers = () => {
  const rng = mulberry32(0x5eed03);
  const { pairs } = CHORDS;
  const n = Math.min(TRAVELLER_COUNT, pairs.length);
  const start = new Float32Array(n * 3);
  const end = new Float32Array(n * 3);
  const phase = new Float32Array(n);
  const trips = new Float32Array(n);

  const used = new Set<number>();
  for (let i = 0; i < n; i++) {
    let idx = Math.floor(rng() * pairs.length);
    let guard = 0;
    while (used.has(idx) && guard++ < 100) idx = Math.floor(rng() * pairs.length);
    used.add(idx);
    const p = pairs[idx];
    const forward = rng() < 0.5;
    start.set(NODES.pts[forward ? p.a : p.b], i * 3);
    end.set(NODES.pts[forward ? p.b : p.a], i * 3);
    phase[i] = rng();
    // Whole trips per loop, so every traveller is back where it started.
    trips[i] = 1 + Math.floor(rng() * 2);
  }

  return { count: n, start, end, phase, trips };
};

export const TRAVELLERS = buildTravellers();
