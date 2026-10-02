import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted OFL fonts (see public/fonts/OFL-*.txt). Remotion waits on the
// delayRender handle so no frame is captured before the fonts are ready.
export const FONT_DIGITS = "DSEG7 Classic";
export const FONT_TITLE = "Cinzel";
export const FONT_UI = "Inter";

const faces: [string, string, string][] = [
  [FONT_DIGITS, "fonts/DSEG7Classic-Bold.woff2", "700"],
  [FONT_TITLE, "fonts/Cinzel-Bold.woff2", "700"],
  [FONT_UI, "fonts/Inter-Medium.woff2", "500"],
];

const handle = delayRender("Loading fonts");
Promise.all(
  faces.map(([family, file, weight]) =>
    new FontFace(family, `url(${staticFile(file)}) format("woff2")`, { weight, style: "normal" })
      .load()
      .then((f) => document.fonts.add(f)),
  ),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error("Font loading failed", err);
    continueRender(handle);
  });
