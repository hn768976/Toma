// Heavy sans + serif for the montage.
//
// Family names and weight axes come from @remotion/google-fonts, but the woff2
// files themselves are served out of public/ rather than fetched from
// fonts.gstatic.com at render time: a render that needs the network is a render
// that can fail halfway through a frame range. `npm run fonts` re-downloads
// them, resolving the URLs through the same package.
//
// The fonts must be *measurable* before the line buffers are built — every tile
// width, and therefore every line's scroll speed, comes from ctx.measureText().
// Measuring against a fallback face would silently change the tile widths and
// break the loop, so the composition holds a delayRender() handle until both
// faces are genuinely usable.

import { getInfo as interInfo } from "@remotion/google-fonts/Inter";
import { getInfo as robotoInfo } from "@remotion/google-fonts/Roboto";
import { getInfo as sourceSerifInfo } from "@remotion/google-fonts/SourceSerif4";
import { staticFile } from "remotion";

export const SANS_FAMILY = interInfo().fontFamily;
export const SERIF_FAMILY = sourceSerifInfo().fontFamily;

/**
 * The centre word gets its own face rather than the montage's heavy sans, so
 * the one sharp thing in the frame separates from the blurred text by shape as
 * well as by focus — which is the point of the shot.
 */
export const WORD_FAMILY = robotoInfo().fontFamily;
export const WORD_WEIGHT = 900;

const slug = (family: string) => family.replace(/\s+/g, "");

/** One woff2 per family; the two variable ones span their whole weight axis. */
const FACES = [
  { family: SANS_FAMILY, weights: "100 900" },
  { family: SERIF_FAMILY, weights: "200 900" },
  // Only Roboto's Black is loaded.
  { family: WORD_FAMILY, weights: "900" },
];

/** Every (weight, family) pair the renderer will ask a canvas to draw. */
const REQUIRED_FACES = [
  `500 100px "${SANS_FAMILY}"`,
  `700 100px "${SANS_FAMILY}"`,
  `900 100px "${SANS_FAMILY}"`,
  `400 100px "${SERIF_FAMILY}"`,
  `600 100px "${SERIF_FAMILY}"`,
  `${WORD_WEIGHT} 100px "${WORD_FAMILY}"`,
];

export const areFontsReady = (): boolean =>
  typeof document !== "undefined" &&
  REQUIRED_FACES.every((face) => document.fonts.check(face));

const load = (): Promise<unknown> => {
  if (typeof document === "undefined") return Promise.resolve();
  return Promise.all(
    FACES.map(({ family, weights }) =>
      new FontFace(
        family,
        `url(${staticFile(`fonts/${slug(family)}.woff2`)}) format("woff2")`,
        { weight: weights, style: "normal", display: "block" },
      )
        .load()
        .then((face) => document.fonts.add(face)),
    ),
  );
};

/**
 * Resolves once both families are registered *and* the browser reports the
 * individual weights as drawable on a canvas.
 */
export const fontsReady: Promise<void> = load()
  .then(() =>
    typeof document === "undefined"
      ? undefined
      : document.fonts.ready.then(() => undefined),
  )
  .catch((err) => {
    // A missing webfont should degrade to a fallback face, never wedge a render.
    console.error("HeadlineScroll: font load failed", err);
  });
