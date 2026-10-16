import { continueRender, delayRender, staticFile } from "remotion";
import { useLayoutEffect, useState } from "react";

// OFL fonts shipped in public/fonts (licence texts next to them). JetBrains
// Mono is the "NL" cut, without ligatures, so "<=" stays two characters.
export const INTER = "HP Inter";
export const MONO = "HP JetBrains Mono";

const faces: [string, string, string][] = [
  [INTER, "Inter-Light.woff2", "300"],
  [INTER, "Inter-Regular.woff2", "400"],
  [INTER, "Inter-Medium.woff2", "500"],
  [MONO, "JetBrainsMonoNL-Light.ttf", "300"],
  [MONO, "JetBrainsMonoNL-Regular.ttf", "400"],
];

let fontsPromise: Promise<void> | null = null;

export const loadFonts = () => {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      faces.map(async ([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)})`, { weight });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => undefined);
  }
  return fontsPromise;
};

/** True once every font is loaded; holds the render until then. */
export const useFontsReady = () => {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    let alive = true;
    const handle = delayRender("Loading fonts");
    loadFonts()
      .then(() => {
        if (alive) setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        continueRender(handle);
      });
    return () => {
      alive = false;
    };
  }, []);
  return ready;
};
