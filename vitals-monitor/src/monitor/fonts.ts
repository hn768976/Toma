import { continueRender, delayRender, staticFile } from "remotion";
import { FONT_MONO, FONT_NUM } from "./drawScreen";

let loading: Promise<void> | null = null;

// Loads the bundled OFL fonts once per page; canvas text is only drawn after this.
export const loadMonitorFonts = (): Promise<void> => {
  if (loading) return loading;
  const handle = delayRender("Loading monitor fonts");
  const faces = [
    new FontFace(
      FONT_NUM,
      `url(${staticFile("fonts/barlow-condensed-latin-500-normal.woff2")})`,
      { weight: "500" },
    ),
    new FontFace(
      FONT_NUM,
      `url(${staticFile("fonts/barlow-condensed-latin-600-normal.woff2")})`,
      { weight: "600" },
    ),
    new FontFace(
      FONT_MONO,
      `url(${staticFile("fonts/share-tech-mono-latin-400-normal.woff2")})`,
    ),
  ];
  loading = Promise.all(faces.map((f) => f.load())).then((loaded) => {
    loaded.forEach((f) => document.fonts.add(f));
    continueRender(handle);
  });
  return loading;
};
