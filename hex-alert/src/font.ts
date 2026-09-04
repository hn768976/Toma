import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Self-hosted so no frame ever waits on a network fetch, and — more
 * importantly — so the character cell width is exactly CHAR_ADVANCE. A
 * substituted fallback font would change the advance and break the
 * integer-pixel scroll the loop depends on.
 */
export const MONO_FAMILY = "JetBrains Mono Embedded";

const handle = delayRender("Loading JetBrains Mono");

const face = new FontFace(
  MONO_FAMILY,
  `url(${staticFile("fonts/JetBrainsMono-Regular.woff2")}) format("woff2")`,
  { weight: "400", style: "normal" },
);

face
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to load the embedded mono font", err);
    continueRender(handle);
  });
