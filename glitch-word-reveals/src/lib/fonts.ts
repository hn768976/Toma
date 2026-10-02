import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

// All three fonts ship in public/fonts. Loading is wrapped in
// delayRender/continueRender so no frame is captured, and no word is
// measured, before the real glyphs are available.
export const FONT_A = "Bebas Neue";
export const FONT_B = "Archivo Black";
export const FONT_MONO = "JetBrains Mono";

const FILES: [string, string, string][] = [
  [FONT_A, "fonts/BebasNeue-Regular.ttf", "400"],
  [FONT_B, "fonts/ArchivoBlack-Regular.ttf", "400"],
  [FONT_MONO, "fonts/JetBrainsMono-wght.ttf", "100 800"],
];

const handle = delayRender("Loading fonts", { timeoutInMilliseconds: 60000 });

export const fontsReady: Promise<void> = Promise.all(
  FILES.map(async ([family, file, weight]) => {
    const face = new FontFace(family, `url(${staticFile(file)})`, { weight });
    await face.load();
    (document.fonts as unknown as Set<FontFace>).add(face);
  }),
).then(
  () => continueRender(handle),
  (err) => {
    // Fail loudly: a render with a fallback font is worse than no render.
    cancelRender(err);
  },
);
