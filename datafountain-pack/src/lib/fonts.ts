import { staticFile } from "remotion";

/** OFL fonts, self-hosted in public/fonts (licences alongside). */
export const MONO = "JetBrains Mono";
export const SANS = "Inter";

const FACES: [string, string, string][] = [
  [MONO, "fonts/jetbrains-mono-latin-400-normal.woff2", "400"],
  [MONO, "fonts/jetbrains-mono-latin-700-normal.woff2", "700"],
  [SANS, "fonts/inter-latin-400-normal.woff2", "400"],
  [SANS, "fonts/inter-latin-600-normal.woff2", "600"],
];

let fontsPromise: Promise<void> | null = null;

/** Loads every face once per tab. Canvas textures are drawn only after this. */
export const fontsReady = (): Promise<void> => {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      FACES.map(async ([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(file)}) format("woff2")`, { weight, style: "normal" });
        const loaded = await face.load();
        document.fonts.add(loaded);
      }),
    ).then(() => undefined);
  }
  return fontsPromise;
};
