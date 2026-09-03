import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Work Sans Bold is bundled in public/fonts so the project renders identically
 * offline — no Google Fonts fetch at render time.
 */
const handle = delayRender("Loading Work Sans");

const font = new FontFace(
  "Work Sans",
  `url(${staticFile("fonts/WorkSans-Bold.ttf")}) format('truetype')`,
  { weight: "700", style: "normal" },
);

font
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Could not load Work Sans", err);
    continueRender(handle);
  });
