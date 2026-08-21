import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted so rendering never depends on a network fetch at render
// time. Registers a delayRender() so Remotion waits for the handwriting
// font to be ready before it captures any frame.
export const FONT_FAMILY_NAME = "Patrick Hand";

const handle = delayRender("Loading Patrick Hand font");

const fontFace = new FontFace(
  FONT_FAMILY_NAME,
  `url(${staticFile("fonts/PatrickHand-Regular.woff2")}) format("woff2")`,
  { weight: "400", style: "normal" },
);

fontFace
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    console.error("Failed to load Patrick Hand font", err);
    continueRender(handle);
  });
