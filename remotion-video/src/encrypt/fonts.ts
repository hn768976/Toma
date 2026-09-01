import { continueRender, delayRender, staticFile } from "remotion";

/**
 * A condensed sans for the dialog chrome and a monospace for the backdrop, the
 * panel readouts and the percentage.
 *
 * The faces are the Google Fonts Roboto Condensed and Roboto Mono latin
 * subsets, self-hosted from `public/fonts` rather than fetched from the Google
 * Fonts CDN at render time. Rendering then needs no network at all, which
 * keeps `npx remotion render` deterministic and reproducible offline. Both are
 * Apache-2.0 licensed; see `public/fonts/LICENSE.txt`.
 *
 * The percentage HAS to be monospace: its digits are tabular by construction,
 * so the value does not jitter sideways as the digits change.
 */

export const SANS_FAMILY = "Encrypt Condensed";
export const MONO_FAMILY = "Encrypt Mono";

export const SANS = `"${SANS_FAMILY}", "Roboto Condensed", "Arial Narrow", "Helvetica Neue", sans-serif`;
export const MONO = `"${MONO_FAMILY}", "Roboto Mono", "DejaVu Sans Mono", monospace`;

const FACES: {
  family: string;
  file: string;
  weight: string;
}[] = [
  { family: SANS_FAMILY, file: "RobotoCondensed-Regular.woff2", weight: "400" },
  { family: SANS_FAMILY, file: "RobotoCondensed-Bold.woff2", weight: "700" },
  { family: MONO_FAMILY, file: "RobotoMono-Regular.woff2", weight: "400" },
  { family: MONO_FAMILY, file: "RobotoMono-Medium.woff2", weight: "500" },
];

// Nothing may be drawn before the faces are ready, or the first frames would
// measure and lay out against a fallback metric.
const handle = delayRender("Loading encryption-screen fonts");

Promise.all(
  FACES.map(({ family, file, weight }) =>
    new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, {
      weight,
      style: "normal",
    })
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
      }),
  ),
)
  .catch((err) => {
    // A missing face must not wedge the render; the CSS stacks fall back.
    console.error("Failed to load encryption-screen fonts", err);
  })
  .then(() => continueRender(handle));
