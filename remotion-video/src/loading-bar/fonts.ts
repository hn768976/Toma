import { continueRender, delayRender, staticFile } from "remotion";
import { getInfo as oswaldInfo } from "@remotion/google-fonts/Oswald";
import { getInfo as robotoMonoInfo } from "@remotion/google-fonts/RobotoMono";

/**
 * Fonts for the piece: a heavy condensed sans for the word, and a
 * monospace for the "process" variant's percentage readout.
 *
 * The family names (and the exact weights/subsets we ship) come from
 * @remotion/google-fonts, but the woff2 files themselves are vendored
 * into public/fonts and registered with FontFace rather than fetched
 * from fonts.gstatic.com at render time. Two reasons: a render should
 * not depend on the network, and this sandbox's headless Chrome does
 * not trust the egress proxy's CA, so the gstatic @font-face injected
 * by loadFont() fails with ERR_CERT_AUTHORITY_INVALID.
 *
 * Loading is gated behind delayRender()/continueRender() either way:
 * canvas fillText silently substitutes a fallback face, so a frame
 * captured before the font is ready would come out at a different size.
 */
export const DISPLAY_FONT_FAMILY = oswaldInfo().fontFamily;
export const DISPLAY_FONT_WEIGHT = 700;

export const MONO_FONT_FAMILY = robotoMonoInfo().fontFamily;
export const MONO_FONT_WEIGHT = 500;

const FACES: { family: string; weight: number; file: string }[] = [
  {
    family: DISPLAY_FONT_FAMILY,
    weight: DISPLAY_FONT_WEIGHT,
    file: "fonts/Oswald-700-latin.woff2",
  },
  {
    family: MONO_FONT_FAMILY,
    weight: MONO_FONT_WEIGHT,
    file: "fonts/RobotoMono-500-latin.woff2",
  },
];

const handle = delayRender("Loading loading-bar fonts");

Promise.all(
  FACES.map(({ family, weight, file }) =>
    new FontFace(
      family,
      `url(${staticFile(file)}) format("woff2")`,
      { weight: String(weight), style: "normal" },
    )
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
      }),
  ),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    // Never hang the render on a font failure: fall through to the
    // system fallback rather than timing out.
    console.error("Failed to load loading-bar fonts", err);
    continueRender(handle);
  });

export { cssFont, fontSizeForCapHeight } from "./lib/textFit";
