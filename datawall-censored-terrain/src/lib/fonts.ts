import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// OFL fonts bundled in public/fonts. Families are referenced by these names in Canvas 2D.
export const MONO_FAMILY = "TermMono";
export const STAMP_FAMILY = "StampBold";

const FONTS: { family: string; file: string; weight: string }[] = [
  { family: MONO_FAMILY, file: "fonts/IBMPlexMono-SemiBold.woff2", weight: "600" },
  { family: STAMP_FAMILY, file: "fonts/Oswald-Bold.woff2", weight: "700" },
];

let loading: Promise<void> | null = null;

export const loadFonts = (): Promise<void> => {
  if (!loading) {
    loading = Promise.all(
      FONTS.map(async ({ family, file, weight }) => {
        const face = new FontFace(family, `url(${staticFile(file)}) format("woff2")`, { weight });
        await face.load();
        document.fonts.add(face);
      }),
    )
      .then(() => document.fonts.ready)
      .then(() => {
        for (const f of FONTS) {
          if (!document.fonts.check(`${f.weight} 64px ${f.family}`)) {
            throw new Error(`Font ${f.family} failed to load`);
          }
        }
      });
  }
  return loading;
};

// Holds the render (delayRender) until both fonts are usable, so no frame is drawn in a fallback.
export const useFontsReady = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadFonts().then(
      () => {
        setReady(true);
        continueRender(handle);
      },
      (err) => {
        throw err;
      },
    );
  }, [handle]);
  return ready;
};
