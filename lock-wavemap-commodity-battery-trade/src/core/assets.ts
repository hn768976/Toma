import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Fonts (OFL) and Natural Earth land, loaded once per tab and gated behind
// delayRender so no frame is captured before text and coastlines can draw.

const FONTS: [family: string, file: string, weight: string, style: string][] = [
  ["Inter", "inter-latin-400-normal.woff2", "400", "normal"],
  ["Inter", "inter-latin-500-normal.woff2", "500", "normal"],
  ["Inter", "inter-latin-600-normal.woff2", "600", "normal"],
  ["Inter", "inter-latin-700-normal.woff2", "700", "normal"],
  ["Inter", "inter-latin-800-normal.woff2", "800", "normal"],
  ["Inter", "inter-latin-600-italic.woff2", "600", "italic"],
  ["Inter", "inter-latin-700-italic.woff2", "700", "italic"],
  ["Inter", "inter-latin-800-italic.woff2", "800", "italic"],
  ["JetBrains Mono", "jetbrains-mono-latin-400-normal.woff2", "400", "normal"],
  ["JetBrains Mono", "jetbrains-mono-latin-500-normal.woff2", "500", "normal"],
  ["JetBrains Mono", "jetbrains-mono-latin-700-normal.woff2", "700", "normal"],
];

/** Land polygons as rings of [lon, lat]. */
export type LandRings = [number, number][][];

type Topology = {
  transform: { scale: [number, number]; translate: [number, number] };
  arcs: [number, number][][];
  objects: { land: { geometries: { type: string; arcs: number[][][] | number[][] }[] } };
};

// Minimal TopoJSON decoder (delta-encoded, quantized arcs) for world-atlas.
const decodeTopo = (topo: Topology): LandRings => {
  const { scale, translate } = topo.transform;
  const arcs = topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as [number, number];
    });
  });
  const ringFrom = (idx: number[]) => {
    const out: [number, number][] = [];
    for (const i of idx) {
      const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      out.push(...(out.length ? a.slice(1) : a));
    }
    return out;
  };
  const rings: LandRings = [];
  for (const g of topo.objects.land.geometries) {
    const polys = (g.type === "Polygon" ? [g.arcs] : g.arcs) as number[][][];
    for (const poly of polys) for (const ring of poly) rings.push(ringFrom(ring));
  }
  return rings;
};

let loaded: Promise<LandRings> | null = null;
let land: LandRings | null = null;

const loadAll = () => {
  if (!loaded) {
    loaded = (async () => {
      await Promise.all(
        FONTS.map(async ([family, file, weight, style]) => {
          const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, {
            weight,
            style,
          });
          await face.load();
          (document.fonts as unknown as Set<FontFace>).add(face);
        }),
      );
      await document.fonts.ready;
      const res = await fetch(staticFile("data/land-50m.json"));
      land = decodeTopo((await res.json()) as Topology);
      return land;
    })();
  }
  return loaded;
};

export const getLand = (): LandRings => {
  if (!land) throw new Error("land not loaded");
  return land;
};

export const useAssets = (): boolean => {
  const [ready, setReady] = useState(land !== null);
  const [handle] = useState(() => (land ? null : delayRender("Loading fonts and Natural Earth land")));
  useEffect(() => {
    if (handle === null) return;
    loadAll().then(
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
