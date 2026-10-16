import React, { useLayoutEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Fonts (OFL) and the Natural Earth land data are loaded once per page.
// The gate below holds the first frame with delayRender until they are ready,
// so canvas textures are always drawn with the real fonts.

export const MONO = "JetBrains Mono";
export const SANS = "Inter";

const FONT_FILES: [string, string, string][] = [
  [MONO, "fonts/JetBrainsMono-Regular.ttf", "400"],
  [MONO, "fonts/JetBrainsMono-Bold.ttf", "700"],
  [SANS, "fonts/Inter-Regular.ttf", "400"],
  [SANS, "fonts/Inter-SemiBold.ttf", "600"],
];

let fontsPromise: Promise<void> | null = null;
const loadFonts = () => {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      FONT_FILES.map(async ([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(file)})`, { weight });
        await face.load();
        (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
      }),
    ).then(() => undefined);
  }
  return fontsPromise;
};

export type LandPolygons = number[][][][]; // polygon -> ring -> [lon,lat]
let land: LandPolygons | null = null;
let landPromise: Promise<void> | null = null;
const loadLand = () => {
  if (!landPromise) {
    landPromise = fetch(staticFile("data/ne_110m_land.geojson"))
      .then((r) => r.json())
      .then((gj: { features: { geometry: { type: string; coordinates: unknown } }[] }) => {
        const out: LandPolygons = [];
        for (const f of gj.features) {
          const g = f.geometry;
          if (g.type === "Polygon") out.push(g.coordinates as number[][][]);
          else out.push(...(g.coordinates as number[][][][]));
        }
        land = out;
      });
  }
  return landPromise;
};
export const getLand = () => {
  if (!land) throw new Error("Land data not loaded");
  return land;
};

/** Renders children only once fonts (and optionally land data) are loaded. */
export const AssetGate: React.FC<{ needLand?: boolean; children: React.ReactNode }> = ({
  needLand,
  children,
}) => {
  // Loading gate only: flips once from false to true before any frame is captured;
  // it never drives visuals.
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading fonts and data"));
  useLayoutEffect(() => {
    Promise.all([loadFonts(), needLand ? loadLand() : Promise.resolve()])
      .then(() => setReady(true))
      .catch((e) => {
        console.error(e);
      });
  }, [needLand]);
  // Released only after the children have rendered (and registered their own
  // delayRender handles), so no frame is captured before the scene exists.
  useLayoutEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle]);
  return ready ? <>{children}</> : null;
};
