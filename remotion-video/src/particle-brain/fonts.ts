/**
 * The geometric sans used to sample the title's letterforms.
 *
 * Poppins SemiBold, vendored into public/fonts and registered through the
 * FontFace API, gated with delayRender()/continueRender() so Remotion
 * captures no frame until the face is ready.
 *
 * It is deliberately NOT fetched from a CDN at render time. The
 * letterforms are geometry here, not styling — the title's particles are
 * rejection-sampled from the rasterised glyphs — so a render that fell
 * back to a system sans, or picked up a different release of the webfont,
 * would produce a different particle set. Shipping the exact face is what
 * makes "identical on every render" true across machines, and it keeps
 * the project renderable offline and behind a proxy.
 *
 * `useTitleFontReady` exists for a separate reason: React may render the
 * tree once before the promise settles, and without the flag the title's
 * particle set would be memoised from an empty measurement. Remotion
 * captures no frame before continueRender, so the flag is always true by
 * the time a frame exists — it does not make the render non-deterministic.
 *
 * Poppins is licensed under the SIL Open Font License 1.1.
 */
import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

export const TITLE_FONT_FAMILY = "Poppins Vendored";
const TITLE_FONT_FILE = "fonts/Poppins-SemiBold-latin.woff2";
const TITLE_FONT_WEIGHT = "600";

const handle = delayRender("Loading Poppins for title letterform sampling");

let loaded = false;

const ready = new FontFace(
  TITLE_FONT_FAMILY,
  `url(${staticFile(TITLE_FONT_FILE)}) format("woff2")`,
  { weight: TITLE_FONT_WEIGHT, style: "normal" },
)
  .load()
  .then((face) => {
    document.fonts.add(face);
  })
  .catch((err) => {
    console.error("Title font failed to load; the title will fall back", err);
  })
  .then(() => {
    loaded = true;
    continueRender(handle);
  });

/** Builds a canvas `font` string at the given pixel size. */
export const titleFont = (size: number): string =>
  `${TITLE_FONT_WEIGHT} ${size}px "${TITLE_FONT_FAMILY}", sans-serif`;

export const useTitleFontReady = (): boolean => {
  const [isReady, setIsReady] = useState(loaded);
  useEffect(() => {
    if (isReady) return;
    let cancelled = false;
    ready.then(() => {
      if (!cancelled) setIsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isReady]);
  return isReady;
};
