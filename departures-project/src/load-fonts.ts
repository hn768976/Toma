import { continueRender, delayRender, staticFile } from "remotion";

/**
 * The boards are grids of fixed-width columns and fixed-width character
 * cells. A substituted font would change the glyph widths inside those cells
 * and make the alignment visibly wrong, so the three faces are shipped in
 * `public/fonts` and loaded here before the first frame is rendered.
 */
const FACES: [family: string, file: string, weight: string][] = [
  ["Inter", "fonts/Inter-latin.woff2", "700"],
  ["Roboto Mono", "fonts/RobotoMono-latin.woff2", "100 700"],
  ["Space Mono", "fonts/SpaceMono-Bold-latin.woff2", "700"],
];

const handle = delayRender("Loading board fonts");

Promise.all(
  FACES.map(([family, file, weight]) => {
    const face = new FontFace(
      family,
      `url(${staticFile(file)}) format("woff2")`,
      { weight, display: "block" },
    );
    return face.load().then((loaded) => {
      document.fonts.add(loaded);
    });
  }),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Could not load the board fonts", err);
    continueRender(handle);
  });
