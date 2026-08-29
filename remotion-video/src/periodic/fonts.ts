import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Poppins - a clean geometric sans. 700 for the symbols, 400 for the atomic
 * numbers.
 *
 * The faces are served from public/ rather than fetched from the Google Fonts
 * CDN at render time, so a render never depends on network access and is
 * byte-for-byte reproducible. delayRender() holds the renderer until both
 * weights are ready, so no frame is captured with a fallback font.
 * Poppins is licensed under the SIL Open Font License 1.1.
 */
export const FONT_FAMILY = "Poppins";

const FACES: { file: string; weight: string }[] = [
  { file: "fonts/Poppins-Regular.woff2", weight: "400" },
  { file: "fonts/Poppins-Bold.woff2", weight: "700" },
];

const handle = delayRender("Loading Poppins");

Promise.all(
  FACES.map(({ file, weight }) =>
    new FontFace(FONT_FAMILY, `url(${staticFile(file)}) format("woff2")`, {
      weight,
      style: "normal",
    })
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
      }),
  ),
)
  .then(() => continueRender(handle))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to load Poppins", error);
    continueRender(handle);
  });
