import { continueRender, delayRender, staticFile } from "remotion";

// Two faces carry the whole HUD:
//
//  · SANS — Barlow Condensed. A narrow technical grotesque for labels,
//    section headings and the ID label. Condensed keeps long small-caps
//    strings inside narrow panel chrome without shrinking the type.
//  · MONO — Roboto Mono. Every number in the frame is set in this.
//    Monospaced digits are tabular by construction, so a value that
//    rerolls from "07" to "11" never shifts the glyphs around it — which
//    matters because the data table rerolls several cells a second.
//
// Canvas2D ignores `font-variant-numeric`, so choosing a monospaced face is
// the only way to actually get tabular figures inside a <canvas>. Do not
// set numbers in SANS.
//
// The faces are SELF-HOSTED out of public/fonts rather than pulled through
// @remotion/google-fonts. Fetching from fonts.gstatic.com at render time
// makes every render depend on the network (and fails outright behind a TLS
// -inspecting proxy, which is where this was built). Self-hosting keeps
// `npx remotion render` hermetic and deterministic, and it is what makes
// the distributable zips runnable offline. The files are the stock Google
// Fonts latin-subset woff2s.
//
// Loading is gated behind delayRender()/continueRender() so Remotion never
// captures a frame before the faces are ready — without it the opening
// frames of a render come out in a fallback face.

export const SANS = "Barlow Condensed";
export const MONO = "Roboto Mono";

type FaceSpec = { family: string; weight: string; file: string };

const FACES: FaceSpec[] = [
  { family: SANS, weight: "400", file: "BarlowCondensed-400.woff2" },
  { family: SANS, weight: "500", file: "BarlowCondensed-500.woff2" },
  { family: SANS, weight: "600", file: "BarlowCondensed-600.woff2" },
  { family: MONO, weight: "400", file: "RobotoMono-400.woff2" },
  { family: MONO, weight: "500", file: "RobotoMono-500.woff2" },
  { family: MONO, weight: "700", file: "RobotoMono-700.woff2" },
];

const handle = delayRender("Loading HUD typefaces");

Promise.all(
  FACES.map(({ family, weight, file }) =>
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
  .then(() => continueRender(handle))
  .catch((err) => {
    // Never hang a render on a font failure — the shorthand builders below
    // always name a generic fallback, so type still lands on the frame.
    console.error("HUD typefaces failed to load", err);
    continueRender(handle);
  });

// Canvas font shorthand builders. Always include the generic fallback so a
// failed webfont degrades instead of silently picking up a serif.
export const sansFont = (weight: number, sizePx: number) =>
  `${weight} ${sizePx}px "${SANS}", "Arial Narrow", sans-serif`;

export const monoFont = (weight: number, sizePx: number) =>
  `${weight} ${sizePx}px "${MONO}", ui-monospace, monospace`;
