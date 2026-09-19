import { continueRender, delayRender, staticFile } from "remotion";
import { FONT_FAMILY } from "./constants";

/**
 * Liberation Sans Bold is metrically identical to Arial/Helvetica Bold — the
 * face the reference uses — and is SIL Open Font Licensed, so it ships with
 * the project. Self-hosting it means a render on any machine produces the
 * same type, instead of silently falling back to whatever sans the host has.
 */
const handle = delayRender("Loading Liberation Sans Bold");

new FontFace(
  FONT_FAMILY,
  `url(${staticFile("fonts/LiberationSans-Bold.ttf")}) format("truetype")`,
  { weight: "700", style: "normal" },
)
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    console.error("Failed to load Liberation Sans Bold", err);
    continueRender(handle);
  });
