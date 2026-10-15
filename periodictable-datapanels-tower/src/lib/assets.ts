import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

// Fonts (OFL): Inter for tiles, JetBrains Mono for data numbers.
const FONTS: [string, string, string][] = [
  ["Inter", "400", "fonts/Inter-400.woff2"],
  ["Inter", "500", "fonts/Inter-500.woff2"],
  ["Inter", "600", "fonts/Inter-600.woff2"],
  ["Inter", "700", "fonts/Inter-700.woff2"],
  ["JetBrains Mono", "400", "fonts/JetBrainsMono-400.woff2"],
  ["JetBrains Mono", "500", "fonts/JetBrainsMono-500.woff2"],
];

let fontsPromise: Promise<void> | null = null;
export const loadFonts = () => {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      FONTS.map(async ([family, weight, file]) => {
        const face = new FontFace(family, `url(${staticFile(file)}) format("woff2")`, { weight });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => undefined);
  }
  return fontsPromise;
};

export type LandPolygons = [number, number][][]; // rings of [lon, lat]
let landPromise: Promise<LandPolygons> | null = null;
export const loadLand = () => {
  if (!landPromise) {
    landPromise = fetch(staticFile("geo/ne_110m_land.geojson"))
      .then((r) => r.json())
      .then((g: { features: { geometry: { type: string; coordinates: unknown } }[] }) => {
        const rings: LandPolygons = [];
        for (const f of g.features) {
          const polys =
            f.geometry.type === "Polygon"
              ? [f.geometry.coordinates as [number, number][][]]
              : (f.geometry.coordinates as [number, number][][][]);
          for (const p of polys) rings.push(p[0]);
        }
        return rings;
      });
  }
  return landPromise;
};

export type Assets = { land: LandPolygons | null };

// Blocks the render (delayRender) until fonts (and optionally the map) are in.
export const useAssets = (needLand: boolean): Assets | null => {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [handle] = useState(() => delayRender("Loading fonts / map data"));
  useEffect(() => {
    let alive = true;
    Promise.all([loadFonts(), needLand ? loadLand() : Promise.resolve(null)])
      .then(([, land]) => {
        if (!alive) return;
        setAssets({ land });
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
    return () => {
      alive = false;
    };
  }, [handle, needLand]);
  return assets;
};
