import { continueRender, delayRender } from "remotion";
import { mono400, rajdhani500, rajdhani600, rajdhani700 } from "./fonts.data";

/**
 * The two typefaces ship inside the bundle as base64, so a render never touches
 * the network and never races a webfont. Both are SIL OFL 1.1.
 */
const faces: FontFace[] = [
  new FontFace("Rajdhani HUD", `url(${rajdhani500})`, { weight: "500" }),
  new FontFace("Rajdhani HUD", `url(${rajdhani600})`, { weight: "600" }),
  new FontFace("Rajdhani HUD", `url(${rajdhani700})`, { weight: "700" }),
  new FontFace("Share Tech HUD", `url(${mono400})`, { weight: "400" }),
];

const handle = delayRender("Loading embedded HUD fonts");

Promise.all(faces.map((face) => face.load()))
  .then((loaded) => {
    loaded.forEach((face) => document.fonts.add(face));
    continueRender(handle);
  })
  .catch((err) => {
    // Never hang a render on a font: fall back to the system stack.
    // eslint-disable-next-line no-console
    console.error("Font loading failed", err);
    continueRender(handle);
  });

export {};
