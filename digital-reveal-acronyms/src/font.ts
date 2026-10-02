import { staticFile } from "remotion";

// Montserrat ExtraBold (SIL OFL 1.1), shipped in public/fonts.
export const FONT_FAMILY = "MontserratReveal";
export const FONT_WEIGHT = 800;

let fontPromise: Promise<void> | null = null;

// Loads the font once per page. Callers wrap this in delayRender so nothing
// is sampled or screenshotted before the real letter shapes are available.
export const loadFont = (): Promise<void> => {
  if (!fontPromise) {
    const face = new FontFace(
      FONT_FAMILY,
      `url('${staticFile("fonts/Montserrat-ExtraBold.woff2")}') format('woff2')`,
      { weight: String(FONT_WEIGHT), style: "normal" },
    );
    fontPromise = face.load().then((loaded) => {
      document.fonts.add(loaded);
      if (!document.fonts.check(`${FONT_WEIGHT} 50px ${FONT_FAMILY}`)) {
        throw new Error("Montserrat failed to register");
      }
    });
  }
  return fontPromise;
};
