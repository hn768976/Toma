import { staticFile } from "remotion";

// Inter (SIL OFL 1.1), shipped in public/fonts with its licence text.
let loading: Promise<void> | null = null;

export const loadFonts = (): Promise<void> => {
  if (!loading) {
    const faces = [
      new FontFace("Inter", `url(${staticFile("fonts/Inter-Regular.woff2")}) format("woff2")`, { weight: "400" }),
      new FontFace("Inter", `url(${staticFile("fonts/Inter-SemiBold.woff2")}) format("woff2")`, { weight: "600" }),
    ];
    loading = Promise.all(faces.map((f) => f.load())).then((loaded) => {
      loaded.forEach((f) => (document.fonts as unknown as Set<FontFace>).add(f));
    });
  }
  return loading;
};
