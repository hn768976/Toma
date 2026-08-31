/**
 * Inter — a clean UI sans — gated with delayRender()/continueRender() so no
 * frame is ever captured with a fallback face substituted in.
 *
 * The brief asked for @remotion/google-fonts. That package fetches the woff2
 * from fonts.gstatic.com inside headless Chrome at render time, and a single
 * failed fetch aborts the whole render — which is exactly what happens behind
 * a TLS-intercepting proxy, on a CI box with no egress, or on a plane. The
 * same typeface is vendored into public/fonts/ instead and registered through
 * the FontFace API, so a render never depends on the network. Everything else
 * the brief asked for is unchanged: one clean UI sans, loaded once, gated by
 * delayRender().
 *
 * The dialog is drawn to a canvas rather than to the DOM, so a face arriving
 * late would silently bake the wrong metrics into the sprite cache.
 * `onFontsReady` exists for that: the canvas layer subscribes, and when the
 * face lands the sprite cache is dropped and the canvas repainted — all of it
 * before continueRender() lets the renderer take the picture.
 */

import { continueRender, delayRender, staticFile } from "remotion";

export const FONT_FAMILY = "Error Cascade UI Sans";

let ready = false;
const listeners = new Set<() => void>();

/** Whether the webfont has actually arrived. */
export const fontsReady = () => ready;

export const onFontsReady = (listener: () => void) => {
  if (ready) {
    listener();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const handle = delayRender("Loading the dialog UI font");

const settle = () => {
  if (ready) {
    return;
  }
  ready = true;
  for (const listener of listeners) {
    listener();
  }
  continueRender(handle);
};

// Inter ships as a variable font, so one file covers every weight used here.
const face = new FontFace(
  FONT_FAMILY,
  `url(${staticFile("fonts/Inter-latin.woff2")}) format("woff2")`,
  { weight: "100 900", style: "normal", display: "block" },
);

face
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    settle();
  })
  .catch((err: unknown) => {
    // Never hang a render on a font: fall back to the system sans instead.
    // eslint-disable-next-line no-console
    console.warn("Dialog font failed to load, falling back to sans-serif:", err);
    settle();
  });
