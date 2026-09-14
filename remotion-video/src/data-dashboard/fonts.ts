import { continueRender, delayRender, staticFile } from "remotion";

// Self-hosted so rendering never depends on a network fetch at render
// time. Each face registers a delayRender() so Remotion holds frame
// capture until the glyphs are actually available - otherwise the first
// frames would render in a fallback face and the type would jump.
const FACES: { family: string; file: string; weight: string }[] = [
  // Roboto Mono ships as a variable font, so one file covers 100-700.
  { family: "Roboto Mono", file: "RobotoMono-latin.woff2", weight: "100 700" },
  { family: "Barlow", file: "Barlow-500-latin.woff2", weight: "500" },
  { family: "Barlow", file: "Barlow-600-latin.woff2", weight: "600" },
  { family: "Barlow", file: "Barlow-700-latin.woff2", weight: "700" },
];

for (const face of FACES) {
  const handle = delayRender(`Loading ${face.family} ${face.weight}`);
  const fontFace = new FontFace(
    face.family,
    `url(${staticFile(`fonts/${face.file}`)}) format("woff2")`,
    { weight: face.weight, style: "normal" },
  );
  fontFace
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
    })
    .catch((err) => {
      console.error(`Failed to load ${face.family} ${face.weight}`, err);
      continueRender(handle);
    });
}
