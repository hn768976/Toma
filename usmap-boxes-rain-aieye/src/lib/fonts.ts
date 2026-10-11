import { continueRender, delayRender, staticFile } from "remotion";

// OFL fonts shipped in public/fonts. Loaded once per tab; callers wait on the promise.
const FONTS = [
  { family: "Inter", weight: "500", file: "fonts/Inter-Medium.woff2" },
  { family: "Inter", weight: "600", file: "fonts/Inter-SemiBold.woff2" },
  { family: "JetBrains Mono", weight: "500", file: "fonts/JetBrainsMono-Medium.woff2" },
];

let fontsPromise: Promise<void> | null = null;

export const loadFonts = (): Promise<void> => {
  if (!fontsPromise) {
    const handle = delayRender("Loading OFL fonts");
    fontsPromise = Promise.all(
      FONTS.map(async (f) => {
        const face = new FontFace(f.family, `url(${staticFile(f.file)})`, {
          weight: f.weight,
        });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => continueRender(handle));
  }
  return fontsPromise;
};
