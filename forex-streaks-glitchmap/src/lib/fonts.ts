import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted OFL fonts (see public/fonts/LICENSE-*). Rendering is held with
// delayRender() until every face is loaded AND document.fonts is ready, so
// canvas text can never be drawn in a fallback font.
export const FONT_MONO = "Roboto Mono";
export const FONT_DISPLAY = "Rajdhani";
export const FONT_NUMBERS = "IBM Plex Sans";

const FACES: Array<[family: string, weight: string, file: string]> = [
  [FONT_MONO, "400", "roboto-mono-latin-400-normal.woff2"],
  [FONT_MONO, "700", "roboto-mono-latin-700-normal.woff2"],
  [FONT_DISPLAY, "500", "rajdhani-latin-500-normal.woff2"],
  [FONT_DISPLAY, "600", "rajdhani-latin-600-normal.woff2"],
  [FONT_DISPLAY, "700", "rajdhani-latin-700-normal.woff2"],
  [FONT_NUMBERS, "400", "ibm-plex-sans-latin-400-normal.woff2"],
  [FONT_NUMBERS, "500", "ibm-plex-sans-latin-500-normal.woff2"],
  [FONT_NUMBERS, "600", "ibm-plex-sans-latin-600-normal.woff2"],
];

export let fontsLoaded = false;

const handle = delayRender("Loading fonts");

export const fontsReady: Promise<void> = Promise.all(
  FACES.map(async ([family, weight, file]) => {
    const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, {
      weight,
      style: "normal",
    });
    const loaded = await face.load();
    document.fonts.add(loaded);
  }),
)
  .then(() => document.fonts.ready)
  .then(() => {
    fontsLoaded = true;
    continueRender(handle);
  })
  .catch((err) => {
    // Fail loudly rather than silently render with a fallback font.
    console.error("Font loading failed", err);
    throw err;
  });

/**
 * Returns true once every font face is loaded. Holds the render (delayRender)
 * from the first render until the effect after the gated children have
 * mounted, so there is no gap in which a frame could be captured early.
 */
export const useFontsGate = (label: string): boolean => {
  const [handle] = useState(() => delayRender(label));
  const [ready, setReady] = useState(fontsLoaded);
  useEffect(() => {
    if (fontsLoaded) {
      setReady(true);
      return;
    }
    let live = true;
    fontsReady.then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle]);
  return ready;
};
