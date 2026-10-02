import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { staticFile } from "remotion";

// Shipped assets: Poly Haven studio HDRI (CC0) and Natural Earth land
// polygons (public domain). Loaded once per tab, behind delayRender.

export type Assets = {
  hdri?: THREE.DataTexture;
  land?: THREE.CanvasTexture;
};

export type AssetNeeds = { hdri?: boolean; land?: boolean };

let hdriPromise: Promise<THREE.DataTexture> | null = null;
let landPromise: Promise<THREE.CanvasTexture> | null = null;

export const HDRI_FILE = "hdri/studio_small_03_1k.hdr";
export const LAND_FILE = "naturalearth/ne_50m_land.geojson";

const loadHdri = () => {
  if (!hdriPromise) {
    hdriPromise = new HDRLoader()
      .setDataType(THREE.HalfFloatType)
      .loadAsync(staticFile(HDRI_FILE))
      .then((t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        return t as THREE.DataTexture;
      });
  }
  return hdriPromise;
};

type Ring = number[][];
type Geom = { type: string; coordinates: Ring[] | Ring[][] };

// Rasterise Natural Earth land polygons into an equirectangular mask.
// Canvas 2D rasterisation is deterministic, and it happens once per tab.
const LAND_W = 4096;
const LAND_H = 2048;
const loadLand = () => {
  if (!landPromise) {
    landPromise = fetch(staticFile(LAND_FILE))
      .then((r) => r.json() as Promise<{ features: { geometry: Geom }[] }>)
      .then((geo: { features: { geometry: Geom }[] }) => {
        const canvas = document.createElement("canvas");
        canvas.width = LAND_W;
        canvas.height = LAND_H;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, LAND_W, LAND_H);
        ctx.fillStyle = "#fff";
        const drawRing = (ring: Ring) => {
          ring.forEach(([lon, lat], i) => {
            const x = ((lon + 180) / 360) * LAND_W;
            const y = ((90 - lat) / 180) * LAND_H;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        };
        for (const f of geo.features) {
          const g = f.geometry;
          const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Ring[][];
          for (const poly of polys) {
            ctx.beginPath();
            poly.forEach(drawRing);
            ctx.fill("evenodd");
          }
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.NoColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.anisotropy = 8;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        return tex;
      });
  }
  return landPromise;
};

export const loadAssets = async (needs: AssetNeeds): Promise<Assets> => {
  const [hdri, land] = await Promise.all([
    needs.hdri ? loadHdri() : Promise.resolve(undefined),
    needs.land ? loadLand() : Promise.resolve(undefined),
  ]);
  return { hdri, land };
};
