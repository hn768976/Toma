// Shared asset loaders (fonts, Natural Earth land, studio HDRI).
// Each loader is memoised per browser tab; components gate on them with
// delayRender / continueRender so no frame is captured before they are ready.
import { staticFile } from "remotion";
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

let fontsPromise: Promise<void> | null = null;
export const loadFonts = () => {
  if (!fontsPromise) {
    const faces = [
      new FontFace("Inter", `url(${staticFile("fonts/Inter-Regular.woff2")}) format("woff2")`, { weight: "400" }),
      new FontFace("Inter", `url(${staticFile("fonts/Inter-SemiBold.woff2")}) format("woff2")`, { weight: "600" }),
      new FontFace("JetBrains Mono", `url(${staticFile("fonts/JetBrainsMono-Regular.woff2")}) format("woff2")`, { weight: "400" }),
      new FontFace("JetBrains Mono", `url(${staticFile("fonts/JetBrainsMono-Medium.woff2")}) format("woff2")`, { weight: "500" }),
    ];
    fontsPromise = Promise.all(faces.map((f) => f.load())).then((loaded) => {
      loaded.forEach((f) => (document.fonts as unknown as Set<FontFace>).add(f));
    });
  }
  return fontsPromise;
};

type Ring = number[][];
type Polygon = Ring[];
let landPromise: Promise<Polygon[]> | null = null;
// Natural Earth 1:50m land polygons (public domain), shipped in public/data.
export const loadLand = () => {
  if (!landPromise) {
    landPromise = fetch(staticFile("data/ne_50m_land.geojson"))
      .then((r) => r.json())
      .then((geo: { features: { geometry: { type: string; coordinates: unknown } }[] }) => {
        const polys: Polygon[] = [];
        for (const f of geo.features) {
          if (f.geometry.type === "Polygon") polys.push(f.geometry.coordinates as Polygon);
          else if (f.geometry.type === "MultiPolygon") polys.push(...(f.geometry.coordinates as Polygon[]));
        }
        return polys;
      });
  }
  return landPromise;
};

// Rasterise land into an equirectangular canvas (lon -180..180, lat 90..-90),
// optionally cropped to a lon/lat window. White land on transparent.
export const drawLand = (
  polys: Polygon[],
  w: number,
  h: number,
  window: { lon0: number; lon1: number; lat0: number; lat1: number } = { lon0: -180, lon1: 180, lat0: 90, lat1: -90 },
  fill = "#ffffff",
) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = fill;
  const sx = w / (window.lon1 - window.lon0);
  const sy = h / (window.lat1 - window.lat0);
  ctx.beginPath();
  for (const poly of polys) {
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => {
        const x = (lon - window.lon0) * sx;
        const y = (lat - window.lat0) * sy;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
  }
  ctx.fill("evenodd");
  return c;
};

let hdrPromise: Promise<THREE.DataTexture> | null = null;
// Poly Haven "Studio Small 03" (CC0), shipped in public/hdri.
export const loadStudioHDR = () => {
  if (!hdrPromise) {
    hdrPromise = new HDRLoader().loadAsync(staticFile("hdri/studio_small_03_1k.hdr")).then((t) => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      return t;
    });
  }
  return hdrPromise;
};
