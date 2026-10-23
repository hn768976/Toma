import { staticFile } from "remotion";

// Noto Music (SIL OFL) is bundled in public/fonts so renders never depend on
// system fonts or network access.
export const MUSIC_FONT = "NotoMusicBundled";

let fontPromise: Promise<void> | null = null;

export const loadMusicFont = (): Promise<void> => {
  if (!fontPromise) {
    const face = new FontFace(
      MUSIC_FONT,
      `url(${staticFile("fonts/NotoMusic-Regular.ttf")})`,
    );
    fontPromise = face.load().then((loaded) => {
      document.fonts.add(loaded);
    });
  }
  return fontPromise;
};

export const GLYPH = {
  trebleClef: "\u{1D11E}",
  bassClef: "\u{1D122}",
  flat: "♭",
  sharp: "♯",
  natural: "♮",
  quarterRest: "\u{1D13D}",
  eighthRest: "\u{1D13E}",
  fermata: "\u{1D110}",
} as const;
