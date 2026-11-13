import { continueRender, delayRender, staticFile } from "remotion";

// Fonts are bundled in public/fonts so renders never depend on the network
// or on fonts installed on the rendering machine.
const FONTS: { family: string; file: string; weight: string }[] = [
  { family: "Rajdhani", file: "rajdhani-latin-400-normal.woff2", weight: "400" },
  { family: "Rajdhani", file: "rajdhani-latin-500-normal.woff2", weight: "500" },
  { family: "Rajdhani", file: "rajdhani-latin-600-normal.woff2", weight: "600" },
  { family: "Rajdhani", file: "rajdhani-latin-700-normal.woff2", weight: "700" },
  { family: "ShareTechMono", file: "share-tech-mono-latin-400-normal.woff2", weight: "400" },
];

let promise: Promise<void> | null = null;

export const loadFonts = (): Promise<void> => {
  if (promise) return promise;
  const handle = delayRender("Loading HUD fonts");
  promise = Promise.all(
    FONTS.map(async (f) => {
      const face = new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)})`, {
        weight: f.weight,
      });
      await face.load();
      document.fonts.add(face);
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error(err);
      continueRender(handle);
      throw err;
    });
  return promise;
};
