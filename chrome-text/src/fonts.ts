import { getInfo, fontFamily } from "@remotion/google-fonts/ArchivoBlack";
import { continueRender, delayRender, staticFile } from "remotion";
import type { PaintGate } from "./lib/canvas";

/**
 * Archivo Black: a heavy, squarish geometric sans. The generous letterspacing
 * the piece wants is applied glyph by glyph at layout time, not by the font.
 *
 * The family and its subsets come from `@remotion/google-fonts`, but the woff2
 * files themselves are vendored into `public/fonts` and registered here rather
 * than fetched from fonts.gstatic.com. A render that reaches the network is a
 * render that can fail or stall on a machine behind a proxy, and the font is
 * load-bearing: the entire letterform layout is derived from its metrics.
 *
 * `delayRender()` holds the render open until the face is available, so no
 * frame is ever captured — and no glyph ever measured — against a fallback.
 */
export const FONT_FAMILY = fontFamily;

/** Unicode ranges, taken from the Google Fonts metadata rather than retyped. */
const SUBSETS = [
  { file: "fonts/ArchivoBlack-latin.woff2", subset: "latin" },
  { file: "fonts/ArchivoBlack-latin-ext.woff2", subset: "latin-ext" },
] as const;

let loaded = false;

const handle = delayRender("Loading Archivo Black");

const info = getInfo();

const ready: Promise<void> = Promise.all(
  SUBSETS.map(async ({ file, subset }) => {
    const face = new FontFace(
      FONT_FAMILY,
      `url(${staticFile(file)}) format("woff2")`,
      {
        weight: "400",
        style: "normal",
        unicodeRange: info.unicodeRanges[subset],
      },
    );
    document.fonts.add(await face.load());
  }),
)
  .then(() => document.fonts.ready)
  .then(() => undefined)
  .catch((err) => {
    // Never hang a render on a font failure; fall back to the default face.
    // eslint-disable-next-line no-console
    console.error("Failed to load Archivo Black", err);
  })
  .then(() => {
    loaded = true;
    continueRender(handle);
  });

/** Gate for canvas layers whose drawing depends on the webfont's metrics. */
export const fontGate: PaintGate = {
  ready: () => loaded,
  wait: () => ready,
};
