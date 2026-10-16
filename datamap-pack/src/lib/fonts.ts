import { staticFile } from "remotion";

// OFL fonts only: Inter (numbers) and JetBrains Mono (HUD codes).
export const INTER = "Inter";
export const MONO = "JetBrains Mono";

const FACES: [string, string, string][] = [
  [INTER, "inter-latin-300-normal.woff2", "300"],
  [INTER, "inter-latin-400-normal.woff2", "400"],
  [INTER, "inter-latin-500-normal.woff2", "500"],
  [INTER, "inter-latin-600-normal.woff2", "600"],
  [MONO, "jetbrains-mono-latin-400-normal.woff2", "400"],
  [MONO, "jetbrains-mono-latin-500-normal.woff2", "500"],
];

let promise: Promise<void> | null = null;

// Loaded once per page; the GL stage holds a delayRender until it resolves.
export const loadFonts = (): Promise<void> => {
  if (promise) return promise;
  promise = Promise.all(
    FACES.map(async ([family, file, weight]) => {
      const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)})`, {
        weight,
      });
      await face.load();
      document.fonts.add(face);
    }),
  ).then(() => undefined);
  return promise;
};
