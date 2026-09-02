import { continueRender, delayRender, staticFile } from "remotion";
import { getInfo as headlineInfo } from "@remotion/google-fonts/PlayfairDisplay";
import { getInfo as bodyInfo } from "@remotion/google-fonts/PTSerif";

/**
 * Display and text faces, gated with delayRender()/continueRender() so that
 * Remotion will not capture a frame before the faces are ready.
 *
 * Playfair Display at 900 is the display serif — very heavy, high stroke
 * contrast, the weight a front page reserves for a lead story. PT Serif is the
 * text face: narrow enough to set in newspaper columns.
 *
 * The font *identity* comes from @remotion/google-fonts — getInfo() supplies
 * the canonical family names, version and file URLs. The files themselves are
 * vendored into public/fonts by scripts/fetch-fonts.mjs and served from there
 * rather than fetched from fonts.gstatic.com at render time. Two reasons:
 * a render that reaches the network mid-flight is not reproducible, and each
 * distributed zip has to render standalone. Re-run that script to refresh the
 * files if the upstream version moves.
 */

export const HEADLINE_FAMILY = headlineInfo().fontFamily;
export const BODY_FAMILY = bodyInfo().fontFamily;

type FaceSpec = {
  family: string;
  file: string;
  weight: string;
};

const FACES: FaceSpec[] = [
  // Playfair Display is a variable font: one file covers the whole range, so
  // it is registered with a weight range rather than a single weight.
  { family: HEADLINE_FAMILY, file: "fonts/PlayfairDisplay-variable.woff2", weight: "400 900" },
  { family: BODY_FAMILY, file: "fonts/PTSerif-400.woff2", weight: "400" },
  { family: BODY_FAMILY, file: "fonts/PTSerif-700.woff2", weight: "700" },
];

const handle = delayRender("Loading newspaper serif faces");

const loadAll = async (): Promise<void> => {
  await Promise.all(
    FACES.map(async (face) => {
      const fontFace = new FontFace(
        face.family,
        `url(${staticFile(face.file)}) format("woff2")`,
        { weight: face.weight, style: "normal", display: "block" },
      );
      const loaded = await fontFace.load();
      document.fonts.add(loaded);
    }),
  );
  await document.fonts.ready;
};

loadAll()
  .then(() => continueRender(handle))
  .catch((err) => {
    // Never strand a render: fall back to the browser's default serif.
    // eslint-disable-next-line no-console
    console.error("Failed to load clipping fonts", err);
    continueRender(handle);
  });

/**
 * Whether the faces are ready to measure against.
 *
 * Clippings are baked once into offscreen canvases, so they must not be baked
 * with fallback metrics. Reading this during render — rather than holding it
 * in component state — keeps the component a pure function of its inputs: it
 * flips from false to true exactly once, and because delayRender holds the
 * capture until then, every frame that reaches the encoder sees `true`.
 */
export const fontsReady = (): boolean => {
  if (typeof document === "undefined" || !document.fonts) return false;
  return (
    document.fonts.check(`900 96px "${HEADLINE_FAMILY}"`) &&
    document.fonts.check(`400 24px "${BODY_FAMILY}"`)
  );
};
