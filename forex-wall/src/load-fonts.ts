/**
 * Roboto, self-hosted from public/fonts so a render never depends on a
 * network fetch and can never fall back to a substitute — a substituted
 * font would break the numeric column alignment the whole board relies on.
 *
 * Registers a delayRender() so Remotion will not capture a frame until the
 * face is actually available.
 */

import { continueRender, delayRender, staticFile } from "remotion";

export const FONT_FAMILY = "Roboto Wall";

/** Applied to every numeric run. Roboto ships tabular figures under `tnum`. */
export const TABULAR: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: '"tnum" 1',
};

const handle = delayRender("Loading Roboto");

const face = new FontFace(
  FONT_FAMILY,
  `url(${staticFile("fonts/Roboto-Variable-latin.woff2")}) format("woff2")`,
  { weight: "100 900", style: "normal" },
);

face
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    return document.fonts.ready;
  })
  .then(() => continueRender(handle))
  .catch((err) => {
    // Never hang the render: report and continue, so a broken font shows up
    // as an obviously wrong frame rather than a timeout.
    // eslint-disable-next-line no-console
    console.error("Failed to load Roboto", err);
    continueRender(handle);
  });
