import opentype, { type Font } from "opentype.js";
import { staticFile } from "remotion";

/** Nunito Black (SIL Open Font License, see public/fonts/OFL.txt). */
export const FONT_FILE = "fonts/Nunito-Black.ttf";

let fontPromise: Promise<Font> | null = null;

/** Loaded once per page (each Remotion render tab loads it once). */
export function loadFont(): Promise<Font> {
  if (!fontPromise) {
    fontPromise = fetch(staticFile(FONT_FILE))
      .then((r) => {
        if (!r.ok) throw new Error(`Font fetch failed: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => opentype.parse(buf));
  }
  return fontPromise;
}
