import { continueRender, delayRender, staticFile } from "remotion";

/**
 * A clean sans (Inter, latin subset, variable weight), loaded from public/ and
 * gated with delayRender()/continueRender() so no frame is ever captured with a
 * fallback face substituted in.
 *
 * The file is bundled rather than fetched from Google's CDN so a render is
 * fully offline and byte-identical on any machine — which also keeps the
 * project self-contained.
 *
 * Canvas 2D exposes no `font-feature-settings`, so tabular figures are produced
 * by `drawTabular` in draw/primitives.ts, which lays every digit out on a fixed
 * advance. Proportional digits would make the climbing percentages jitter.
 */
export const FONT_FAMILY = "InfographicSans";

const handle = delayRender("Loading Inter");

const face = new FontFace(
  FONT_FAMILY,
  `url(${staticFile("fonts/Inter-latin.woff2")}) format("woff2")`,
  { weight: "100 900", style: "normal", display: "block" },
);

face
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    return document.fonts.ready;
  })
  .then(() => continueRender(handle))
  .catch((err) => {
    // Fall through to the fallback stack rather than hanging the render.
    // eslint-disable-next-line no-console
    console.warn("Font load failed", err);
    continueRender(handle);
  });

export const font = (weight: number, size: number) =>
  `${weight} ${size}px "${FONT_FAMILY}", system-ui, sans-serif`;
