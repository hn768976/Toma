import { continueRender, delayRender, staticFile } from "remotion";

// Fonts are self-hosted (OFL, see public/fonts) and every face is loaded
// behind delayRender(), so no frame is captured before the text can be
// laid out with the final metrics.
export const INTER = "Inter";
export const MONO = "JetBrains Mono";

const faces: { family: string; file: string; weight: string }[] = [
  { family: INTER, file: "inter-latin-400-normal.woff2", weight: "400" },
  { family: INTER, file: "inter-latin-600-normal.woff2", weight: "600" },
  { family: INTER, file: "inter-latin-700-normal.woff2", weight: "700" },
  { family: MONO, file: "jetbrains-mono-latin-400-normal.woff2", weight: "400" },
  { family: MONO, file: "jetbrains-mono-latin-500-normal.woff2", weight: "500" },
  { family: MONO, file: "jetbrains-mono-latin-700-normal.woff2", weight: "700" },
];

const handle = delayRender("Loading Inter + JetBrains Mono");

Promise.all(
  faces.map((f) =>
    new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)}) format("woff2")`, {
      weight: f.weight,
      style: "normal",
    })
      .load()
      .then((loaded) => document.fonts.add(loaded)),
  ),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error("Font loading failed", err);
    continueRender(handle);
  });
