import { continueRender, delayRender, staticFile } from "remotion";

export const FONT_UI = '"InterEmbedded", "Inter", system-ui, sans-serif';
export const FONT_MONO = '"JetBrainsMonoEmbedded", "JetBrains Mono", monospace';

/**
 * JetBrains Mono advance width is exactly 600/1000 em, so the caret can be
 * positioned from a character count without measuring the DOM.
 */
export const MONO_ADVANCE = 0.6;

let started = false;

/**
 * Fonts are shipped in `public/fonts` rather than fetched from a CDN, so a
 * render on another machine produces byte-identical metrics to the preview.
 */
export const loadFonts = () => {
  if (started || typeof document === "undefined") {
    return;
  }
  started = true;
  const handle = delayRender("Loading embedded fonts");
  const faces = [
    new FontFace(
      "InterEmbedded",
      `url(${staticFile("fonts/Inter-Variable.woff2")}) format("woff2")`,
      { weight: "100 900", style: "normal", display: "block" },
    ),
    new FontFace(
      "JetBrainsMonoEmbedded",
      `url(${staticFile("fonts/JetBrainsMono-Variable.woff2")}) format("woff2")`,
      { weight: "100 800", style: "normal", display: "block" },
    ),
  ];

  Promise.all(faces.map((face) => face.load()))
    .then((loaded) => {
      loaded.forEach((face) => document.fonts.add(face));
      continueRender(handle);
    })
    .catch(() => {
      // Never hang a render on a font: fall back and carry on.
      continueRender(handle);
    });
};

loadFonts();
