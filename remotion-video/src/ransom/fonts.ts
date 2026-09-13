import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted webfonts. Rendering never depends on a network fetch, so the
// project renders identically on any machine (and inside CI / a fresh clone).
// Each face registers a delayRender() handle so Remotion holds frame capture
// until every glyph is ready — otherwise the first frames render in a
// fallback face and the letters jump.

export const RANSOM_FONTS = {
  playfair: "RansomPlayfair",
  playfairBlack: "RansomPlayfairBlack",
  playfairItalic: "RansomPlayfairItalic",
  bodoni: "RansomBodoni",
  anton: "RansomAnton",
  archivo: "RansomArchivo",
  dmserif: "RansomDMSerif",
  baskerville: "RansomBaskerville",
  jost: "RansomJost",
} as const;

export type FontKey = keyof typeof RANSOM_FONTS;

const FACES: { key: FontKey; file: string; weight: string; style: string }[] = [
  {
    key: "playfair",
    file: "PlayfairDisplay-700",
    weight: "700",
    style: "normal",
  },
  {
    key: "playfairBlack",
    file: "PlayfairDisplay-900",
    weight: "900",
    style: "normal",
  },
  {
    key: "playfairItalic",
    file: "PlayfairDisplay-700italic",
    weight: "700",
    style: "italic",
  },
  { key: "bodoni", file: "BodoniModa-700", weight: "700", style: "normal" },
  { key: "anton", file: "Anton-400", weight: "400", style: "normal" },
  { key: "archivo", file: "ArchivoBlack-400", weight: "400", style: "normal" },
  {
    key: "dmserif",
    file: "DMSerifDisplay-400",
    weight: "400",
    style: "normal",
  },
  {
    key: "baskerville",
    file: "LibreBaskerville-700",
    weight: "700",
    style: "normal",
  },
  { key: "jost", file: "Jost-400", weight: "400", style: "normal" },
];

for (const face of FACES) {
  const handle = delayRender(`Loading ransom font ${face.file}`);
  const fontFace = new FontFace(
    RANSOM_FONTS[face.key],
    `url(${staticFile(`fonts/${face.file}.woff2`)}) format("woff2")`,
    { weight: face.weight, style: face.style },
  );
  fontFace
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
    })
    .catch((err) => {
      // Never hang the render on a font failure — fall back to the
      // browser default rather than blocking frame capture forever.
      console.error(`Failed to load ${face.file}`, err);
      continueRender(handle);
    });
}
