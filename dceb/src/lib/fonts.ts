import { staticFile } from "remotion";

/** OFL fonts shipped in public/fonts. Loaded once, before any texture is drawn. */
const FACES: { family: string; file: string; weight: string }[] = [
  { family: "Inter", file: "fonts/Inter/inter-latin-400-normal.woff2", weight: "400" },
  { family: "Inter", file: "fonts/Inter/inter-latin-600-normal.woff2", weight: "600" },
  { family: "Inter", file: "fonts/Inter/inter-latin-700-normal.woff2", weight: "700" },
  { family: "JetBrains Mono", file: "fonts/JetBrainsMono/jetbrains-mono-latin-400-normal.woff2", weight: "400" },
  { family: "JetBrains Mono", file: "fonts/JetBrainsMono/jetbrains-mono-latin-500-normal.woff2", weight: "500" },
  { family: "JetBrains Mono", file: "fonts/JetBrainsMono/jetbrains-mono-latin-700-normal.woff2", weight: "700" },
];

let promise: Promise<void> | null = null;

export const loadFonts = () => {
  if (!promise) {
    promise = Promise.all(
      FACES.map(async (f) => {
        const face = new FontFace(f.family, `url(${staticFile(f.file)}) format("woff2")`, { weight: f.weight });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => undefined);
  }
  return promise;
};
