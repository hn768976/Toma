import { continueRender, delayRender, staticFile } from "remotion";

/**
 * The face is self-hosted, so a render never depends on a network fetch and a
 * substituted fallback can never change a row's height and break the loop.
 *
 * Roboto Condensed carries the numbers as well as the names. Its figures are
 * true tabular ones - every digit is exactly 1035/2048 em at weight 700, while
 * the comma is only 501 - so the ticking last digits never shift the column,
 * and grouped thousands still set tightly instead of at monospace width.
 */
export const FONT_TEXT = "BoardCondensed";

const handle = delayRender("Loading Roboto Condensed");
const face = new FontFace(
  FONT_TEXT,
  `url(${staticFile("fonts/RobotoCondensed.woff2")}) format("woff2")`,
  { weight: "100 900", style: "normal" },
);
face
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to load Roboto Condensed", err);
    continueRender(handle);
  });

/** Belt and braces on top of the face's own tabular defaults. */
export const TABULAR: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums lining-nums",
  fontFeatureSettings: '"tnum" 1, "lnum" 1',
};
