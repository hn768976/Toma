// The code sheet is drawn with canvas fillText, so the font has to be
// loaded and registered before the first frame is rasterised or the sheet
// silently falls back to whatever monospace the renderer host happens to
// have — which is how the same project ends up with different text metrics
// on a laptop and on a render farm. The font ships in public/fonts so this
// never touches the network at render time.

import { continueRender, delayRender, staticFile } from "remotion";
import { CODE_FONT_FAMILY, CODE_FONT_FILE } from "./constants";

let pending: Promise<void> | null = null;

export const loadCodeFont = () => {
  if (pending) return pending;

  const handle = delayRender("CodeGrid: loading the code face");

  pending = new FontFace(
    CODE_FONT_FAMILY,
    `url(${staticFile(CODE_FONT_FILE)}) format("truetype")`,
    { weight: "400", style: "normal" },
  )
    .load()
    .then((face) => {
      document.fonts.add(face);
    })
    .catch((err) => {
      console.error("CodeGrid: code face failed to load", err);
    })
    .finally(() => {
      continueRender(handle);
    });

  return pending;
};
