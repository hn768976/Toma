import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// OFL fonts shipped in public/fonts (licence texts alongside).
export const FONT_AI = "Orbitron"; // SemiBold (600) for "AI"
export const FONT_MONO = "JetBrains Mono"; // HUD text
export const FONT_HEAD = "Rajdhani"; // HUD headings

const FACES: { family: string; file: string; weight: string }[] = [
  { family: FONT_AI, file: "fonts/Orbitron-Variable.ttf", weight: "400 900" },
  { family: FONT_MONO, file: "fonts/JetBrainsMono-Variable.ttf", weight: "100 800" },
  { family: FONT_HEAD, file: "fonts/Rajdhani-SemiBold.ttf", weight: "600" },
  { family: FONT_HEAD, file: "fonts/Rajdhani-Bold.ttf", weight: "700" },
];

let loading: Promise<void> | null = null;
let loaded = false;

const loadAll = () => {
  if (!loading) {
    loading = Promise.all(
      FACES.map(async (f) => {
        const face = new FontFace(f.family, `url(${staticFile(f.file)})`, { weight: f.weight });
        await face.load();
        (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
      }),
    ).then(async () => {
      // Make sure canvas 2D can use the exact weights we draw with.
      await Promise.all([
        document.fonts.load(`600 64px "${FONT_AI}"`),
        document.fonts.load(`500 64px "${FONT_MONO}"`),
        document.fonts.load(`700 64px "${FONT_MONO}"`),
        document.fonts.load(`600 64px "${FONT_HEAD}"`),
        document.fonts.load(`700 64px "${FONT_HEAD}"`),
      ]);
      loaded = true;
    });
  }
  return loading;
};

/** Blocks the render (delayRender) until every font is ready. */
export const useFontsReady = () => {
  const [ready, setReady] = useState(loaded);
  useEffect(() => {
    if (loaded) return;
    const handle = delayRender("Loading OFL fonts");
    loadAll()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        throw e;
      });
  }, []);
  return ready;
};
