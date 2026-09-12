// Self-hosted so a render never depends on a network fetch. Both faces
// are the latin subsets of the Google Fonts originals; the condensed
// face matches the dense column layout of a real trading terminal, and
// the mono face keeps numeric columns aligned.

import { continueRender, delayRender, staticFile } from "remotion";

export const UI_FONT =
  '"Roboto Condensed", "Arial Narrow", "Liberation Sans", system-ui, sans-serif';
export const NUM_FONT =
  '"Roboto Mono", "DejaVu Sans Mono", ui-monospace, monospace';

const load = (
  family: string,
  file: string,
  descriptors: FontFaceDescriptors,
) => {
  const handle = delayRender(`Loading ${family}`);
  new FontFace(family, `url(${staticFile(file)}) format("woff2")`, descriptors)
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

// Both files are variable fonts, so one file covers the whole weight
// range we use.
load("Roboto Condensed", "fonts/RobotoCondensed-latin.woff2", {
  weight: "100 900",
  style: "normal",
});
load("Roboto Mono", "fonts/RobotoMono-latin.woff2", {
  weight: "100 700",
  style: "normal",
});
