import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted so a render never depends on a network fetch. delayRender()
// holds frame capture until the face is actually ready — otherwise the
// first frames would be measured with a fallback metric and the columns
// would jump.
export const MONO = "JetBrains Mono Embedded";

const handle = delayRender("Loading JetBrains Mono");

const face = new FontFace(
  MONO,
  `url(${staticFile("fonts/JetBrainsMono-Latin.woff2")}) format("woff2")`,
  { weight: "100 800", style: "normal" },
);

face
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to load JetBrains Mono", err);
    continueRender(handle);
  });
