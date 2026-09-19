// Fonts for the glitch-alert composition, self-hosted from /public so a
// render never waits on (or silently falls back because of) a network
// fetch. Each registers a delayRender() handle, which keeps Remotion from
// capturing frame 0 until the glyphs are actually measurable — otherwise
// the first frames render in a fallback face at the wrong width.

import { continueRender, delayRender, staticFile } from "remotion";

/** Heavy grotesque used for the headline. */
export const DISPLAY_FONT = "Archivo Black";
/** Monospace used for the faint code fragments and binary digits. */
export const MONO_FONT = "Roboto Mono";

const register = (family: string, file: string) => {
  const handle = delayRender(`Loading ${family}`);
  return new FontFace(family, `url(${staticFile(file)}) format("woff2")`, {
    weight: "400",
    style: "normal",
  })
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
    })
    .catch((err) => {
      console.error(`Failed to load ${family}`, err);
      continueRender(handle);
    });
};

/**
 * Resolves once both faces are registered on `document.fonts`.
 *
 * The delayRender handles above keep Remotion from *capturing* early, but
 * they do not stop the canvas from being *painted* early — a still render
 * commits once, so without waiting on this the frame is drawn in a
 * fallback face and never repainted. Components must gate their first
 * draw on this promise.
 */
export const fontsReady: Promise<unknown> = Promise.all([
  register(DISPLAY_FONT, "fonts/ArchivoBlack-Regular.woff2"),
  register(MONO_FONT, "fonts/RobotoMono-Regular.woff2"),
]);

let loaded = false;
void fontsReady.then(() => {
  loaded = true;
});

/**
 * True once both faces are registered.
 *
 * Deliberately not `document.fonts.check()`: that returns true for a
 * family the document has never heard of, because the fallback it would
 * resolve to is itself loaded. Gating on it means always drawing the
 * first frame in the wrong face.
 */
export const areFontsReady = () => loaded;
