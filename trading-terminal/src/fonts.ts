import { continueRender, delayRender, staticFile } from "remotion";
import { MONO, SANS } from "./theme";

// Fonts are shipped in public/fonts (OFL). Every frame waits for this promise
// before drawing text into canvases.
const FILES: [string, string, string][] = [
  [SANS, "400", "fonts/Inter-400.woff2"],
  [SANS, "500", "fonts/Inter-500.woff2"],
  [SANS, "600", "fonts/Inter-600.woff2"],
  [SANS, "700", "fonts/Inter-700.woff2"],
  [MONO, "400", "fonts/JetBrainsMono-400.woff2"],
  [MONO, "500", "fonts/JetBrainsMono-500.woff2"],
  [MONO, "600", "fonts/JetBrainsMono-500.woff2"],
  [MONO, "700", "fonts/JetBrainsMono-700.woff2"],
];

const handle = delayRender("Loading Inter + JetBrains Mono");

export const fontsReady: Promise<void> = Promise.all(
  FILES.map(([family, weight, file]) => {
    const f = new FontFace(family, `url(${staticFile(file)}) format("woff2")`, { weight });
    return f.load().then((loaded) => {
      (document.fonts as unknown as Set<FontFace>).add(loaded);
    });
  }),
)
  .then(() => undefined)
  .finally(() => continueRender(handle));
