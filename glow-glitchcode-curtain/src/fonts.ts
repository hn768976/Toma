import { staticFile } from "remotion";

export const CODE_FONT = "JetBrains Mono"; // SIL OFL 1.1, bundled in public/fonts

/**
 * Resolves once the bundled font files are loaded and registered, so the code
 * is never drawn in a fallback font. GlitchCode holds a delayRender until then.
 */
let promise: Promise<void> | null = null;
export const loadCodeFont = (): Promise<void> => {
  if (!promise) {
    const faces = [
      new FontFace(CODE_FONT, `url(${staticFile("fonts/jetbrains-mono-latin-400-normal.woff2")}) format("woff2")`, { weight: "400" }),
      new FontFace(CODE_FONT, `url(${staticFile("fonts/jetbrains-mono-latin-700-normal.woff2")}) format("woff2")`, { weight: "700" }),
    ];
    promise = Promise.all(faces.map((f) => f.load()))
      .then((loaded) => {
        loaded.forEach((f) => (document.fonts as unknown as { add(f: FontFace): void }).add(f));
        return document.fonts.load(`400 40px "${CODE_FONT}"`);
      })
      .then(() => document.fonts.load(`700 40px "${CODE_FONT}"`))
      .then(() => document.fonts.ready)
      .then(() => undefined);
  }
  return promise;
};
