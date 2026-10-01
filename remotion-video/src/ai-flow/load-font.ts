import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted Montserrat Bold for the chip label, so renders never depend
// on system fonts or a network fetch.
export const CHIP_FONT_FAMILY = "Montserrat";

const handle = delayRender("Loading Montserrat font");

new FontFace(
  CHIP_FONT_FAMILY,
  `url(${staticFile("fonts/Montserrat-Bold.woff2")}) format("woff2")`,
  { weight: "700", style: "normal" },
)
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    console.error("Failed to load Montserrat font", err);
    continueRender(handle);
  });
