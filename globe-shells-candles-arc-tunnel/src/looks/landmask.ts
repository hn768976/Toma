import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";

// Equirectangular land mask from world-atlas land-110m (Natural Earth data),
// rasterised once into an offscreen canvas. Returns 1 byte per pixel.
export const MASK_W = 2048;
export const MASK_H = 1024;

let cached: Uint8Array | null = null;

export const landMask = (): Uint8Array => {
  if (cached) return cached;
  const topo = land110 as unknown as Topology<{ land: GeometryCollection }>;
  const fc = feature(topo, topo.objects.land) as unknown as {
    features: { geometry: { type: string; coordinates: number[][][][] | number[][][] } }[];
  };
  const canvas = document.createElement("canvas");
  canvas.width = MASK_W;
  canvas.height = MASK_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, MASK_W, MASK_H);
  ctx.fillStyle = "#fff";
  const X = (lon: number) => ((lon + 180) / 360) * MASK_W;
  const Y = (lat: number) => ((90 - lat) / 180) * MASK_H;

  const drawRing = (ring: number[][]) => {
    // Unwrap longitudes so rings that cross the antimeridian stay continuous,
    // close rings that wrap the globe (Antarctica) through the nearest pole,
    // then draw at -360/0/+360 so every part lands inside the map.
    const pts: number[][] = [];
    let prev = ring[0][0];
    let off = 0;
    for (const [lon, lat] of ring) {
      let l = lon + off;
      if (l - prev > 180) { off -= 360; l -= 360; }
      else if (l - prev < -180) { off += 360; l += 360; }
      pts.push([l, lat]);
      prev = l;
    }
    const span = pts[pts.length - 1][0] - pts[0][0];
    if (Math.abs(span) > 180) {
      const meanLat = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      const pole = meanLat < 0 ? -90 : 90;
      pts.push([pts[pts.length - 1][0], pole], [pts[0][0], pole]);
    }
    for (const shift of [-360, 0, 360]) {
      ctx.moveTo(X(pts[0][0] + shift), Y(pts[0][1]));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i][0] + shift), Y(pts[i][1]));
      ctx.closePath();
    }
  };

  for (const f of fc.features) {
    const g = f.geometry;
    const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as number[][][][];
    for (const poly of polys) {
      ctx.beginPath();
      poly.forEach(drawRing);
      ctx.fill("evenodd");
    }
  }
  const data = ctx.getImageData(0, 0, MASK_W, MASK_H).data;
  const out = new Uint8Array(MASK_W * MASK_H);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4];
  cached = out;
  return out;
};

export const sampleLand = (mask: Uint8Array, lat: number, lon: number) => {
  const x = Math.min(MASK_W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * MASK_W)));
  const y = Math.min(MASK_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * MASK_H)));
  return mask[y * MASK_W + x] / 255;
};
