import { continueRender, delayRender, staticFile } from "remotion";

export const FONT_HEAD = "TrackHead";
export const FONT_MONO = "TrackMono";

let loading: Promise<void> | null = null;

// Loads the bundled OFL fonts once per page, before anything is drawn.
export const loadTrackFonts = (): Promise<void> => {
  if (loading) return loading;
  const handle = delayRender("Loading HUD fonts");
  const faces = [
    new FontFace(
      FONT_HEAD,
      `url(${staticFile("fonts/rajdhani-latin-600-normal.woff2")})`,
      { weight: "600" },
    ),
    new FontFace(
      FONT_HEAD,
      `url(${staticFile("fonts/rajdhani-latin-700-normal.woff2")})`,
      { weight: "700" },
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
