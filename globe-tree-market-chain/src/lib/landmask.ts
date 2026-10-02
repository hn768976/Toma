import { staticFile } from "remotion";

export type Land = { polygons: [number, number][][][] };

let landPromise: Promise<Land> | null = null;
// Natural Earth 1:50m land (public domain), shipped in public/data.
export const loadLand = () => {
  if (!landPromise) {
    landPromise = fetch(staticFile("data/ne_50m_land.json")).then((r) => r.json() as Promise<Land>);
  }
  return landPromise;
};

// Rasterise the land polygons into an equirectangular mask (deterministic
// canvas fill) and return a lookup lon/lat -> 0/1.
export const landMask = (land: Land, w = 2048, h = 1024) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  for (const poly of land.polygons) {
    ctx.beginPath();
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * w;
        const y = ((90 - lat) / 180) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
    ctx.fill("evenodd");
  }
  const data = ctx.getImageData(0, 0, w, h).data;
  return (lon: number, lat: number) => {
    const x = Math.min(w - 1, Math.max(0, Math.floor(((lon + 180) / 360) * w)));
    const y = Math.min(h - 1, Math.max(0, Math.floor(((90 - lat) / 180) * h)));
    return data[(y * w + x) * 4] > 127 ? 1 : 0;
  };
};
