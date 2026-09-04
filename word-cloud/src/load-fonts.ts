import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Inter is self-hosted as a variable woff2 (wght 100-900) and registered
 * through delayRender, so no frame is captured before it is ready. A
 * substituted grotesque would change the metrics and rebalance the whole
 * layout, and the variable axis is what lets weight glide with depth instead
 * of stepping between static cuts.
 */
export const FONT_FAMILY = "Inter Variable";

const handle = delayRender("Loading Inter");

const fontFace = new FontFace(
  FONT_FAMILY,
  `url(${staticFile("fonts/Inter-Variable-latin.woff2")}) format("woff2")`,
  { weight: "100 900", style: "normal" },
);

fontFace
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to load Inter", err);
    continueRender(handle);
  });
