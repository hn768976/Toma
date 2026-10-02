import { continueRender, delayRender, staticFile } from "remotion";

// Fonts are shipped in public/fonts (SIL OFL 1.1, see licenses/), so no
// render ever depends on a network fetch. delayRender() holds every frame
// until all faces are loaded.
export const SANS = "Inter";
export const MONO = "JetBrains Mono";

const faces: [string, string, string][] = [
  [SANS, "inter-latin-400-normal.woff2", "400"],
  [SANS, "inter-latin-500-normal.woff2", "500"],
  [SANS, "inter-latin-600-normal.woff2", "600"],
  [SANS, "inter-latin-700-normal.woff2", "700"],
  [MONO, "jetbrains-mono-latin-400-normal.woff2", "400"],
  [MONO, "jetbrains-mono-latin-500-normal.woff2", "500"],
  [MONO, "jetbrains-mono-latin-700-normal.woff2", "700"],
];

const handle = delayRender("Loading Inter + JetBrains Mono");

Promise.all(
  faces.map(([family, file, weight]) =>
    new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, {
      weight,
      style: "normal",
    })
      .load()
      .then((f) => document.fonts.add(f)),
  ),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error("Font load failed", err);
    continueRender(handle);
  });
