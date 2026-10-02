import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Natural Earth 1:50m land (public domain), shipped in public/data.
// Antarctica is left out everywhere.

export type Ring = [number, number][]; // [lon, lat]
export type Polygon = Ring[]; // outer ring + holes

export type LandData = {
  polygons: Polygon[];
  /** Equirectangular land mask, MASK_W x MASK_H, 1 = land. */
  mask: Uint8Array;
};

export const MASK_W = 2048;
export const MASK_H = 1024;
const ANTARCTIC_CUTOFF = -56; // polygons entirely south of this are dropped

let landPromise: Promise<LandData> | null = null;

const buildMask = (polygons: Polygon[]): Uint8Array => {
  const canvas = document.createElement("canvas");
  canvas.width = MASK_W;
  canvas.height = MASK_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, MASK_W, MASK_H);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  for (const poly of polygons) {
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * MASK_W;
        const y = ((90 - lat) / 180) * MASK_H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
  }
  ctx.fill("evenodd");
  const px = ctx.getImageData(0, 0, MASK_W, MASK_H).data;
  const mask = new Uint8Array(MASK_W * MASK_H);
  for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4] > 127 ? 1 : 0;
  return mask;
};

export const loadLand = (): Promise<LandData> => {
  if (!landPromise) {
    landPromise = fetch(staticFile("data/ne_50m_land.geojson"))
      .then((r) => r.json())
      .then((geo: { features: { geometry: { type: string; coordinates: unknown } }[] }) => {
        const polygons: Polygon[] = [];
        for (const f of geo.features) {
          const g = f.geometry;
          const list = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Polygon[];
          for (const poly of list) {
            let maxLat = -90;
            for (const [, lat] of poly[0]) maxLat = Math.max(maxLat, lat);
            if (maxLat < ANTARCTIC_CUTOFF) continue;
            polygons.push(poly);
          }
        }
        return { polygons, mask: buildMask(polygons) };
      });
  }
  return landPromise;
};

/** Land data, or null until loaded (rendering is held until it arrives). */
export const useLand = (): LandData | null => {
  const [handle] = useState(() => delayRender("Loading Natural Earth land"));
  const [land, setLand] = useState<LandData | null>(null);
  useEffect(() => {
    loadLand().then(setLand);
  }, []);
  useEffect(() => {
    if (land) continueRender(handle);
  }, [land, handle]);
  return land;
};

/** Is (lon, lat) on land? Nearest-pixel lookup in the mask. */
export const isLand = (mask: Uint8Array, lon: number, lat: number): boolean => {
  const x = Math.min(MASK_W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * MASK_W)));
  const y = Math.min(MASK_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * MASK_H)));
  return mask[y * MASK_W + x] === 1;
};
