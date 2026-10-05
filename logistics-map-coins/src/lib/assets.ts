import {useEffect, useState} from 'react';
import {staticFile, useDelayRender} from 'remotion';

// Module-level cache: each browser tab loads every asset once, then all frames
// rendered in that tab share it. Assets are immutable after loading.
const cache = new Map<string, Promise<unknown>>();

export const once = <T,>(key: string, load: () => Promise<T>): Promise<T> => {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load();
    cache.set(key, p);
  }
  return p;
};

export const loadJson = <T,>(path: string) =>
  once(`json:${path}`, async () => {
    const r = await fetch(staticFile(path));
    if (!r.ok) throw new Error(`Failed to load ${path}`);
    return (await r.json()) as T;
  });

export const loadBinary = (path: string) =>
  once(`bin:${path}`, async () => {
    const r = await fetch(staticFile(path));
    if (!r.ok) throw new Error(`Failed to load ${path}`);
    return await r.arrayBuffer();
  });

export const loadImage = (path: string) =>
  once(`img:${path}`, () => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${path}`));
      img.src = staticFile(path);
    });
  });

const FONTS: [string, string, string][] = [
  ['Rajdhani', 'fonts/rajdhani-latin-500-normal.woff2', '500'],
  ['Rajdhani', 'fonts/rajdhani-latin-600-normal.woff2', '600'],
  ['Rajdhani', 'fonts/rajdhani-latin-700-normal.woff2', '700'],
  ['JetBrains Mono', 'fonts/jetbrains-mono-latin-400-normal.woff2', '400'],
  ['JetBrains Mono', 'fonts/jetbrains-mono-latin-500-normal.woff2', '500'],
];

export const loadFonts = () =>
  once('fonts', async () => {
    await Promise.all(
      FONTS.map(async ([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(file)})`, {weight});
        await face.load();
        (document.fonts as unknown as {add: (f: FontFace) => void}).add(face);
      }),
    );
    return true;
  });

// Loads something behind delayRender/continueRender. The state here is only a
// loading gate (null until ready); it never drives per-frame visuals.
export const useLoaded = <T,>(key: string, load: () => Promise<T>): T | null => {
  const {delayRender, continueRender, cancelRender} = useDelayRender();
  const [value, setValue] = useState<T | null>(null);
  const [handle] = useState(() => delayRender(`Loading ${key}`, {timeoutInMilliseconds: 120000}));
  useEffect(() => {
    let alive = true;
    once(key, load)
      .then((v) => alive && setValue(v as T))
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    // Released only after the children that depend on the asset have mounted
    // (and registered their own delayRender handles).
    if (value !== null) continueRender(handle);
  }, [value, handle, continueRender]);
  return value;
};
