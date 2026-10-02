import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// JetBrains Mono + Inter (SIL OFL 1.1, see public/fonts/LICENSE-*.txt).
const FACES: { family: string; file: string; weight: string }[] = [
  { family: "JetBrains Mono", file: "fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400" },
  { family: "JetBrains Mono", file: "fonts/jetbrains-mono-latin-700-normal.woff2", weight: "700" },
  { family: "Inter", file: "fonts/inter-latin-400-normal.woff2", weight: "400" },
  { family: "Inter", file: "fonts/inter-latin-600-normal.woff2", weight: "600" },
];

let fontsPromise: Promise<void> | null = null;
const loadFonts = () => {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      FACES.map(async (f) => {
        const face = new FontFace(f.family, `url(${staticFile(f.file)}) format("woff2")`, {
          weight: f.weight,
        });
        await face.load();
        (document.fonts as unknown as Set<FontFace>).add(face);
      }),
    ).then(() => undefined);
  }
  return fontsPromise;
};

/** Returns true once both shipped fonts are loaded; holds the render until then. */
export const useFontsReady = () => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    loadFonts()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        throw e;
      });
  }, [handle]);
  return ready;
};
