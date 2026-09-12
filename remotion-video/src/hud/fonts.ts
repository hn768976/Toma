import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted from /public so a render never depends on a network fetch.
// delayRender() holds frame capture until the faces are ready, otherwise
// the first frames would be measured and drawn with fallback metrics.
const FACES: { family: string; file: string; weight: string }[] = [
  { family: "Rajdhani", file: "fonts/Rajdhani-Regular.woff2", weight: "400" },
  { family: "Rajdhani", file: "fonts/Rajdhani-SemiBold.woff2", weight: "600" },
  {
    family: "Share Tech Mono",
    file: "fonts/ShareTechMono-Regular.woff2",
    weight: "400",
  },
];

const handle = delayRender("Loading HUD fonts");

Promise.all(
  FACES.map(({ family, file, weight }) =>
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
  .catch((err) => {
    console.error("Failed to load HUD fonts", err);
  })
  .finally(() => {
    continueRender(handle);
  });
