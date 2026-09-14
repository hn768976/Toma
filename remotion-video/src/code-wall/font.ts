// Self-hosted so rendering never depends on a network fetch. The panel
// bitmaps are rasterised with fillText, so the face must be *loaded and
// registered* before any of them is drawn — otherwise the whole wall
// rasterises in the fallback monospace and never refreshes.

import { staticFile } from "remotion";

export const CODE_FONT_FAMILY = "Share Tech Mono";

let loading: Promise<void> | null = null;

export const loadCodeFont = (): Promise<void> => {
  if (typeof document === "undefined") return Promise.resolve();
  if (!loading) {
    loading = new FontFace(
      CODE_FONT_FAMILY,
      `url(${staticFile("fonts/ShareTechMono-Regular.woff2")}) format("woff2")`,
      { weight: "400", style: "normal" },
    )
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
      });
  }
  return loading;
};
