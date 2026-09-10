import { continueRender, delayRender, staticFile } from "remotion";

// Fonts are self-hosted in public/fonts and registered before the first
// frame is captured. Falling back to a system monospace would change
// every glyph advance — and therefore the caret position and the line
// wrapping — between this machine and the render machine.
export const MONO_FAMILY = "JetBrains Mono Embedded";
export const SANS_FAMILY = "Inter Embedded";

// JetBrains Mono advances every glyph by exactly 0.6em, which is what
// lets the caret be positioned by character count instead of by measuring
// text in the DOM.
export const MONO_ADVANCE = 0.6;

type FaceSpec = {
  family: string;
  file: string;
  weight: string;
};

const FACES: FaceSpec[] = [
  { family: MONO_FAMILY, file: "JetBrainsMono-Regular.woff2", weight: "400" },
  { family: MONO_FAMILY, file: "JetBrainsMono-Medium.woff2", weight: "500" },
  { family: SANS_FAMILY, file: "Inter-ExtraLight.woff2", weight: "200" },
  { family: SANS_FAMILY, file: "Inter-Light.woff2", weight: "300" },
  { family: SANS_FAMILY, file: "Inter-Regular.woff2", weight: "400" },
];

if (typeof document !== "undefined") {
  const handle = delayRender("Loading embedded fonts");
  Promise.all(
    FACES.map(async (face) => {
      const fontFace = new FontFace(
        face.family,
        `url(${staticFile(`fonts/${face.file}`)}) format("woff2")`,
        { weight: face.weight, style: "normal", display: "block" },
      );
      document.fonts.add(await fontFace.load());
    }),
  )
    .catch((err) => {
      // Never hang the render on a font problem — fail loud, draw anyway.
      console.error("Failed to load embedded fonts", err);
    })
    .finally(() => continueRender(handle));
}
