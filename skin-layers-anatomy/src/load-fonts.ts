import { continueRender, delayRender, staticFile } from "remotion";

export const FONT_FAMILY = "Montserrat";

let started = false;

/** Montserrat (SIL OFL) is bundled in public/fonts so renders work offline. */
export const loadFonts = () => {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("Loading Montserrat");
  const faces = [
    new FontFace(
      FONT_FAMILY,
      `url(${staticFile("fonts/montserrat-latin-500-normal.woff2")})`,
      { weight: "500" },
    ),
    new FontFace(
      FONT_FAMILY,
      `url(${staticFile("fonts/montserrat-latin-700-normal.woff2")})`,
      { weight: "700" },
    ),
  ];
  Promise.all(faces.map((f) => f.load()))
    .then((loaded) => {
      loaded.forEach((f) => document.fonts.add(f));
      continueRender(handle);
    })
    .catch((err) => {
      console.error("Font failed to load", err);
      continueRender(handle);
    });
};
