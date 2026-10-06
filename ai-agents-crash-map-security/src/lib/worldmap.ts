import { staticFile } from "remotion";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

// Natural Earth land (public domain) via world-atlas TopoJSON, rasterised once
// into an equirectangular mask. Everything derived from it is deterministic.
const MASK_W = 4096;
const MASK_H = 2048;

export type LandMask = {
  isLand: (lon: number, lat: number) => boolean;
  canvas: HTMLCanvasElement;
};

let maskPromise: Promise<LandMask> | null = null;
let maskValue: LandMask | null = null;

export const loadLandMask = (): Promise<LandMask> => {
  if (!maskPromise) {
    maskPromise = fetch(staticFile("data/land-50m.json"))
      .then((r) => r.json())
      .then((topo: Topology) => {
        const land = feature(topo, topo.objects.land as GeometryCollection);
        const canvas = document.createElement("canvas");
        canvas.width = MASK_W;
        canvas.height = MASK_H;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, MASK_W, MASK_H);
        ctx.fillStyle = "#fff";
        const px = (lon: number) => ((lon + 180) / 360) * MASK_W;
        const py = (lat: number) => ((90 - lat) / 180) * MASK_H;
        // Rings that cross the antimeridian are unwrapped (no ±360° jumps) and
        // drawn at -360/0/+360 so nothing smears a band across the map.
        const drawPolygon = (poly: number[][][]) => {
          const rings = poly.map((ring) => {
            let prev = ring[0][0];
            let shift = 0;
            return ring.map(([lon, lat]) => {
              if (lon - prev > 180) shift -= 360;
              if (lon - prev < -180) shift += 360;
              prev = lon;
              return [lon + shift, lat];
            });
          });
          for (const off of [-360, 0, 360]) {
            ctx.beginPath();
            for (const ring of rings) {
              ring.forEach(([lon, lat], i) => {
                if (i === 0) ctx.moveTo(px(lon + off), py(lat));
                else ctx.lineTo(px(lon + off), py(lat));
              });
              ctx.closePath();
            }
            ctx.fill("evenodd");
          }
        };
        const feats = "features" in land ? land.features : [land];
        for (const f of feats) {
          const g = f.geometry;
          if (!g) continue;
          if (g.type === "Polygon") drawPolygon(g.coordinates as number[][][]);
          if (g.type === "MultiPolygon")
            for (const p of g.coordinates as number[][][][]) drawPolygon(p);
        }
        const data = ctx.getImageData(0, 0, MASK_W, MASK_H).data;
        const isLand = (lon: number, lat: number) => {
          const x = Math.min(MASK_W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * MASK_W)));
          const y = Math.min(MASK_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * MASK_H)));
          return data[(y * MASK_W + x) * 4] > 127;
        };
        maskValue = { isLand, canvas };
        return maskValue;
      });
  }
  return maskPromise;
};

export const getLandMask = (): LandMask => {
  if (!maskValue) throw new Error("Land mask not loaded");
  return maskValue;
};

export type MapDot = { u: number; v: number; lon: number; lat: number; i: number; j: number };

// Regular grid of land cells, (u, v) in [0,1] over lon [-180,180] and
// lat [latTop, latBottom]. Each cell samples a few points for coverage.
export const landDots = (cols: number, rows: number, latTop = 83, latBottom = -57): MapDot[] => {
  const { isLand } = getLandMask();
  const out: MapDot[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u = (i + 0.5) / cols;
      const v = (j + 0.5) / rows;
      const lon = -180 + u * 360;
      const lat = latTop + (latBottom - latTop) * v;
      const du = 0.3 * (360 / cols);
      const dv = 0.3 * ((latTop - latBottom) / rows);
      let hits = 0;
      if (isLand(lon, lat)) hits += 2;
      if (isLand(lon - du, lat - dv)) hits++;
      if (isLand(lon + du, lat + dv)) hits++;
      if (isLand(lon + du, lat - dv)) hits++;
      if (isLand(lon - du, lat + dv)) hits++;
      if (hits >= 3) out.push({ u, v, lon, lat, i, j });
    }
  }
  return out;
};

// Some invented hub locations (lon, lat) used for network lines.
export const HUBS: [number, number][] = [
  [-122, 38], [-100, 45], [-74, 41], [-87, 30], [-58, -23], [-46, -12], [-70, -33],
  [-3, 50], [10, 52], [28, 45], [37, 56], [3, 15], [18, -30], [36, -2], [47, 25],
  [77, 22], [104, 32], [116, 40], [139, 36], [126, 37], [103, 2], [151, -33], [133, -24],
  [60, 56], [90, 62], [-150, 62], [-106, 60], [24, 63],
];
