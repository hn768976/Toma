import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted subsets (Latin + the five currency signs), so a render
// never depends on a network fetch and looks identical on any machine.
export const DISPLAY_FONT = "Currency Sans";
export const TICKER_FONT = "Currency Mono";

const faces: [string, string, string][] = [
  [DISPLAY_FONT, "fonts/CurrencySans-Regular.woff2", "400"],
  [DISPLAY_FONT, "fonts/CurrencySans-Bold.woff2", "700"],
  [TICKER_FONT, "fonts/CurrencyMono-Regular.woff2", "400"],
];

for (const [family, file, weight] of faces) {
  const handle = delayRender(`Loading ${family} ${weight}`);
  new FontFace(family, `url(${staticFile(file)}) format("woff2")`, {
    weight,
    style: "normal",
  })
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
    })
    .catch((err) => {
      console.error(`Failed to load ${family} ${weight}`, err);
      continueRender(handle);
    });
}
