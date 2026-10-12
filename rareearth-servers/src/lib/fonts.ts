import { staticFile } from "remotion";

// Inter (SIL OFL 1.1) — files and licence in public/fonts.
const FACES: [string, string][] = [
  ["400", "fonts/inter-latin-400-normal.woff2"],
  ["600", "fonts/inter-latin-600-normal.woff2"],
  ["700", "fonts/inter-latin-700-normal.woff2"],
];

let promise: Promise<void> | null = null;

export function loadFonts(): Promise<void> {
  if (!promise) {
    promise = Promise.all(
      FACES.map(async ([weight, file]) => {
        const face = new FontFace("Inter", `url(${staticFile(file)}) format("woff2")`, {
          weight,
          style: "normal",
        });
        await face.load();
        (document.fonts as unknown as Set<FontFace>).add(face);
      }),
    ).then(() => undefined);
  }
  return promise;
}
