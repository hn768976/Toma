import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Self-hosted (public/fonts) so a render never depends on a network fetch, and
 * wrapped in delayRender() so Remotion does not capture a frame before the
 * axis labels have their real metrics.
 */
export const LABEL_FONT_FAMILY = "Scope Mono";

const handle = delayRender("Loading Roboto Mono (axis labels)");

const fontFace = new FontFace(
  LABEL_FONT_FAMILY,
  `url(${staticFile("fonts/RobotoMono-Latin.woff2")}) format("woff2")`,
  { weight: "400 500", style: "normal" },
);

fontFace
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to load the axis label font", err);
    continueRender(handle);
  });
