import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Fonts (OFL) shipped in public/fonts. Family names used by every canvas draw.
export const FONT_MONO = "JBMono";
export const FONT_INTER = "InterShip";

const FONTS: Array<[string, string, FontFaceDescriptors]> = [
  [FONT_INTER, "fonts/inter/Inter-BlackItalic.ttf", { weight: "900", style: "italic" }],
  [FONT_INTER, "fonts/inter/Inter-BoldItalic.ttf", { weight: "700", style: "italic" }],
  [FONT_INTER, "fonts/inter/Inter-Bold.ttf", { weight: "700", style: "normal" }],
  [FONT_INTER, "fonts/inter/Inter-SemiBold.ttf", { weight: "600", style: "normal" }],
  [FONT_MONO, "fonts/jetbrains-mono/JetBrainsMono-Medium.ttf", { weight: "500", style: "normal" }],
  [FONT_MONO, "fonts/jetbrains-mono/JetBrainsMono-Bold.ttf", { weight: "700", style: "normal" }],
];

export type LandPolygons = number[][][][]; // polygon -> ring -> [lon, lat]

export type Assets = { land: LandPolygons };

let assetPromise: Promise<Assets> | null = null;

async function loadAll(): Promise<Assets> {
  await Promise.all(
    FONTS.map(async ([family, path, desc]) => {
      const face = new FontFace(family, `url(${staticFile(path)})`, desc);
      await face.load();
      (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
    }),
  );
  const res = await fetch(staticFile("data/natural-earth/ne_110m_land.geojson"));
  const geo = await res.json();
  const land: LandPolygons = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (g.type === "Polygon") land.push(g.coordinates);
    else if (g.type === "MultiPolygon") for (const p of g.coordinates) land.push(p);
  }
  return { land };
}

export function loadAssets() {
  if (!assetPromise) assetPromise = loadAll();
  return assetPromise;
}

/** Returns null until fonts + map data are loaded; holds the render meanwhile. */
export function useAssets(): Assets | null {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [handle] = useState(() => delayRender("Loading fonts and Natural Earth data"));
  useEffect(() => {
    let alive = true;
    loadAssets()
      .then((a) => {
        if (alive) setAssets(a);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        throw e;
      });
    return () => {
      alive = false;
    };
  }, [handle]);
  return assets;
}
