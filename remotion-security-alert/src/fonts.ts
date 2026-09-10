/**
 * Fonts are shipped inside the project and registered through a
 * delayRender() handle, so a render never depends on a network fetch and
 * no frame is captured before the faces are ready.
 *
 * Both files are variable fonts: Archivo carries a width axis as well as
 * weight, which is what lets the alert caps sit slightly condensed
 * without faking it with a horizontal scale.
 */
import { continueRender, delayRender, staticFile } from "remotion";

export const MONO = "SecAlertMono";
export const SANS = "SecAlertSans";

const handle = delayRender("Loading Security Alert fonts");

const faces = [
  new FontFace(
    MONO,
    `url(${staticFile("fonts/RobotoMono-VariableFont.woff2")}) format("woff2")`,
    { weight: "400 700", style: "normal" },
  ),
  new FontFace(
    SANS,
    `url(${staticFile("fonts/Archivo-VariableFont.woff2")}) format("woff2")`,
    { weight: "400 900", stretch: "62% 125%", style: "normal" },
  ),
];

Promise.all(
  faces.map((face) => face.load().then((loaded) => document.fonts.add(loaded))),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error("Failed to load embedded fonts", err);
    continueRender(handle);
  });
