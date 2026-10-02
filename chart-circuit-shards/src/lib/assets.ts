import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { staticFile } from 'remotion';

export type Assets = {
  hdri?: THREE.DataTexture;
  land?: GeoJsonFeatureCollection;
};

type Ring = number[][];
export type GeoJsonFeatureCollection = {
  features: { geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: Ring[] | Ring[][] } }[];
};

export type AssetNeeds = { hdri?: boolean; land?: boolean };

// One promise per browser tab: assets load once, then every frame reuses them.
let hdriPromise: Promise<THREE.DataTexture> | null = null;
let landPromise: Promise<GeoJsonFeatureCollection> | null = null;

export const loadAssets = async (needs: AssetNeeds): Promise<Assets> => {
  const out: Assets = {};
  if (needs.hdri) {
    hdriPromise ??= new HDRLoader()
      .setDataType(THREE.HalfFloatType)
      .loadAsync(staticFile('hdri/studio_small_03_1k.hdr'));
    out.hdri = await hdriPromise;
  }
  if (needs.land) {
    landPromise ??= fetch(staticFile('data/ne_110m_land.geojson')).then((r) => {
      if (!r.ok) throw new Error('Failed to load Natural Earth land data');
      return r.json();
    });
    out.land = await landPromise;
  }
  return out;
};
