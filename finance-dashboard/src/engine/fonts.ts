import { staticFile } from "remotion";

export type FontSpec = { family: string; file: string; weight: string };

let loaded: Promise<void> | null = null;

/**
 * Loads the bundled .woff2 files (public/fonts) through the FontFace API so
 * they are available to Canvas 2D text drawing. No network access needed.
 */
export const loadFonts = (fonts: FontSpec[]): Promise<void> => {
  if (loaded) return loaded;
  loaded = Promise.all(
    fonts.map(async (f) => {
      const face = new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)})`, {
        weight: f.weight,
      });
      await face.load();
      document.fonts.add(face);
    }),
  ).then(() => undefined);
  return loaded;
};
