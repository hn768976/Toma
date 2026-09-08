import { continueRender, delayRender, staticFile } from "remotion";

/**
 * The numeric readouts use a bundled mono face so the render is identical on
 * any machine, rather than falling through to whatever `monospace` resolves to.
 */
const handle = delayRender("Loading RouteMapMono");
const face = new FontFace(
  "RouteMapMono",
  `url(${staticFile("fonts/DejaVuSansMono.ttf")}) format("truetype")`,
);

face
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch(() => continueRender(handle));
