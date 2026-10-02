import { continueRender, delayRender, staticFile } from "remotion";

// Shipped OFL fonts (public/fonts). Loaded once, gated by delayRender so no
// frame is captured before the glyphs are available (also needed before any
// text is drawn into a canvas texture).
const FONTS: { family: string; file: string; weight: string }[] = [
  { family: "Inter", file: "inter-latin-400-normal.woff2", weight: "400" },
  { family: "Inter", file: "inter-latin-600-normal.woff2", weight: "600" },
  { family: "Inter", file: "inter-latin-700-normal.woff2", weight: "700" },
  { family: "JetBrains Mono", file: "jetbrains-mono-latin-400-normal.woff2", weight: "400" },
  { family: "JetBrains Mono", file: "jetbrains-mono-latin-500-normal.woff2", weight: "500" },
  { family: "Montserrat", file: "montserrat-latin-600-normal.woff2", weight: "600" },
  { family: "Montserrat", file: "montserrat-latin-700-normal.woff2", weight: "700" },
];

let promise: Promise<void> | null = null;

export const loadFonts = (): Promise<void> => {
  if (promise) return promise;
  const handle = delayRender("Loading shipped fonts");
  promise = Promise.all(
    FONTS.map(async (f) => {
      const face = new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)}) format("woff2")`, {
        weight: f.weight,
        style: "normal",
      });
      await face.load();
      (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
    }),
  ).then(() => {
    continueRender(handle);
  });
  return promise;
};
