import { continueRender, delayRender, staticFile } from "remotion";

// Fonts ship in public/fonts (SIL OFL 1.1). No network fetch at render time.
export const INTER = "Inter Local";
export const MONO = "JetBrains Mono Local";

const faces: [string, string, string][] = [
  [INTER, "fonts/inter-latin-900-normal.woff2", "900"],
  [INTER, "fonts/inter-latin-700-normal.woff2", "700"],
  [MONO, "fonts/jetbrains-mono-latin-400-normal.woff2", "400"],
  [MONO, "fonts/jetbrains-mono-latin-700-normal.woff2", "700"],
];

if (typeof document !== "undefined") {
  const handle = delayRender("Loading fonts");
  Promise.all(
    faces.map(([family, file, weight]) =>
      new FontFace(family, `url(${staticFile(file)}) format("woff2")`, { weight, style: "normal" })
        .load()
        .then((f) => (document.fonts as unknown as { add: (f: FontFace) => void }).add(f)),
    ),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error("Font load failed", err);
      continueRender(handle);
    });
}
