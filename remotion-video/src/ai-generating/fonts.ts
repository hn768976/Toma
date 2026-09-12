// Self-hosted webfonts, registered behind delayRender() so no frame is ever
// captured while the browser is still falling back to a system face.
import { continueRender, delayRender, staticFile } from "remotion";

type FontSpec = {
  family: string;
  file: string;
  weight: string;
};

const FONTS: FontSpec[] = [
  {
    family: "Montserrat",
    file: "fonts/Montserrat-Latin-Variable.woff2",
    weight: "100 900",
  },
  {
    family: "Roboto Mono",
    file: "fonts/RobotoMono-Latin-Variable.woff2",
    weight: "100 700",
  },
];

for (const spec of FONTS) {
  const handle = delayRender(`Loading ${spec.family}`);
  new FontFace(spec.family, `url(${staticFile(spec.file)}) format("woff2")`, {
    weight: spec.weight,
    style: "normal",
  })
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
    })
    .catch((err) => {
      // Never hang the render on a font: fall back and carry on.
      console.error(`Failed to load ${spec.family}`, err);
      continueRender(handle);
    });
}
