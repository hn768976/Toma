// Registers the handwriting face once, from an embedded base64 woff2, so the
// Remotion render and the standalone HTML both get the same hand without a
// network fetch.

import { continueRender, delayRender, getRemotionEnvironment } from "remotion";
import { FONT_FAMILY } from "./constants";
import { CAVEAT_WOFF2_BASE64 } from "./font-data";

let registered = false;

export const registerPenFont = () => {
  if (registered || typeof document === "undefined") return;
  registered = true;

  const handle = getRemotionEnvironment().isRendering
    ? delayRender("Loading the handwriting font")
    : null;

  const face = new FontFace(
    FONT_FAMILY,
    `url(data:font/woff2;base64,${CAVEAT_WOFF2_BASE64}) format("woff2")`,
    { weight: "600", style: "normal" },
  );

  face
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
    })
    .catch((err) => {
      console.error("Failed to load the handwriting font", err);
    })
    .finally(() => {
      if (handle !== null) continueRender(handle);
    });
};
