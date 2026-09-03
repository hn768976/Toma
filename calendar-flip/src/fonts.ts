import {staticFile} from "remotion";
import {FONT_FAMILY} from "./theme";

/**
 * Inter is bundled with the project (public/fonts) rather than pulled from a
 * CDN, so a 4K render on a clean machine is byte-identical and works offline.
 * One variable file covers every weight we use.
 */
let loading: Promise<void> | null = null;

export const ensureFonts = (): Promise<void> => {
  if (loading) {
    return loading;
  }

  loading = (async () => {
    const face = new FontFace(
      FONT_FAMILY,
      `url(${staticFile("fonts/Inter-latin-variable.woff2")}) format("woff2")`,
      {weight: "100 900", style: "normal"},
    );
    await face.load();
    document.fonts.add(face);
    // Canvas text only picks up a face once the specific weight is resolved.
    await Promise.all([
      document.fonts.load(`800 100px ${FONT_FAMILY}`),
      document.fonts.load(`700 100px ${FONT_FAMILY}`),
      document.fonts.load(`500 100px ${FONT_FAMILY}`),
    ]);
  })();

  return loading;
};
