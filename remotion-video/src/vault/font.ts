// Registers the display face once, from an embedded base64 woff2, so the
// Remotion render and the standalone HTML build both get the same
// typography with no network fetch and no staticFile() dependency.

import { continueRender, delayRender, getRemotionEnvironment } from "remotion";
import { FONT_FAMILY } from "./constants";
import { NUNITO_BOLD_WOFF2_BASE64 } from "./font-data";

let registered = false;

export const registerVaultFont = () => {
  if (registered || typeof document === "undefined") return;
  registered = true;

  const source = `url(data:font/woff2;base64,${NUNITO_BOLD_WOFF2_BASE64}) format("woff2")`;

  // Only hold up a render for the font — in the Player there is nothing to
  // block, and delayRender() there would just stall the first play.
  const handle = getRemotionEnvironment().isRendering
    ? delayRender("Loading the vault display font")
    : null;

  const face = new FontFace(FONT_FAMILY, source, {
    weight: "700",
    style: "normal",
  });

  face
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
    })
    .catch((err) => {
      console.error("Failed to load the vault display font", err);
    })
    .finally(() => {
      if (handle !== null) continueRender(handle);
    });
};
