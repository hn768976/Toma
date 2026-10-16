import { staticFile } from "remotion";

// OFL fonts shipped in public/fonts. Loaded once per tab.
const FACES: [string, string, string][] = [
  ["Inter", "fonts/inter-latin-400-normal.woff2", "400"],
  ["Inter", "fonts/inter-latin-500-normal.woff2", "500"],
  ["Inter", "fonts/inter-latin-600-normal.woff2", "600"],
  ["Inter", "fonts/inter-latin-700-normal.woff2", "700"],
  ["JetBrains Mono", "fonts/jetbrains-mono-latin-400-normal.woff2", "400"],
  ["JetBrains Mono", "fonts/jetbrains-mono-latin-500-normal.woff2", "500"],
];

let promise: Promise<void> | null = null;
let loaded = false;

export const fontsLoaded = () => loaded;

export const loadFonts = (): Promise<void> => {
  if (!promise) {
    promise = Promise.all(
      FACES.map(([family, file, weight]) =>
        new FontFace(family, `url(${staticFile(file)}) format("woff2")`, { weight }).load().then((f) => {
          (document.fonts as unknown as { add: (f: FontFace) => void }).add(f);
        }),
      ),
    ).then(() => {
      loaded = true;
    });
  }
  return promise;
};

export const INTER = "Inter";
export const MONO = "JetBrains Mono";
