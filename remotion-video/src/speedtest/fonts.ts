import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Self-hosted display + micro fonts. Registering a delayRender() keeps Remotion
 * from capturing a frame before the faces are ready, so no render ever falls
 * back to a system font.
 */
const FACES: { family: string; file: string; weight: string }[] = [
  { family: "Rajdhani", file: "fonts/Rajdhani-Medium.ttf", weight: "500" },
  { family: "Rajdhani", file: "fonts/Rajdhani-SemiBold.ttf", weight: "600" },
  { family: "Rajdhani", file: "fonts/Rajdhani-Bold.ttf", weight: "700" },
  { family: "Archivo", file: "fonts/Archivo-Medium.ttf", weight: "500" },
  { family: "Archivo", file: "fonts/Archivo-SemiBold.ttf", weight: "600" },
];

const handle = delayRender("Loading speed-test fonts");

Promise.all(
  FACES.map(async ({ family, file, weight }) => {
    const face = new FontFace(
      family,
      `url(${staticFile(file)}) format("truetype")`,
      {
        weight,
        style: "normal",
      },
    );
    document.fonts.add(await face.load());
  }),
)
  .catch((err) => {
    console.error("Failed to load speed-test fonts", err);
  })
  .finally(() => {
    continueRender(handle);
  });
