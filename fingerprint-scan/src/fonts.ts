/**
 * A monospace (Roboto Mono) and a condensed sans (Barlow Condensed), both
 * gated with delayRender()/continueRender() so no frame is ever captured with a
 * fallback face substituted in.
 *
 * The woff2 files are vendored into public/fonts and loaded from staticFile()
 * rather than fetched from Google's CDN at render time: it keeps the render
 * hermetic and reproducible offline, and it is what makes the two zips
 * self-contained. Both faces are SIL Open Font License 1.1.
 *
 * Numerics are drawn in the monospace face — inherently tabular, so the
 * percentage never jitters as its digits change.
 */
import { continueRender, delayRender, staticFile } from "remotion";

export const MONO = "FpMono";
export const SANS = "FpSans";

const FACES: { family: string; file: string; weight: string }[] = [
  { family: MONO, file: "fonts/RobotoMono-latin.woff2", weight: "400 700" },
  { family: SANS, file: "fonts/BarlowCondensed-400-latin.woff2", weight: "400" },
  { family: SANS, file: "fonts/BarlowCondensed-600-latin.woff2", weight: "600" },
];

const handle = delayRender("fingerprint: fonts");

Promise.all(
  FACES.map(async (f) => {
    const face = new FontFace(f.family, `url(${staticFile(f.file)})`, {
      weight: f.weight,
    });
    await face.load();
    document.fonts.add(face);
  }),
)
  .then(() => document.fonts.ready)
  .then(() => continueRender(handle))
  // Never hang a render on a font failure — fall through to the stack below.
  .catch(() => continueRender(handle));

export const monoFont = (size: number, weight = 400) =>
  `${weight} ${size}px "${MONO}", "DejaVu Sans Mono", monospace`;
export const sansFont = (size: number, weight = 400) =>
  `${weight} ${size}px "${SANS}", "DejaVu Sans Condensed", sans-serif`;
