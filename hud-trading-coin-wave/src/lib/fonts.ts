import { continueRender, delayRender, staticFile } from "remotion";

// OFL fonts, self-hosted in public/fonts (licences next to them).
export const MONO = '"JetBrains Mono"';
export const SANS = '"Inter"';
export const HUD = '"Rajdhani"';

const faces: [string, string, string][] = [
  ["JetBrains Mono", "jetbrains-mono-latin-400-normal.woff2", "400"],
  ["JetBrains Mono", "jetbrains-mono-latin-500-normal.woff2", "500"],
  ["Inter", "inter-latin-400-normal.woff2", "400"],
  ["Inter", "inter-latin-500-normal.woff2", "500"],
  ["Inter", "inter-latin-600-normal.woff2", "600"],
  ["Rajdhani", "rajdhani-latin-600-normal.woff2", "600"],
];

const handle = delayRender("Loading OFL fonts");

/** Resolves once every face is loaded. Canvas looks wait on it before drawing. */
export const fontsReady: Promise<void> = Promise.all(
  faces.map(([family, file, weight]) =>
    new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, { weight })
      .load()
      .then((f) => {
        document.fonts.add(f);
      }),
  ),
)
  .then(() => undefined)
  .catch((e) => {
    console.error("Font load failed", e);
  })
  .finally(() => continueRender(handle));
