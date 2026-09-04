import { continueRender, delayRender, staticFile } from "remotion";

/**
 * The fonts ship with the project rather than being pulled from a CDN: a
 * substituted font would change every glyph advance, and with it the width of
 * every hex row and label — enough to shift the layout and break the loop.
 */
export const MONO = "BreachMono";
export const SANS = "BreachSans";

const handle = delayRender("Loading embedded fonts");

Promise.all([
  // JetBrains Mono ships as a variable font, so one file covers both weights.
  new FontFace(MONO, `url(${staticFile("fonts/mono.woff2")}) format("woff2")`, {
    weight: "100 800",
    style: "normal",
  }).load(),
  new FontFace(SANS, `url(${staticFile("fonts/sans.woff2")}) format("woff2")`, {
    weight: "600",
    style: "normal",
  }).load(),
])
  .then((faces) => {
    faces.forEach((face) => document.fonts.add(face));
    return document.fonts.ready;
  })
  .then(() => continueRender(handle))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Font loading failed", err);
    continueRender(handle);
  });
