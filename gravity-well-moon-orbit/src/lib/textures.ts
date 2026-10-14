import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";

/**
 * NASA textures (public domain), see README for credits.
 * Loaded once per page and shared by every scene on that page.
 */
const FILES = {
  earthDay: "textures/earth_day_4k.jpg",
  earthClouds: "textures/earth_clouds_4k.jpg",
  earthOcean: "textures/earth_ocean_mask.png",
  moonColor: "textures/moon_lroc_color_4k.jpg",
  moonBump: "textures/moon_lola_bump_1k.jpg",
} as const;

export type TextureSet = Record<keyof typeof FILES, THREE.Texture>;

const COLOR_MAPS = new Set<keyof typeof FILES>(["earthDay", "moonColor"]);

let cache: Promise<TextureSet> | null = null;

const loadAll = (): Promise<TextureSet> => {
  if (cache) return cache;
  const loader = new THREE.TextureLoader();
  const entries = Object.entries(FILES) as [keyof typeof FILES, string][];
  cache = Promise.all(
    entries.map(
      ([key, file]) =>
        new Promise<[keyof typeof FILES, THREE.Texture]>((resolve, reject) => {
          loader.load(
            staticFile(file),
            (tex) => {
              tex.colorSpace = COLOR_MAPS.has(key)
                ? THREE.SRGBColorSpace
                : THREE.NoColorSpace;
              tex.anisotropy = 8;
              tex.wrapS = THREE.RepeatWrapping;
              tex.wrapT = THREE.ClampToEdgeWrapping;
              tex.generateMipmaps = true;
              tex.minFilter = THREE.LinearMipmapLinearFilter;
              tex.magFilter = THREE.LinearFilter;
              resolve([key, tex]);
            },
            undefined,
            reject,
          );
        }),
    ),
  ).then((pairs) => Object.fromEntries(pairs) as TextureSet);
  return cache;
};

/** Holds the render (delayRender) until every texture has decoded. */
export const useTextures = (): TextureSet | null => {
  const [handle] = useState(() => delayRender("Loading NASA textures"));
  const [textures, setTextures] = useState<TextureSet | null>(null);
  useEffect(() => {
    let alive = true;
    loadAll()
      .then((t) => {
        if (alive) setTextures(t);
      })
      .catch((err) => cancelRender(err));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (textures) continueRender(handle);
  }, [textures, handle]);
  return textures;
};
