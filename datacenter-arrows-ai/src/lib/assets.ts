/**
 * Asset loading behind delayRender()/continueRender(). Every asset is
 * fetched once per tab and cached at module level; components that need
 * one get `null` until it is ready, and the frame is held until then.
 */
import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { parse as parseFont, type Font } from "opentype.js";

// ---------------------------------------------------------------- fonts (CSS)
const FONT_FACES: Array<[family: string, file: string, weight: string]> = [
  ["Inter", "fonts/Inter-Variable.ttf", "100 900"],
  ["JetBrains Mono", "fonts/JetBrainsMono-Variable.ttf", "100 800"],
  ["Montserrat", "fonts/Montserrat-SemiBold.ttf", "600"],
  ["Montserrat", "fonts/Montserrat-ExtraBold.ttf", "800"],
];

let fontsPromise: Promise<void> | null = null;
export const loadCssFonts = () => {
  if (fontsPromise) return fontsPromise;
  const handle = delayRender("Loading fonts");
  fontsPromise = Promise.all(
    FONT_FACES.map(async ([family, file, weight]) => {
      const face = new FontFace(family, `url(${staticFile(file)})`, { weight });
      await face.load();
      (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
    }),
  ).then(() => {
    continueRender(handle);
  });
  return fontsPromise;
};

// ------------------------------------------------------------ generic cache
const cache = new Map<string, { promise: Promise<unknown>; value?: unknown }>();

const load = <T,>(key: string, loader: () => Promise<T>) => {
  let entry = cache.get(key);
  if (!entry) {
    const e: { promise: Promise<unknown>; value?: unknown } = {
      promise: Promise.resolve(),
    };
    e.promise = loader().then((v) => {
      e.value = v;
      return v;
    });
    cache.set(key, e);
    entry = e;
  }
  return entry as { promise: Promise<T>; value?: T };
};

/** Returns the asset, or null while loading (with the frame held). */
export const useAsset = <T,>(key: string, loader: () => Promise<T>): T | null => {
  const entry = load(key, loader);
  const [value, setValue] = useState<T | null>(
    entry.value !== undefined ? (entry.value as T) : null,
  );
  const [handle] = useState(() =>
    entry.value !== undefined ? null : delayRender(`Loading ${key}`),
  );
  useEffect(() => {
    if (handle === null) return;
    entry.promise.then((v) => setValue(v));
  }, [entry, handle]);
  // Release only after the commit that renders with the asset, so whatever
  // mounts with it has already taken its own delayRender() handle.
  useEffect(() => {
    if (handle !== null && value !== null) continueRender(handle);
  }, [handle, value]);
  return value;
};

// -------------------------------------------------------------------- HDRI
export const HDRI_FILE = "hdri/studio_small_03_1k.hdr";
const loadHdri = () =>
  new Promise<THREE.DataTexture>((resolve, reject) => {
    new HDRLoader().load(
      staticFile(HDRI_FILE),
      (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
export const useHdri = () => useAsset("hdri", loadHdri);

// ------------------------------------------------- Montserrat glyph outlines
const loadMontserrat = async (): Promise<Font> => {
  const res = await fetch(staticFile("fonts/Montserrat-ExtraBold.ttf"));
  return parseFont(await res.arrayBuffer());
};
export const useMontserratExtraBold = () => useAsset("montserrat-800", loadMontserrat);
