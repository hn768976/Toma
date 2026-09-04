import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Roboto Mono (Apache 2.0) is bundled in public/fonts so a render is identical
 * on any machine and needs no network. The fallbacks only matter if the file
 * is missing.
 */
export const MONO_FAMILY =
  "'Roboto Mono Bundled', 'Roboto Mono', 'DejaVu Sans Mono', 'Liberation Mono', monospace";

const handle = delayRender("Loading Roboto Mono");

const face = new FontFace(
  "Roboto Mono Bundled",
  `url(${staticFile("fonts/RobotoMono-Latin-400.woff2")}) format('woff2')`,
  { weight: "400", style: "normal" },
);

face
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    // Fall back to a system monospace rather than failing the render.
    // eslint-disable-next-line no-console
    console.warn("Could not load bundled Roboto Mono:", err);
    continueRender(handle);
  });
