import { staticFile } from "remotion";

// IM Fell English (OFL), shipped in public/fonts.
export const FELL = "IM Fell English";

let fontsPromise: Promise<void> | null = null;

export const loadFonts = () => {
  if (!fontsPromise) {
    const faces = [
      new FontFace(FELL, `url(${staticFile("fonts/IMFellEnglish-Regular.ttf")})`, { style: "normal", weight: "400" }),
      new FontFace(FELL, `url(${staticFile("fonts/IMFellEnglish-Italic.ttf")})`, { style: "italic", weight: "400" }),
    ];
    fontsPromise = Promise.all(
      faces.map(async (f) => {
        await f.load();
        document.fonts.add(f);
      }),
    ).then(() => undefined);
  }
  return fontsPromise;
};
