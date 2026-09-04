import { continueRender, delayRender, staticFile } from "remotion";
import { FONT_FAMILY } from "./streaks/page";

/**
 * The monospace face is self-hosted and loaded before any frame is drawn.
 * A substituted font would change the glyph advance and the row height, which
 * would break the integer-row scroll and therefore the loop.
 *
 * JetBrains Mono, SIL Open Font License 1.1 — see NOTICE.md.
 */
const handle = delayRender("Loading JetBrains Mono");

const face = new FontFace(
  FONT_FAMILY,
  `url(${staticFile("fonts/JetBrainsMono-Regular.ttf")}) format("truetype")`,
  { weight: "400", style: "normal" },
);

export const fontReady: Promise<void> = face
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    return document.fonts.load(`400 100px "${FONT_FAMILY}"`).then(() => undefined);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to load JetBrains Mono", err);
  })
  .finally(() => {
    continueRender(handle);
  });
