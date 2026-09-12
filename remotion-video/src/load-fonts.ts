import { continueRender, delayRender, staticFile } from "remotion";

// Fonts are self-hosted from public/ so rendering never depends on a
// network fetch at render time. Each registers a delayRender() so Remotion
// waits for the face to be ready before it captures any frame - important
// for the market map in particular, which draws its tickers into a canvas
// and would silently fall back to a default face if it painted early.

export const FONT_FAMILY_NAME = "Patrick Hand";
export const MARKET_FONT_FAMILY_NAME = "Share Tech Mono";

const loadFont = (family: string, file: string) => {
  const handle = delayRender(`Loading ${family} font`);

  new FontFace(family, `url(${staticFile(file)}) format("woff2")`, {
    weight: "400",
    style: "normal",
  })
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

loadFont(FONT_FAMILY_NAME, "fonts/PatrickHand-Regular.woff2");
loadFont(MARKET_FONT_FAMILY_NAME, "fonts/ShareTechMono-Regular.woff2");
