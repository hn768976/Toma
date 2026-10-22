import { geoProjection, GeoProjection } from "d3-geo";

/** Miller cylindrical projection (raw, radians). */
export const millerRaw = (lambda: number, phi: number): [number, number] => [
  lambda,
  1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * phi)),
];
(millerRaw as unknown as { invert: (x: number, y: number) => [number, number] }).invert = (
  x: number,
  y: number,
) => [x, 2.5 * Math.atan(Math.exp(0.8 * y)) - 0.625 * Math.PI];

export const MILLER_YMAX = millerRaw(0, (85 * Math.PI) / 180)[1];

export type MapCamera = { lon: number; lat: number; k: number };

const RAD = Math.PI / 180;

/**
 * Projection for a viewport of `w`×`h` px. At k = 1 the full 360° of
 * longitude spans the viewport width.
 */
export const makeProjection = (cam: MapCamera, w: number, h: number): GeoProjection => {
  const s = (cam.k * w) / (2 * Math.PI);
  const [x0, y0] = millerRaw(cam.lon * RAD, cam.lat * RAD);
  return geoProjection(millerRaw as never)
    .scale(s)
    .translate([w / 2 - s * x0, h / 2 + s * y0])
    .precision(0.3);
};

/** Fast forward projection for HUD markers (design px). */
export const projectPoint = (cam: MapCamera, lon: number, lat: number, w: number, h: number) => {
  const s = (cam.k * w) / (2 * Math.PI);
  const [x0, y0] = millerRaw(cam.lon * RAD, cam.lat * RAD);
  const [x, y] = millerRaw(lon * RAD, lat * RAD);
  return { x: w / 2 + s * (x - x0), y: h / 2 - s * (y - y0) };
};
