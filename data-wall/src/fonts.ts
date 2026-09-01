import { continueRender, delayRender } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

/**
 * Inter, whose lining figures share a single advance width. Proportional
 * figures would make the whole grid shimmer sideways every time a value
 * changed; tabular ones keep every column dead still.
 *
 * Loaded once per render process and gated with delayRender so no frame is
 * ever captured with a fallback face substituted in.
 */
const { fontFamily, waitUntilDone } = loadFont("normal", {
  weights: ["500", "600"],
  subsets: ["latin"],
});

export const FONT_FAMILY = `${fontFamily}, "Helvetica Neue", Arial, sans-serif`;

const handle = delayRender("Loading Inter");
waitUntilDone()
  .then(() => continueRender(handle))
  .catch(() => {
    // Never hang a render on a font: fall through to the stack above.
    continueRender(handle);
  });

/**
 * True once the face is actually usable. The number grid caches its text into
 * an offscreen canvas, so it needs to know when to throw that cache away and
 * re-lay it out in the real font.
 */
export const fontReady = (sizePx: number): boolean => {
  try {
    return document.fonts.check(`600 ${Math.round(sizePx)}px "${fontFamily}"`);
  } catch {
    return true;
  }
};
