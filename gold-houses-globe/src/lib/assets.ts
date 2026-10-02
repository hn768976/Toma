import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { staticFile } from "remotion";

// Every external input (HDRI, map data, font) is loaded once per tab through a
// cached promise; <Stage> holds a delayRender() until all requested ones resolve.

export type AssetKey = "hdri" | "globe" | "font";
export type GlobeData = { step: number; dots: number[]; pins: [number, number][] };
export type Assets = { hdri?: THREE.DataTexture; globe?: GlobeData; font?: string };

const cache = new Map<AssetKey, Promise<unknown>>();

const loaders: Record<AssetKey, () => Promise<unknown>> = {
  hdri: () =>
    new HDRLoader()
      .setDataType(THREE.HalfFloatType)
      .loadAsync(staticFile("hdri/studio_small_03_1k.hdr"))
      .then((t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        return t;
      }),
  globe: () => fetch(staticFile("data/globe.json")).then((r) => r.json()),
  font: async () => {
    const face = new FontFace("InterBold", `url(${staticFile("fonts/Inter-Bold.woff2")})`, { weight: "700" });
    await face.load();
    (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
    return "InterBold";
  },
};

export const loadAssets = async (keys: AssetKey[]): Promise<Assets> => {
  const out: Record<string, unknown> = {};
  await Promise.all(
    keys.map(async (k) => {
      if (!cache.has(k)) cache.set(k, loaders[k]());
      out[k] = await cache.get(k);
    }),
  );
  return out as Assets;
};
