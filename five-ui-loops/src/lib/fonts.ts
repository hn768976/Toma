// Ships Inter, JetBrains Mono and Montserrat (SIL OFL 1.1, see public/fonts).
// Loaded once at module level behind delayRender so no frame is captured with
// a fallback font.
import { continueRender, delayRender, staticFile } from "remotion";

export const INTER = "Inter";
export const MONO = "JetBrains Mono";
export const MONTSERRAT = "Montserrat";

const faces: [string, string, string][] = [
  [INTER, "inter-latin-300-normal.woff2", "300"],
  [INTER, "inter-latin-400-normal.woff2", "400"],
  [INTER, "inter-latin-500-normal.woff2", "500"],
  [INTER, "inter-latin-600-normal.woff2", "600"],
  [INTER, "inter-latin-700-normal.woff2", "700"],
  [MONO, "jetbrains-mono-latin-300-normal.woff2", "300"],
  [MONO, "jetbrains-mono-latin-400-normal.woff2", "400"],
  [MONO, "jetbrains-mono-latin-500-normal.woff2", "500"],
  [MONO, "jetbrains-mono-latin-700-normal.woff2", "700"],
  [MONTSERRAT, "montserrat-latin-400-normal.woff2", "400"],
  [MONTSERRAT, "montserrat-latin-500-normal.woff2", "500"],
  [MONTSERRAT, "montserrat-latin-600-normal.woff2", "600"],
  [MONTSERRAT, "montserrat-latin-700-normal.woff2", "700"],
];

if (typeof document !== "undefined") {
  const handle = delayRender("Loading fonts");
  Promise.all(
    faces.map(([family, file, weight]) => {
      const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, {
        weight,
        style: "normal",
      });
      return face.load().then((f) => (document.fonts as unknown as Set<FontFace>).add(f));
    }),
  )
    .then(() => document.fonts.ready)
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error(err);
      throw err;
    });
}
