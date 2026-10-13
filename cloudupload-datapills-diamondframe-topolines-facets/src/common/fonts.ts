import { staticFile } from "remotion";

export const MONO = "JetBrains Mono";

let fontPromise: Promise<void> | null = null;

/** Loads JetBrains Mono (OFL, public/fonts) once per page. */
export const loadMonoFont = () => {
  if (!fontPromise) {
    const face = new FontFace(
      MONO,
      `url(${staticFile("fonts/JetBrainsMono-Medium.woff2")}) format("woff2")`,
      { weight: "500" },
    );
    fontPromise = face.load().then((f) => {
      (document.fonts as unknown as { add: (f: FontFace) => void }).add(f);
    });
  }
  return fontPromise;
};
