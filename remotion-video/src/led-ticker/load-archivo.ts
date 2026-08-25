// Self-hosted so the board's letterforms never depend on a network fetch at
// render time. delayRender() holds every capture until the face is ready —
// a fallback font would sample to a different LED lattice.

import { continueRender, delayRender, staticFile } from "remotion";
import { FONT_FAMILY } from "./constants";

let ready = false;

const handle = delayRender("Loading Archivo Bold for the LED ticker board");

const face = new FontFace(
  FONT_FAMILY,
  `url(${staticFile("fonts/Archivo-Bold.woff2")}) format("woff2")`,
  { weight: "700", style: "normal" },
);

export const fontPromise = face
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
  })
  .catch((err) => {
    console.error("Failed to load Archivo Bold", err);
  })
  .then(() => {
    ready = true;
    continueRender(handle);
  });

export const isFontReady = () => ready;
