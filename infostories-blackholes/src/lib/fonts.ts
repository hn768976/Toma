import { continueRender, delayRender, staticFile } from "remotion";

/** OFL fonts shipped in public/fonts (see the *-OFL.txt licence files). */
const FONTS = [
  { family: "Inter", weight: "300", file: "inter-latin-300-normal.woff2" },
  { family: "Inter", weight: "400", file: "inter-latin-400-normal.woff2" },
  { family: "Montserrat", weight: "800", file: "montserrat-latin-800-normal.woff2" },
];

let promise: Promise<void> | null = null;

export const loadFonts = (): Promise<void> => {
  if (!promise) {
    promise = Promise.all(
      FONTS.map(async (f) => {
        const face = new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)}) format('woff2')`, {
          weight: f.weight,
          style: "normal",
        });
        const loaded = await face.load();
        (document.fonts as unknown as { add: (f: FontFace) => void }).add(loaded);
      }),
    )
      .then(() => document.fonts.ready)
      .then(() => undefined);
  }
  return promise;
};

/** Block rendering until fonts are ready; resolves a promise for the GL stage. */
export const waitForFonts = (label: string) => {
  const handle = delayRender(`Loading fonts (${label})`);
  return loadFonts().then(() => continueRender(handle));
};
