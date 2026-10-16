import { staticFile } from "remotion";

let fontPromise: Promise<void> | null = null;

/** Loads JetBrains Mono (OFL) once, for digits drawn into canvas textures. */
export const loadMonoFont = () => {
  if (!fontPromise) {
    const face = new FontFace(
      "JetBrains Mono",
      `url(${staticFile("fonts/JetBrainsMono-Medium.woff2")}) format("woff2")`,
      { weight: "500" },
    );
    fontPromise = face.load().then((f) => {
      (document.fonts as unknown as { add: (f: FontFace) => void }).add(f);
    });
  }
  return fontPromise;
};

export const MONO = '500 {SIZE}px "JetBrains Mono", monospace';
export const monoFont = (px: number) => MONO.replace("{SIZE}", String(Math.round(px)));
