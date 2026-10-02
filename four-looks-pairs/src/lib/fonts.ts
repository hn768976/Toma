import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

/**
 * Shipped OFL fonts (see public/fonts/*-OFL.txt). Loaded once per tab;
 * frames are held with delayRender until every face is ready.
 */
export const MONTSERRAT = "Montserrat";
export const INTER = "Inter";

const faces: Array<[string, string, string]> = [
  [MONTSERRAT, "fonts/montserrat-latin-700-normal.woff2", "700"],
  [MONTSERRAT, "fonts/montserrat-latin-800-normal.woff2", "800"],
  [INTER, "fonts/inter-latin-500-normal.woff2", "500"],
  [INTER, "fonts/inter-latin-600-normal.woff2", "600"],
];

const handle = delayRender("Loading Montserrat + Inter");

export const fontsReady: Promise<void> = Promise.all(
  faces.map(([family, file, weight]) => {
    const face = new FontFace(family, `url(${staticFile(file)}) format("woff2")`, {
      weight,
      style: "normal",
    });
    return face.load().then((loaded) => {
      document.fonts.add(loaded);
    });
  }),
).then(
  () => continueRender(handle),
  (err) => cancelRender(err),
);
