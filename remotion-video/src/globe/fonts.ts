import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted woff2 so a render from the project zip never needs network
// access. Canvas 2D can only use fonts that are already in document.fonts,
// so a delayRender() holds frame capture until both faces resolve.
export const CONDENSED_FAMILY = "GlobeCondensed";
export const MONO_FAMILY = "GlobeMono";

const FACES: [string, string, string][] = [
  [CONDENSED_FAMILY, "400", "fonts/RobotoCondensed-Regular.woff2"],
  [CONDENSED_FAMILY, "700", "fonts/RobotoCondensed-Bold.woff2"],
  [MONO_FAMILY, "400", "fonts/RobotoMono-Regular.woff2"],
  [MONO_FAMILY, "700", "fonts/RobotoMono-Bold.woff2"],
];

const handle = delayRender("Loading ticker fonts");

Promise.all(
  FACES.map(([family, weight, file]) =>
    new FontFace(family, `url(${staticFile(file)}) format("woff2")`, {
      weight,
      style: "normal",
    })
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
      }),
  ),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error("Failed to load ticker fonts", err);
    continueRender(handle);
  });
