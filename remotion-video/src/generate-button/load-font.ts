import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Self-hosted so a render never depends on a network fetch or on whatever
 * fonts happen to be installed on the rendering machine. Liberation Sans is
 * metric-compatible with Arial, which is what the reference button uses.
 */
export const GENERATE_FONT_FAMILY = "Generate Sans";

const handle = delayRender("Loading Generate Sans");

const face = new FontFace(
  GENERATE_FONT_FAMILY,
  `url(${staticFile("fonts/LiberationSans-Regular.ttf")}) format("truetype")`,
  { weight: "400", style: "normal" },
);

face
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    console.error("Failed to load Generate Sans", err);
    continueRender(handle);
  });
