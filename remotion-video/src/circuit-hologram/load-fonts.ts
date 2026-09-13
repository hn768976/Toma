import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted fonts so renders never depend on a network fetch. Each
// registers a delayRender() so Remotion waits for the font before it
// captures any frame.
export const DISPLAY_FONT = "Orbitron";
export const MONO_FONT = "Share Tech Mono";

const loadFont = (family: string, file: string, weight: string) => {
  const handle = delayRender(`Loading ${family} font`);
  const fontFace = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, {
    weight,
    style: "normal",
  });
  fontFace
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
    })
    .catch((err) => {
      console.error(`Failed to load ${family} font`, err);
      continueRender(handle);
    });
};

loadFont(DISPLAY_FONT, "Orbitron-ExtraBold.woff2", "800");
loadFont(MONO_FONT, "ShareTechMono-Regular.woff2", "400");
