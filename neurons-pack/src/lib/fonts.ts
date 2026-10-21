// Inter (SIL OFL 1.1), bundled from @fontsource/inter and loaded behind
// delayRender() so no frame is captured before the glyphs are ready.
import inter600 from "@fontsource/inter/files/inter-latin-600-normal.woff2";
import inter700 from "@fontsource/inter/files/inter-latin-700-normal.woff2";
import { continueRender, delayRender } from "remotion";

export const LABEL_FONT = "InterLabels";

let loaded = false;
export const loadLabelFont = () => {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const handle = delayRender("Loading Inter");
  const faces = [
    new FontFace(LABEL_FONT, `url(${inter600}) format("woff2")`, { weight: "600" }),
    new FontFace(LABEL_FONT, `url(${inter700}) format("woff2")`, { weight: "700" }),
  ];
  Promise.all(faces.map((f) => f.load()))
    .then((fs) => {
      fs.forEach((f) => document.fonts.add(f));
      continueRender(handle);
    })
    .catch((e) => {
      console.error(e);
      continueRender(handle);
    });
};
