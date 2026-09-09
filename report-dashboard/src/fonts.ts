import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Inter, self-hosted as a variable font so rendering never depends on a
 * network fetch. Registers a delayRender() so Remotion waits for the face to
 * be ready before capturing any frame — otherwise early frames would be
 * measured and rasterised with a fallback face.
 */
export const FONT_FAMILY = "Inter";

export const FONT_STACK =
  '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';

/**
 * Inter ships proportional figures by default, which makes a counting value
 * jitter as digit widths change. "tnum" locks every digit to one advance
 * width; "lnum" keeps them lining rather than old-style.
 */
export const TABULAR: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums lining-nums",
  fontFeatureSettings: '"tnum" 1, "lnum" 1',
};

const handle = delayRender("Loading Inter");

const face = new FontFace(
  FONT_FAMILY,
  `url(${staticFile("fonts/Inter-Variable.woff2")}) format("woff2")`,
  { weight: "100 900", style: "normal", display: "block" },
);

face
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    // Never hang the render on a font failure — fall back to the stack above.
    console.error("Failed to load Inter", err);
    continueRender(handle);
  });
