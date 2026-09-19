import { continueRender, delayRender, staticFile } from "remotion";
import { FONTS } from "./constants";

// The three faces are self-hosted under public/fonts so a render never
// depends on a network fetch. A delayRender() handle keeps Remotion from
// screenshotting frame 0 before the faces are actually measurable, which
// would otherwise bake a fallback-font frame into the master.

type Spec = { family: string; file: string; weight: string };

const SPECS: Spec[] = [
  { family: FONTS.code, file: "fonts/RobotoMono-Regular.woff2", weight: "400" },
  { family: FONTS.code, file: "fonts/RobotoMono-Bold.woff2", weight: "700" },
  { family: FONTS.pixel, file: "fonts/Silkscreen-Bold.woff2", weight: "700" },
  { family: FONTS.round, file: "fonts/Comfortaa-Bold.woff2", weight: "700" },
];

let loaded = false;

const handle = delayRender("Loading cyber-attack fonts");

export const fontsReady: Promise<void> = Promise.all(
  SPECS.map(async (spec) => {
    const face = new FontFace(
      spec.family,
      `url(${staticFile(spec.file)}) format("woff2")`,
      { weight: spec.weight, style: "normal" },
    );
    document.fonts.add(await face.load());
  }),
)
  .then(() => {
    loaded = true;
  })
  .catch((err) => {
    // Never hang the render on a font problem: fall back to the generic
    // families declared alongside each face at the call site.
    console.error("cyber-attack: font loading failed", err);
    loaded = true;
  })
  .finally(() => {
    continueRender(handle);
  });

export const fontsLoaded = (): boolean => loaded;
