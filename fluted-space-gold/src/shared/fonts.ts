import { continueRender, delayRender, staticFile } from "remotion";

/** Inter (SIL OFL 1.1), shipped in public/fonts. Rendering waits for it. */
export const INTER = "Inter";

let loaded: Promise<void> | null = null;

export const loadInter = (): Promise<void> => {
  if (loaded) return loaded;
  if (typeof document === "undefined") return Promise.resolve();
  const handle = delayRender("Loading Inter");
  const faces = [300, 400, 500].map(
    (w) =>
      new FontFace(INTER, `url(${staticFile(`fonts/inter-latin-${w}-normal.woff2`)}) format('woff2')`, {
        weight: String(w),
        style: "normal",
      }),
  );
  loaded = Promise.all(faces.map((f) => f.load()))
    .then((fs) => {
      fs.forEach((f) => document.fonts.add(f));
      continueRender(handle);
    })
    .catch((err) => {
      // Fail loudly rather than silently render a fallback font.
      console.error(err);
      throw err;
    });
  return loaded;
};
