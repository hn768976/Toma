import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Rajdhani, self-hosted from public/fonts.
 *
 * The label plates are sized from the text they contain, so a substituted
 * fallback font would change every pill width and shift the whole layout.
 * delayRender() holds the first frame until the faces are actually ready,
 * and nothing is fetched from the network at render time.
 */
export const FONT_FAMILY = "Rajdhani";

const FACES = [
  { file: "fonts/Rajdhani-SemiBold.woff2", weight: "600" },
  { file: "fonts/Rajdhani-Bold.woff2", weight: "700" },
];

const handle = delayRender("Loading Rajdhani");

Promise.all(
  FACES.map(async ({ file, weight }) => {
    const face = new FontFace(FONT_FAMILY, `url(${staticFile(file)}) format("woff2")`, {
      weight,
      style: "normal",
    });
    document.fonts.add(await face.load());
  }),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    // Never hang the render on a font problem -- fail loudly, keep going.
    // eslint-disable-next-line no-console
    console.error("Failed to load Rajdhani", err);
    continueRender(handle);
  });
