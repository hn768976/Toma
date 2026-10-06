import { staticFile } from "remotion";

const FACES: [string, string, string][] = [
  ["Inter", "inter-latin-400-normal.woff2", "400"],
  ["Inter", "inter-latin-500-normal.woff2", "500"],
  ["Inter", "inter-latin-600-normal.woff2", "600"],
  ["Inter", "inter-latin-700-normal.woff2", "700"],
  ["Inter", "inter-latin-800-normal.woff2", "800"],
  ["JetBrains Mono", "jetbrains-mono-latin-400-normal.woff2", "400"],
  ["JetBrains Mono", "jetbrains-mono-latin-500-normal.woff2", "500"],
  ["JetBrains Mono", "jetbrains-mono-latin-700-normal.woff2", "700"],
];

let fontsPromise: Promise<void> | null = null;

export const loadFonts = (): Promise<void> => {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      FACES.map(async ([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, {
          weight,
          style: "normal",
        });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => undefined);
  }
  return fontsPromise;
};

export const INTER = "Inter, sans-serif";
export const MONO = "'JetBrains Mono', monospace";
