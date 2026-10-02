import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Shipped OFL fonts (public/fonts, licences in public/licenses).
 * Loaded once at module level behind delayRender/continueRender so no
 * frame is captured before every face is ready.
 */
export const INTER = "Inter";
export const MONO = "JetBrains Mono";
export const MONTSERRAT = "Montserrat";

const FACES: { family: string; file: string; weight: string }[] = [
  { family: INTER, file: "Inter-Regular.ttf", weight: "400" },
  { family: INTER, file: "Inter-Medium.ttf", weight: "500" },
  { family: INTER, file: "Inter-SemiBold.ttf", weight: "600" },
  { family: INTER, file: "Inter-Bold.ttf", weight: "700" },
  { family: MONO, file: "JetBrainsMono-Regular.ttf", weight: "400" },
  { family: MONO, file: "JetBrainsMono-Medium.ttf", weight: "500" },
  { family: MONO, file: "JetBrainsMono-Bold.ttf", weight: "700" },
  { family: MONTSERRAT, file: "Montserrat-SemiBold.ttf", weight: "600" },
  { family: MONTSERRAT, file: "Montserrat-ExtraBold.ttf", weight: "800" },
];

const handle = delayRender("Loading shipped fonts");

export const fontsReady: Promise<void> = Promise.all(
  FACES.map((f) => {
    const face = new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)}) format("truetype")`, {
      weight: f.weight,
      style: "normal",
    });
    return face.load().then((loaded) => {
      document.fonts.add(loaded);
    });
  }),
)
  .then(() => undefined)
  .catch((err) => {
    console.error("Font loading failed", err);
    throw err;
  })
  .finally(() => continueRender(handle));
