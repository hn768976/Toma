import { geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import land50m from "world-atlas/land-50m.json";

export type LandMask = {
  /** 1 on land, 0 on water. Longitude/latitude in degrees. */
  isLand: (lonDeg: number, latDeg: number) => boolean;
  /** True for land pixels within `radiusPx` texels of the coastline. */
  isCoast: (lonDeg: number, latDeg: number) => boolean;
};

/**
 * Rasterises Natural Earth 1:50m land polygons (bundled with the
 * `world-atlas` package, no network needed) into an equirectangular mask.
 */
export const buildLandMask = (width = 2048, height = 1024): LandMask => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");

  const topo = land50m as unknown as Topology<{ land: GeometryCollection }>;
  const landGeo = feature(topo, topo.objects.land);
  const projection = geoEquirectangular()
    .scale(width / (2 * Math.PI))
    .translate([width / 2, height / 2]);
  const path = geoPath(projection, ctx);

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.beginPath();
  path(landGeo);
  ctx.fillStyle = "#fff";
  ctx.fill();

  const data = ctx.getImageData(0, 0, width, height).data;
  const at = (x: number, y: number) => {
    const xi = ((Math.floor(x) % width) + width) % width;
    const yi = Math.min(height - 1, Math.max(0, Math.floor(y)));
    return data[(yi * width + xi) * 4] > 127;
  };
  const toXY = (lon: number, lat: number): [number, number] => [
    ((lon + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];

  return {
    isLand: (lon, lat) => {
      const [x, y] = toXY(lon, lat);
      return at(x, y);
    },
    isCoast: (lon, lat) => {
      const [x, y] = toXY(lon, lat);
      if (!at(x, y)) return false;
      const r = 3;
      return !(at(x + r, y) && at(x - r, y) && at(x, y + r) && at(x, y - r));
    },
  };
};
