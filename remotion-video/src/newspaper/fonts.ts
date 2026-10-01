import { continueRender, delayRender, staticFile } from "remotion";
import { BODY_FONT, HEADLINE_FONT } from "./constants";

// Self-hosted (OFL) fonts, so renders never depend on a network fetch.
// One delayRender() covers all faces; Remotion waits for every one to be
// ready before it captures a frame.
const faces: { family: string; file: string; weight: string }[] = [
  {
    family: HEADLINE_FONT,
    file: "montserrat-latin-400-normal.woff2",
    weight: "400",
  },
  {
    family: HEADLINE_FONT,
    file: "montserrat-latin-700-normal.woff2",
    weight: "700",
  },
  {
    family: HEADLINE_FONT,
    file: "montserrat-latin-800-normal.woff2",
    weight: "800",
  },
  { family: BODY_FONT, file: "pt-serif-latin-400-normal.woff2", weight: "400" },
  { family: BODY_FONT, file: "pt-serif-latin-700-normal.woff2", weight: "700" },
];

const handle = delayRender("Loading newspaper fonts");

Promise.all(
  faces.map(({ family, file, weight }) =>
    new FontFace(
      family,
      `url(${staticFile(`fonts/${file}`)}) format("woff2")`,
      { weight, style: "normal" },
    )
      .load()
      .then((loaded) => document.fonts.add(loaded)),
  ),
)
  .catch((err) => console.error("Failed to load newspaper fonts", err))
  .finally(() => continueRender(handle));
