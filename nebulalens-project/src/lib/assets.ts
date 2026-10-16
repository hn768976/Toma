// Fonts and data that must be ready before frame 0 is drawn. Each loader runs
// once per page; components wait for it with delayRender / continueRender.
import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

let fontsPromise: Promise<void> | null = null;
export const loadFonts = () => {
  if (!fontsPromise) {
    const faces = [
      new FontFace("Inter", `url(${staticFile("fonts/Inter-Medium.woff2")})`, { weight: "500" }),
      new FontFace("Inter", `url(${staticFile("fonts/Inter-SemiBold.woff2")})`, { weight: "600" }),
      new FontFace("JetBrains Mono", `url(${staticFile("fonts/JetBrainsMono-Medium.woff2")})`, { weight: "500" }),
    ];
    fontsPromise = Promise.all(faces.map((f) => f.load())).then((loaded) => {
      loaded.forEach((f) => (document.fonts as unknown as Set<FontFace>).add(f));
    });
  }
  return fontsPromise;
};

/**
 * Natural Earth 1:110m land (public domain), rasterised once into an
 * equirectangular land mask: mask[y * W + x] = 1 on land. 2 px per degree.
 */
export type LandMask = { w: number; h: number; data: Uint8Array; polygons: number[][][] };
let landPromise: Promise<LandMask> | null = null;
let landCache: LandMask | null = null;
/** The land mask, once loadLand() has resolved. */
export const landSync = (): LandMask => {
  if (!landCache) throw new Error("loadLand() has not resolved yet");
  return landCache;
};
export const loadLand = () => {
  if (!landPromise) {
    landPromise = fetch(staticFile("data/ne_110m_land.geojson"))
      .then((r) => r.json())
      .then((geo: { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] }) => {
        const polygons: number[][][] = [];
        for (const f of geo.features) {
          const g = f.geometry;
          if (g.type === "Polygon") polygons.push(...(g.coordinates as number[][][]));
          else if (g.type === "MultiPolygon") for (const poly of g.coordinates as number[][][][]) polygons.push(...poly);
        }
        const w = 720;
        const h = 360;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff";
        for (const ring of polygons) {
          ctx.beginPath();
          ring.forEach(([lon, lat], i) => {
            const x = ((lon + 180) / 360) * w;
            const y = ((90 - lat) / 180) * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fill("evenodd");
        }
        const img = ctx.getImageData(0, 0, w, h).data;
        const data = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) data[i] = img[i * 4 + 3] > 127 ? 1 : 0;
        landCache = { w, h, data, polygons };
        return landCache;
      });
  }
  return landPromise;
};

/**
 * Holds the render until every loader has resolved; returns true when ready.
 * The hold is released only after the "ready" render has committed, so the
 * children it mounts register their own delayRender first.
 */
export const useAssets = (loaders: (() => Promise<unknown>)[]) => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading fonts / data"));
  useEffect(() => {
    let alive = true;
    Promise.all(loaders.map((l) => l()))
      .then(() => alive && setReady(true))
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle]);
  return ready;
};
