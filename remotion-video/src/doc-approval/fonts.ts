import { loadFont } from "@remotion/google-fonts/Inter";
import { continueRender, delayRender } from "remotion";

/**
 * A clean sans for the label and the rating text. Gated with
 * delayRender()/continueRender() so no frame is captured before the face is
 * ready - canvas `fillText` silently falls back to a system font otherwise,
 * which would make the first frame of every render worker inconsistent.
 */
const loaded = loadFont("normal", {
  weights: ["300", "400", "500"],
  subsets: ["latin"],
});

export const FONT_FAMILY = loaded.fontFamily;

/**
 * Resolves once the faces are usable from a 2D context. Canvas draws are not
 * re-run by the browser when a font arrives the way DOM text is, so the two
 * components that draw text await this and repaint themselves.
 */
export const fontsReady: Promise<void> = loaded
  .waitUntilDone()
  .then(async () => {
    await Promise.all([
      document.fonts.load(`300 100px "${FONT_FAMILY}"`),
      document.fonts.load(`400 100px "${FONT_FAMILY}"`),
      document.fonts.load(`500 100px "${FONT_FAMILY}"`),
    ]);
  });

const handle = delayRender("Loading Inter for the document approval piece");

/**
 * The setTimeout is load-bearing: `.then` callbacks run in registration
 * order, and this module registers before any component mounts. Deferring
 * continueRender to a macrotask lets every repaint scheduled on `fontsReady`
 * finish first, so the frame Remotion captures is already in the right font.
 */
fontsReady
  .catch((err) => {
    console.error("Failed to load Inter", err);
  })
  .then(() => {
    setTimeout(() => continueRender(handle), 0);
  });
