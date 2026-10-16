import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// OFL fonts shipped in public/fonts (licences alongside).
export const MONO = "JetBrains Mono";
export const SANS = "Inter";

const FILES: [string, string, string][] = [
  [MONO, "400", "fonts/JetBrainsMono-400.woff2"],
  [MONO, "500", "fonts/JetBrainsMono-500.woff2"],
  [MONO, "700", "fonts/JetBrainsMono-700.woff2"],
  [SANS, "400", "fonts/Inter-400.woff2"],
  [SANS, "500", "fonts/Inter-500.woff2"],
  [SANS, "700", "fonts/Inter-700.woff2"],
];

let promise: Promise<void> | null = null;

export const loadFonts = () => {
  if (!promise) {
    promise = Promise.all(
      FILES.map(async ([family, weight, file]) => {
        const face = new FontFace(family, `url(${staticFile(file)}) format("woff2")`, { weight });
        await face.load();
        (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
      }),
    ).then(() => undefined);
  }
  return promise;
};

// One-time gate: textures are drawn into canvases with these fonts, so
// nothing is built until they're loaded.
export const useFontsReady = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadFonts()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        throw e;
      });
  }, [handle]);
  return ready;
};
