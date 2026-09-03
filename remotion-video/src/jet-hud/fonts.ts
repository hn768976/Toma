import { continueRender, delayRender, staticFile } from "remotion";

/**
 * A condensed technical sans for labels and a monospace for the code column.
 *
 * Both faces are SELF-HOSTED from public/fonts rather than pulled from a font
 * CDN at render time. `npx remotion render` must be hermetic: a CDN fetch that
 * fails, or merely resolves late, substitutes a fallback face into the first
 * frames and makes them differ from the rest of the loop.
 *
 * The load is gated behind delayRender() so no frame is ever captured before
 * both faces are ready.
 */

export const FONT_CONDENSED = "Barlow Condensed";
export const FONT_MONO = "Roboto Mono";

const FACES: [family: string, file: string, weight: string][] = [
  [FONT_CONDENSED, "BarlowCondensed-400.woff2", "400"],
  [FONT_CONDENSED, "BarlowCondensed-500.woff2", "500"],
  [FONT_CONDENSED, "BarlowCondensed-600.woff2", "600"],
  // Roboto Mono ships latin as a single variable-weight file.
  [FONT_MONO, "RobotoMono-var.woff2", "100 700"],
];

const handle = delayRender("Loading HUD typefaces");

Promise.all(
  FACES.map(([family, file, weight]) =>
    new FontFace(
      family,
      `url(${staticFile(`fonts/${file}`)}) format("woff2")`,
      {
        weight,
        style: "normal",
      },
    )
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
      }),
  ),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error("HUD typefaces failed to load", err);
    continueRender(handle);
  });
