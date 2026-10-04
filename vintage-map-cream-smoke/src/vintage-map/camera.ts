import type { GeoProjection } from "d3-geo";
import type { MapRegion } from "./regions";
import { toPlane } from "./projection";

// Shared look constants for every map version.
export const MAP_CAMERA = {
  // Camera elevation above the paper (degrees); 90 would be straight down.
  // 50 = the paper tilted 40 degrees from flat (facing the camera).
  elevationDeg: 50,
  verticalFovDeg: 27,
  aspect: 16 / 9,
  durationInFrames: 600,
  // Texture density target at the nearest visible point.
  nearTexelsPerPixel: 1.6,
};

export type V3 = [number, number, number];

export type CameraState = {
  position: V3;
  target: V3;
  up: V3;
};

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));

const easeInOut = (t: number) => t * t * t * (t * (t * 6 - 15) + 10); // smootherstep

export type CameraPath = {
  focusStart: [number, number];
  focusEnd: [number, number];
  viewWidth: number; // plane units
  distance: number; // camera to focus point
  headingStart: number;
  headingEnd: number;
};

export const tanHalfV = () => Math.tan((MAP_CAMERA.verticalFovDeg * Math.PI) / 360);
export const tanHalfH = () => tanHalfV() * MAP_CAMERA.aspect;

export const makeCameraPath = (region: MapRegion, proj: GeoProjection): CameraPath => {
  const [lon, lat] = region.focusStart;
  const a = toPlane(proj, [lon - region.viewWidthDeg / 2, lat]);
  const b = toPlane(proj, [lon + region.viewWidthDeg / 2, lat]);
  const viewWidth = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {
    focusStart: toPlane(proj, region.focusStart),
    focusEnd: toPlane(proj, region.focusEnd),
    viewWidth,
    distance: viewWidth / (2 * tanHalfH()),
    headingStart: region.headingStart,
    headingEnd: region.headingEnd,
  };
};

// Camera at a given frame. t runs 0..1 over the clip, eased at both ends.
export const cameraAt = (path: CameraPath, frame: number): CameraState => {
  const t = easeInOut(Math.min(1, Math.max(0, frame / (MAP_CAMERA.durationInFrames - 1))));
  const fx = path.focusStart[0] + (path.focusEnd[0] - path.focusStart[0]) * t;
  const fy = path.focusStart[1] + (path.focusEnd[1] - path.focusStart[1]) * t;
  const heading = ((path.headingStart + (path.headingEnd - path.headingStart) * t) * Math.PI) / 180;
  const elev = (MAP_CAMERA.elevationDeg * Math.PI) / 180;
  const dir: V3 = [Math.sin(heading), Math.cos(heading), 0];
  const target: V3 = [fx, fy, 0];
  const position = add(target, add(mul(dir, -Math.cos(elev) * path.distance), [0, 0, Math.sin(elev) * path.distance]));
  return { position, target, up: [0, 0, 1] };
};

export type CameraBasis = { pos: V3; fwd: V3; right: V3; up: V3 };
export const basisOf = (c: CameraState): CameraBasis => {
  const fwd = norm(sub(c.target, c.position));
  const right = norm(cross(fwd, c.up));
  const up = cross(right, fwd);
  return { pos: c.position, fwd, right, up };
};

// Where the ray through NDC (x, y) hits the paper (z = 0).
export const rayHit = (b: CameraBasis, x: number, y: number): [number, number] => {
  const d = add(b.fwd, add(mul(b.right, x * tanHalfH()), mul(b.up, y * tanHalfV())));
  const s = -b.pos[2] / d[2];
  return [b.pos[0] + d[0] * s, b.pos[1] + d[1] * s];
};

// View-space depth of the paper point seen through NDC (x, y).
export const depthAt = (b: CameraBasis, x: number, y: number) => {
  const d = add(b.fwd, add(mul(b.right, x * tanHalfH()), mul(b.up, y * tanHalfV())));
  return -b.pos[2] / d[2];
};

// Paper area the camera sees over the whole clip, plus the texture density
// needed so the nearest visible point gets nearTexelsPerPixel.
export const planFootprint = (path: CameraPath, screenWidthPx: number) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  let nearWidth = Infinity;
  for (let i = 0; i <= 12; i++) {
    const b = basisOf(cameraAt(path, (i / 12) * (MAP_CAMERA.durationInFrames - 1)));
    for (let j = 0; j <= 16; j++) {
      const s = -1 + (2 * j) / 16;
      for (const [x, y] of [[s, -1], [s, 1], [-1, s], [1, s]]) {
        const [hx, hy] = rayHit(b, x, y);
        x0 = Math.min(x0, hx); x1 = Math.max(x1, hx);
        y0 = Math.min(y0, hy); y1 = Math.max(y1, hy);
      }
    }
    const l = rayHit(b, -1, -1);
    const r = rayHit(b, 1, -1);
    nearWidth = Math.min(nearWidth, Math.hypot(r[0] - l[0], r[1] - l[1]));
  }
  const mx = (x1 - x0) * 0.04;
  const my = (y1 - y0) * 0.04;
  const texelsPerUnit = (MAP_CAMERA.nearTexelsPerPixel * screenWidthPx) / nearWidth;
  return {
    // plane units, y up
    minX: x0 - mx,
    maxX: x1 + mx,
    minY: y0 - my,
    maxY: y1 + my,
    texelsPerUnit,
    nearWidth,
  };
};
