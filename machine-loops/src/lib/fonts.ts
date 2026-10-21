// Inter (SIL OFL 1.1, bundled in public/fonts). Loaded once behind
// delayRender so no frame is captured with a fallback font.
import { continueRender, delayRender, staticFile } from "remotion";

export const INTER = "Inter";

let loaded: Promise<void> | null = null;

const faces: [string, string, string][] = [
  ["inter-latin-400-normal.woff2", "400", "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"],
  ["inter-latin-600-normal.woff2", "600", "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"],
  ["inter-latin-ext-400-normal.woff2", "400", "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF"],
  ["inter-latin-ext-600-normal.woff2", "600", "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF"],
];

export const loadInter = (): Promise<void> => {
  if (loaded) return loaded;
  const handle = delayRender("Loading Inter");
  loaded = Promise.all(
    faces.map(async ([file, weight, unicodeRange]) => {
      const face = new FontFace(INTER, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, {
        weight,
        unicodeRange,
      });
      await face.load();
      document.fonts.add(face);
    }),
  ).then(() => continueRender(handle));
  return loaded;
};
