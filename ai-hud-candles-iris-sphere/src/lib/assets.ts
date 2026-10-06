import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

const FONTS: { family: string; weight: string; file: string }[] = [
  { family: "Inter", weight: "400", file: "fonts/Inter/inter-latin-400-normal.woff2" },
  { family: "Inter", weight: "500", file: "fonts/Inter/inter-latin-500-normal.woff2" },
  { family: "Inter", weight: "600", file: "fonts/Inter/inter-latin-600-normal.woff2" },
  { family: "Inter", weight: "700", file: "fonts/Inter/inter-latin-700-normal.woff2" },
  { family: "JetBrains Mono", weight: "400", file: "fonts/JetBrainsMono/jetbrains-mono-latin-400-normal.woff2" },
  { family: "JetBrains Mono", weight: "500", file: "fonts/JetBrainsMono/jetbrains-mono-latin-500-normal.woff2" },
  { family: "JetBrains Mono", weight: "700", file: "fonts/JetBrainsMono/jetbrains-mono-latin-700-normal.woff2" },
  { family: "Rajdhani", weight: "500", file: "fonts/Rajdhani/rajdhani-latin-500-normal.woff2" },
  { family: "Rajdhani", weight: "600", file: "fonts/Rajdhani/rajdhani-latin-600-normal.woff2" },
  { family: "Rajdhani", weight: "700", file: "fonts/Rajdhani/rajdhani-latin-700-normal.woff2" },
];

let fontsPromise: Promise<void> | null = null;
export const loadFonts = () => {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      FONTS.map(async (f) => {
        const face = new FontFace(f.family, `url(${staticFile(f.file)})`, { weight: f.weight });
        await face.load();
        (document.fonts as unknown as Set<FontFace>).add(face);
      }),
    ).then(() => undefined);
  }
  return fontsPromise;
};

export type Land = FeatureCollection<Polygon | MultiPolygon>;
let landPromise: Promise<Land> | null = null;
export const loadLand = () => {
  if (!landPromise) {
    landPromise = fetch(staticFile("data/natural-earth/land-50m.json"))
      .then((r) => r.json())
      .then((topo: Topology) => {
        const obj = topo.objects.land as GeometryCollection;
        const f = feature(topo, obj) as unknown;
        const fc = f as Land;
        return fc.type === "FeatureCollection"
          ? fc
          : ({ type: "FeatureCollection", features: [f] } as unknown as Land);
      });
  }
  return landPromise;
};

export type Assets = { land: Land | null };

// Holds the render until fonts (and map data, when asked for) are in.
// The handle is released in an effect *after* children mount, so the
// <ThreeCanvas/> registers its own delayRender before this one is cleared.
export const useAssets = (needLand: boolean): Assets | null => {
  const [handle] = useState(() => delayRender("Loading fonts and map data"));
  const [assets, setAssets] = useState<Assets | null>(null);
  useEffect(() => {
    Promise.all([loadFonts(), needLand ? loadLand() : Promise.resolve(null)])
      .then(([, land]) => setAssets({ land }))
      .catch((e) => cancelRender(e));
  }, [needLand]);
  useEffect(() => {
    if (assets) continueRender(handle);
  }, [assets, handle]);
  return assets;
};

// Rasterise Natural Earth land (equirectangular) into a mask for dot sampling.
export const landMask = (land: Land, w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  const px = (lon: number) => ((lon + 180) / 360) * w;
  const py = (lat: number) => ((90 - lat) / 180) * h;
  for (const f of land.features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      // Rings that cross the antimeridian are unwrapped to continuous
      // longitudes, then drawn at -360/0/+360 so the canvas clips them.
      const unwrapped = poly.map((ring) => {
        const out: [number, number][] = [];
        let prev = ring[0][0];
        let off = 0;
        for (const [lon, lat] of ring) {
          if (lon - prev > 180) off -= 360;
          else if (lon - prev < -180) off += 360;
          prev = lon;
          out.push([lon + off, lat]);
        }
        return out;
      });
      for (const shift of [-360, 0, 360]) {
        ctx.beginPath();
        for (const ring of unwrapped) {
          ring.forEach(([lon, lat], i) =>
            i === 0 ? ctx.moveTo(px(lon + shift), py(lat)) : ctx.lineTo(px(lon + shift), py(lat)),
          );
          ctx.closePath();
        }
        ctx.fill("evenodd");
      }
    }
  }
  const data = ctx.getImageData(0, 0, w, h).data;
  return (u: number, v: number) => {
    const x = Math.min(w - 1, Math.max(0, Math.floor(u * w)));
    const y = Math.min(h - 1, Math.max(0, Math.floor(v * h)));
    return data[(y * w + x) * 4] > 127;
  };
};
