import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted OFL fonts (see public/fonts/OFL-*.txt). Loaded once, behind a
// delayRender so no frame is captured before the faces are ready.
export const INTER = "Inter";
export const MONO = "JetBrains Mono";

const FACES: [string, string, string][] = [
  [INTER, "fonts/inter-latin-300-normal.woff2", "300"],
  [INTER, "fonts/inter-latin-400-normal.woff2", "400"],
  [INTER, "fonts/inter-latin-500-normal.woff2", "500"],
  [INTER, "fonts/inter-latin-600-normal.woff2", "600"],
  [INTER, "fonts/inter-latin-700-normal.woff2", "700"],
  [MONO, "fonts/jetbrains-mono-latin-400-normal.woff2", "400"],
  [MONO, "fonts/jetbrains-mono-latin-500-normal.woff2", "500"],
  [MONO, "fonts/jetbrains-mono-latin-700-normal.woff2", "700"],
];

let fontsPromise: Promise<void> | null = null;

export const loadFonts = (): Promise<void> => {
  if (fontsPromise) return fontsPromise;
  const handle = delayRender("Loading Inter + JetBrains Mono");
  fontsPromise = Promise.all(
    FACES.map(([family, file, weight]) =>
      new FontFace(family, `url(${staticFile(file)}) format("woff2")`, { weight, style: "normal" })
        .load()
        .then((f) => {
          document.fonts.add(f);
        }),
    ),
  )
    .then(() => document.fonts.ready)
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error("Font load failed", err);
      continueRender(handle);
    }) as Promise<void>;
  return fontsPromise;
};
