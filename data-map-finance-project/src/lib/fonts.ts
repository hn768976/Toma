import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Shipped OFL fonts (public/fonts). Loaded through the FontFace API and held
// behind delayRender so no frame is captured with a fallback font.
const FACES: { family: string; file: string; weight: string }[] = [
  { family: "Inter", file: "fonts/inter-latin-400-normal.woff2", weight: "400" },
  { family: "Inter", file: "fonts/inter-latin-500-normal.woff2", weight: "500" },
  { family: "Inter", file: "fonts/inter-latin-600-normal.woff2", weight: "600" },
  { family: "Inter", file: "fonts/inter-latin-700-normal.woff2", weight: "700" },
  { family: "Inter", file: "fonts/inter-latin-800-normal.woff2", weight: "800" },
  { family: "JetBrains Mono", file: "fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400" },
  { family: "JetBrains Mono", file: "fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500" },
  { family: "JetBrains Mono", file: "fonts/jetbrains-mono-latin-700-normal.woff2", weight: "700" },
];

export const INTER = "Inter, sans-serif";
export const MONO = "'JetBrains Mono', monospace";

let fontPromise: Promise<void> | null = null;

export const loadFonts = (): Promise<void> => {
  if (!fontPromise) {
    fontPromise = Promise.all(
      FACES.map(async (f) => {
        const face = new FontFace(f.family, `url(${staticFile(f.file)}) format('woff2')`, {
          weight: f.weight,
          style: "normal",
        });
        await face.load();
        (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
      }),
    ).then(() => undefined);
  }
  return fontPromise;
};

/** True once all fonts are loaded; rendering is held until then. */
export const useFonts = (): boolean => {
  const [handle] = useState(() => delayRender("Loading fonts"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadFonts().then(() => setReady(true));
  }, []);
  // Release the frame only after the ready state has been committed.
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle]);
  return ready;
};
