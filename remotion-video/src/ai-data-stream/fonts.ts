import { continueRender, delayRender, staticFile } from "remotion";
import { FONT_FAMILY } from "./constants";

// Self-hosted JetBrains Mono (OFL) so rendering never depends on the
// network. All four faces are registered under one family name and a
// single delayRender() holds frame capture until they are usable.
const FACES: { file: string; weight: string; style: string }[] = [
  { file: "JetBrainsMono-Regular.ttf", weight: "400", style: "normal" },
  { file: "JetBrainsMono-Italic.ttf", weight: "400", style: "italic" },
  { file: "JetBrainsMono-Bold.ttf", weight: "700", style: "normal" },
  { file: "JetBrainsMono-BoldItalic.ttf", weight: "700", style: "italic" },
];

const handle = delayRender("Loading JetBrains Mono");

Promise.all(
  FACES.map((face) =>
    new FontFace(
      FONT_FAMILY,
      `url(${staticFile(`fonts/${face.file}`)}) format("truetype")`,
      { weight: face.weight, style: face.style },
    )
      .load()
      .then((loaded) => document.fonts.add(loaded)),
  ),
)
  .catch((err) => console.error("Failed to load JetBrains Mono", err))
  .finally(() => continueRender(handle));
