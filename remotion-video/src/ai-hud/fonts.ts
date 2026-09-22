import { continueRender, delayRender, staticFile } from "remotion";
import { FONT_MONO, FONT_SANS } from "./constants";

// Both families are shipped in public/fonts and loaded from disk, so a render
// never depends on a network fetch. Licences travel with them:
//   Inter          — SIL Open Font License 1.1 (public/fonts/Inter-OFL.txt)
//   JetBrains Mono — SIL Open Font License 1.1 (public/fonts/JetBrainsMono-OFL.txt)
const FACES: { family: string; file: string; weight: string }[] = [
  { family: FONT_SANS, file: "fonts/Inter-Regular.woff2", weight: "400" },
  { family: FONT_SANS, file: "fonts/Inter-Medium.woff2", weight: "500" },
  { family: FONT_SANS, file: "fonts/Inter-SemiBold.woff2", weight: "600" },
  { family: FONT_MONO, file: "fonts/JetBrainsMono-Regular.woff2", weight: "400" },
  { family: FONT_MONO, file: "fonts/JetBrainsMono-Medium.woff2", weight: "500" },
];

const handle = delayRender("Loading HUD fonts");

Promise.all(
  FACES.map(({ family, file, weight }) => {
    const face = new FontFace(family, `url(${staticFile(file)}) format("woff2")`, {
      weight,
      style: "normal",
    });
    return face.load().then((loaded) => {
      document.fonts.add(loaded);
    });
  }),
)
  .catch((err) => {
    // Never hang the render on a font problem — fail loudly in the log instead.
    console.error("Failed to load HUD fonts", err);
  })
  .finally(() => {
    continueRender(handle);
  });
