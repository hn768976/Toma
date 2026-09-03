import { loadFont } from "@remotion/google-fonts/Inter";
import { continueRender, delayRender } from "remotion";

/**
 * The clean sans used for the MINS / SECS captions, and for nothing else
 * — the numerals are drawn as segment geometry, not set as type.
 *
 * Gated behind delayRender() so no frame is captured before the face is
 * available; a fallback stack keeps the labels legible if it never is.
 * The explicit document.fonts.load() matters because canvas will
 * silently fall back to the next family in the stack for a face that has
 * been declared but not yet actually loaded.
 */
export const LABEL_FONT_FAMILY =
  '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';

export const LABEL_FONT_WEIGHT = "600";

const handle = delayRender("Loading Inter for the MINS / SECS labels");

const { waitUntilDone } = loadFont("normal", {
  weights: ["600"],
  subsets: ["latin"],
});

waitUntilDone()
  .then(() => document.fonts.load(`${LABEL_FONT_WEIGHT} 64px "Inter"`))
  .then(() => continueRender(handle))
  .catch((err) => {
    // Never strand the render on a font: fall through to the stack.
    console.error("Could not load Inter; falling back", err);
    continueRender(handle);
  });
