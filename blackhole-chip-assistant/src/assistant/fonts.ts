import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

/**
 * JetBrains Mono (SIL Open Font License 1.1), shipped in public/fonts.
 * Rendering waits (delayRender) until both weights are loaded, so no frame
 * is ever drawn with a fallback font.
 */
export const FONT_FAMILY = "JetBrains Mono Local";

let loading: Promise<void> | null = null;

export const loadFonts = () => {
  if (!loading) {
    const handle = delayRender("Loading JetBrains Mono");
    const faces = [
      new FontFace(FONT_FAMILY, `url(${staticFile("fonts/jetbrains-mono-latin-500-normal.woff2")}) format("woff2")`, {
        weight: "500",
      }),
      new FontFace(FONT_FAMILY, `url(${staticFile("fonts/jetbrains-mono-latin-700-normal.woff2")}) format("woff2")`, {
        weight: "700",
      }),
    ];
    loading = Promise.all(faces.map((f) => f.load()))
      .then((loaded) => {
        loaded.forEach((f) => (document.fonts as unknown as Set<FontFace>).add(f));
        return document.fonts.ready;
      })
      .then(() => continueRender(handle))
      .catch((err) => cancelRender(err));
  }
  return loading;
};
