import * as THREE from "three";
import { DEG, geoToVec3, slerpUnit } from "./sphere";
import { mulberry32 } from "./random";
import {
  GLOBE_RADIUS,
  GRID_HALF_SPAN_UNITS,
  GRID_SEGMENT_UNITS,
  GRID_SPACING_UNITS,
  ROUTE_ALTITUDE,
  ROUTE_COUNT,
  ROUTE_REACH_UNITS,
  ROUTE_SEGMENTS,
} from "./constants";

/** Arc length (world units) -> angle at the globe's centre, in degrees. */
const unitsToDeg = (units: number) => units / (GLOBE_RADIUS * DEG);

// A batch of line segments, flattened into the per-instance attribute
// layout the DepthLines material expects.
export type SegmentBatch = {
  starts: Float32Array;
  ends: Float32Array;
  count: number;
};

const buildBatch = (points: THREE.Vector3[][]): SegmentBatch => {
  let count = 0;
  for (const polyline of points) count += Math.max(0, polyline.length - 1);
  const starts = new Float32Array(count * 3);
  const ends = new Float32Array(count * 3);
  let i = 0;
  for (const polyline of points) {
    for (let s = 0; s < polyline.length - 1; s++) {
      const a = polyline[s];
      const b = polyline[s + 1];
      starts[i * 3] = a.x;
      starts[i * 3 + 1] = a.y;
      starts[i * 3 + 2] = a.z;
      ends[i * 3] = b.x;
      ends[i * 3 + 1] = b.y;
      ends[i * 3 + 2] = b.z;
      i++;
    }
  }
  return { starts, ends, count };
};

// The lat/long graticule, generated only for the window the camera track
// actually flies over. Meridians and parallels are both walked at
// SEGMENTS_PER_CELL steps per cell so the sphere's curvature is carried by
// the geometry rather than faked in the shader.
export const buildGraticule = (): SegmentBatch => {
  const polylines: THREE.Vector3[][] = [];
  const half = unitsToDeg(GRID_HALF_SPAN_UNITS);
  const spacing = unitsToDeg(GRID_SPACING_UNITS);
  const step = unitsToDeg(GRID_SEGMENT_UNITS);
  const lineCount = Math.floor(half / spacing);

  for (let k = -lineCount; k <= lineCount; k++) {
    const offset = k * spacing;

    const meridian: THREE.Vector3[] = [];
    for (let d = -half; d <= half + 1e-6; d += step) {
      meridian.push(geoToVec3(d * DEG, offset * DEG, GLOBE_RADIUS));
    }
    polylines.push(meridian);

    const parallel: THREE.Vector3[] = [];
    for (let d = -half; d <= half + 1e-6; d += step) {
      parallel.push(geoToVec3(offset * DEG, d * DEG, GLOBE_RADIUS));
    }
    polylines.push(parallel);
  }

  return buildBatch(polylines);
};

// Long great-circle arcs standing in for flight routes: the faint
// diagonals that cut across the graticule in both references. Endpoints
// are pushed well outside the visible window so every arc reads as a
// through-line rather than something that starts and stops on screen.
export const buildRoutes = (seed: number): SegmentBatch => {
  const rand = mulberry32(seed);
  const polylines: THREE.Vector3[][] = [];
  const spanDeg = unitsToDeg(GRID_HALF_SPAN_UNITS);
  const reach = unitsToDeg(ROUTE_REACH_UNITS);
  const radius = GLOBE_RADIUS + ROUTE_ALTITUDE;

  for (let i = 0; i < ROUTE_COUNT; i++) {
    // Pick a chord across the window: a random centre, a random bearing,
    // then step out to both sides far enough to exit the frame.
    const centreLat = (rand() * 2 - 1) * spanDeg * 0.7;
    const centreLon = (rand() * 2 - 1) * spanDeg * 0.7;
    const bearing = rand() * Math.PI * 2;
    const spread = reach * (0.6 + rand() * 0.8);

    const aLat = centreLat + Math.cos(bearing) * spread;
    const aLon = centreLon + Math.sin(bearing) * spread;
    const bLat = centreLat - Math.cos(bearing) * spread;
    const bLon = centreLon - Math.sin(bearing) * spread;

    const a = geoToVec3(aLat * DEG, aLon * DEG, 1);
    const b = geoToVec3(bLat * DEG, bLon * DEG, 1);

    const arc: THREE.Vector3[] = [];
    for (let s = 0; s <= ROUTE_SEGMENTS; s++) {
      arc.push(slerpUnit(a, b, s / ROUTE_SEGMENTS).multiplyScalar(radius));
    }
    polylines.push(arc);
  }

  return buildBatch(polylines);
};
