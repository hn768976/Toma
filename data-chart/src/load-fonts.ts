import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Inter (latin subset, variable weight) is bundled in public/fonts so the
 * project renders identically offline — no font CDN at render time.
 */
const handle = delayRender("Loading Inter");

const inter = new FontFace(
  "Inter",
  `url(${staticFile("fonts/Inter-latin-variable.woff2")}) format("woff2")`,
  { weight: "100 900" },
);

inter
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    // Fall back to the Helvetica/Arial stack rather than stalling the render.
    console.error("Could not load Inter:", err);
    continueRender(handle);
  });
