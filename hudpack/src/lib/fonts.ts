import { continueRender, delayRender, staticFile } from "remotion";
import { useLayoutEffect, useRef, useState } from "react";

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

/**
 * True once every font is loaded; holds the render until then. The hold is
 * released in a layout effect *after* the re-render with `ready = true` has
 * committed, so anything mounted by that render (e.g. a <ThreeCanvas> with
 * its own delayRender) is already holding the frame. Releasing it straight
 * from the promise would leave a gap in which a frame could be captured
 * before the scene exists.
 */
export const useFontsReady = () => {
  const [ready, setReady] = useState(false);
  const handle = useRef<number | null>(null);
  useLayoutEffect(() => {
    let alive = true;
    handle.current = delayRender("Loading fonts");
    loadFonts()
      .then(() => {
        if (alive) setReady(true);
      })
      .catch((e) => {
        console.error(e);
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
      if (handle.current !== null) continueRender(handle.current);
      handle.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    if (ready && handle.current !== null) {
      continueRender(handle.current);
      handle.current = null;
    }
  }, [ready]);
  return ready;
};
