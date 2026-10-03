import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

export type WorldData = { land: number[][][][]; borders: number[][][] };

const FONTS: [string, string, string][] = [
  ["Inter", "inter-latin-400-normal.woff2", "400"],
  ["Inter", "inter-latin-500-normal.woff2", "500"],
  ["Inter", "inter-latin-600-normal.woff2", "600"],
  ["Inter", "inter-latin-700-normal.woff2", "700"],
  ["JetBrains Mono", "jetbrains-mono-latin-400-normal.woff2", "400"],
  ["JetBrains Mono", "jetbrains-mono-latin-500-normal.woff2", "500"],
  ["JetBrains Mono", "jetbrains-mono-latin-600-normal.woff2", "600"],
];

let fontsPromise: Promise<void> | null = null;
const loadFonts = () => {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      FONTS.map(async ([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)})`, { weight });
        await face.load();
        (document.fonts as unknown as Set<FontFace>).add(face);
      }),
    ).then(() => undefined);
  }
  return fontsPromise;
};

const worldCache: Record<string, Promise<WorldData>> = {};
const loadWorld = (res: "50m" | "110m") => {
  if (!worldCache[res]) {
    worldCache[res] = fetch(staticFile(`data/world-${res}.json`)).then((r) => r.json());
  }
  return worldCache[res];
};

/** Fonts + Natural Earth data, behind delayRender/continueRender. */
export const useAssets = (res: "50m" | "110m") => {
  const [handle] = useState(() => delayRender(`fonts + world-${res}`));
  const [world, setWorld] = useState<WorldData | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([loadFonts(), loadWorld(res)]).then(([, w]) => {
      if (!alive) return;
      setWorld(w);
      continueRender(handle);
    });
    return () => {
      alive = false;
    };
  }, [handle, res]);
  return world;
};
