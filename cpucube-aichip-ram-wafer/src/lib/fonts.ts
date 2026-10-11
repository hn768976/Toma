import { staticFile } from "remotion";

// OFL fonts shipped in public/fonts (licences alongside). Loaded once.
let fontPromise: Promise<void> | null = null;
export const loadFonts = () => {
  if (!fontPromise) {
    const faces = [
      new FontFace("Blinker", `url(${staticFile("fonts/Blinker-ExtraBold.woff2")})`, { weight: "800" }),
      new FontFace("JetBrains Mono", `url(${staticFile("fonts/JetBrainsMono-Regular.woff2")})`, { weight: "400" }),
    ];
    fontPromise = Promise.all(faces.map((f) => f.load())).then((loaded) => {
      loaded.forEach((f) => (document.fonts as unknown as Set<FontFace>).add(f));
    });
  }
  return fontPromise;
};
