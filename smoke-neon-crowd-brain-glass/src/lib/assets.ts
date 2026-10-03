import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

/** Fonts shipped in public/fonts (SIL OFL). */
const FONTS: { family: string; file: string; weight: string }[] = [
  { family: "Inter", file: "fonts/inter-latin-400-normal.woff2", weight: "400" },
  { family: "Inter", file: "fonts/inter-latin-600-normal.woff2", weight: "600" },
  { family: "Montserrat", file: "fonts/montserrat-latin-600-normal.woff2", weight: "600" },
  { family: "Montserrat", file: "fonts/montserrat-latin-700-normal.woff2", weight: "700" },
];

let fontsPromise: Promise<void> | null = null;
export const loadFonts = () => {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      FONTS.map(async (f) => {
        const face = new FontFace(f.family, `url(${staticFile(f.file)})`, { weight: f.weight });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => undefined);
  }
  return fontsPromise;
};

/** Studio HDRI (Poly Haven "Studio Small 03", CC0) — public/hdri. */
export const HDRI_FILE = "hdri/studio_small_03_1k.hdr";

let hdrPromise: Promise<THREE.DataTexture> | null = null;
export const loadHDR = () => {
  if (!hdrPromise) {
    hdrPromise = new RGBELoader()
      .setDataType(THREE.HalfFloatType)
      .loadAsync(staticFile(HDRI_FILE))
      .then((t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        return t;
      });
  }
  return hdrPromise;
};

export type Assets = { hdr: THREE.DataTexture | null };

/** Loads fonts (+ HDRI if asked) behind delayRender/continueRender. */
export const useAssets = (needHDR: boolean): Assets | null => {
  const [handle] = useState(() => delayRender("Loading fonts / HDRI"));
  const [assets, setAssets] = useState<Assets | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([loadFonts(), needHDR ? loadHDR() : Promise.resolve(null)])
      .then(([, hdr]) => {
        if (!alive) return;
        setAssets({ hdr });
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        throw e;
      });
    return () => {
      alive = false;
    };
  }, [handle, needHDR]);
  return assets;
};
