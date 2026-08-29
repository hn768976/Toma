/**
 * Typefaces for the HUD: a monospace for the code panels and readouts, and a
 * heavy condensed sans for the status words.
 *
 * These are the Google Fonts IBM Plex Mono and Barlow Condensed, both under
 * the SIL Open Font License, self-hosted from public/fonts rather than pulled
 * from fonts.gstatic.com at render time. Self-hosting keeps `npx remotion
 * render` deterministic and lets the project render with no network at all.
 * Loading is gated with delayRender()/continueRender() so no frame is ever
 * captured against a fallback face.
 */

import { continueRender, delayRender, staticFile } from "remotion";

/** Small monospace used for every code panel and numeric readout. */
export const MONO_FAMILY = "IBM Plex Mono";
/** Heavy condensed sans used for the status words. */
export const DISPLAY_FAMILY = "Barlow Condensed";

const FACES: [string, string, string][] = [
  [MONO_FAMILY, "400", "fonts/IBMPlexMono-Regular-latin.woff2"],
  [MONO_FAMILY, "500", "fonts/IBMPlexMono-Medium-latin.woff2"],
  [DISPLAY_FAMILY, "700", "fonts/BarlowCondensed-Bold-latin.woff2"],
];

const handle = delayRender("Loading shield HUD typefaces");

export const fontsLoaded = Promise.all(
  FACES.map(([family, weight, file]) => {
    const face = new FontFace(family, `url(${staticFile(file)}) format("woff2")`, {
      weight,
      style: "normal",
    });
    return face.load().then((loaded) => {
      document.fonts.add(loaded);
      return loaded;
    });
  }),
)
  .then(() => {
    continueRender(handle);
  })
  .catch((err) => {
    console.error("Font loading failed", err);
    continueRender(handle);
  });

export const monoFont = (size: number, weight = 400) =>
  `${weight} ${size}px "${MONO_FAMILY}", monospace`;

export const displayFont = (size: number, weight = 700) =>
  `${weight} ${size}px "${DISPLAY_FAMILY}", sans-serif`;
