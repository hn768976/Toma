import { staticFile } from "remotion";

// Blinker SemiBold (SIL OFL 1.1), bundled in public/fonts.
export const FONT_FAMILY = "Blinker";
let promise: Promise<void> | null = null;

export const loadFonts = () => {
  if (!promise) {
    promise = (async () => {
      const face = new FontFace(FONT_FAMILY, `url(${staticFile("fonts/Blinker-SemiBold.ttf")}) format("truetype")`, {
        weight: "600",
      });
      await face.load();
      (document.fonts as unknown as Set<FontFace>).add(face);
    })();
  }
  return promise;
};
