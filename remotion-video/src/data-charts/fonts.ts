import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted variable fonts (Inter for labels, JetBrains Mono for the
// numeric read-outs) so a render never depends on a network fetch. Each
// registers a delayRender() so Remotion waits for the font before it
// captures any frame.
export const UI_FONT = "Inter";
export const MONO_FONT = "JetBrains Mono";

const loadFont = (family: string, file: string) => {
  const handle = delayRender(`Loading ${family} font`);
  const fontFace = new FontFace(
    family,
    `url(${staticFile(`fonts/${file}`)}) format("woff2")`,
    { weight: "100 900", style: "normal" },
  );
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

loadFont(UI_FONT, "Inter.woff2");
loadFont(MONO_FONT, "JetBrainsMono.woff2");
