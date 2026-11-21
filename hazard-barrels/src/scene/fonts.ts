import { staticFile } from "remotion";

export const MARKING_FONT = "Montserrat";

let pending: Promise<void> | null = null;

/** Loads the marking font once. Rendering is held (AssetGate) until it resolves. */
export const loadFonts = (): Promise<void> => {
  if (!pending) {
    pending = (async () => {
      const face = new FontFace(
        MARKING_FONT,
        `url(${staticFile("fonts/Montserrat-ExtraBold.woff2")}) format("woff2")`,
        { weight: "800" },
      );
      await face.load();
      document.fonts.add(face);
      await document.fonts.ready;
    })();
  }
  return pending;
};
