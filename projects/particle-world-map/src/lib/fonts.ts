import { staticFile } from "remotion";

// Inter (SIL OFL 1.1) is bundled in public/fonts so canvas text renders
// identically on every machine without network access.
const FACES: Array<[string, string]> = [
  ["400", "fonts/inter-latin-400-normal.woff2"],
  ["500", "fonts/inter-latin-500-normal.woff2"],
  ["600", "fonts/inter-latin-600-normal.woff2"],
];

let loading: Promise<void> | null = null;

export const FONT_FAMILY = "InterBundled";

export const loadFonts = () => {
  if (!loading) {
    loading = Promise.all(
      FACES.map(async ([weight, file]) => {
        const face = new FontFace(FONT_FAMILY, `url(${staticFile(file)})`, {
          weight,
        });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => undefined);
  }
  return loading;
};
