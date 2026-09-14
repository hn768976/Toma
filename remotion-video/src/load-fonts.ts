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

// Tabular mono used for the market-arrow readouts. Self-hosted for the
// same reason: rendering must not depend on the network, and the
// project has to look identical on a machine that has no DejaVu/
// Liberation mono installed.
export const MONO_FONT_FAMILY_NAME = "Roboto Mono";

const monoHandle = delayRender("Loading Roboto Mono font");

const monoFontFace = new FontFace(
  MONO_FONT_FAMILY_NAME,
  `url(${staticFile("fonts/RobotoMono-Latin.woff2")}) format("woff2")`,
  // Variable-weight subset: one file covers the whole 100-700 range.
  { weight: "100 700", style: "normal" },
);

monoFontFace
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(monoHandle);
  })
  .catch((err) => {
    console.error("Failed to load Roboto Mono font", err);
    continueRender(monoHandle);
  });
