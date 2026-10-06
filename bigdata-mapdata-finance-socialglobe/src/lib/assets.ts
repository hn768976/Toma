import { useState, useEffect } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Shipped assets: OFL fonts and Natural Earth land (public domain).
// Everything is loaded once per tab behind delayRender / continueRender.

const FONTS: [string, string, string][] = [
  ["Inter", "fonts/inter-latin-400-normal.woff2", "400"],
  ["Inter", "fonts/inter-latin-500-normal.woff2", "500"],
  ["Inter", "fonts/inter-latin-600-normal.woff2", "600"],
  ["Inter", "fonts/inter-latin-700-normal.woff2", "700"],
  ["JetBrains Mono", "fonts/jetbrains-mono-latin-400-normal.woff2", "400"],
  ["JetBrains Mono", "fonts/jetbrains-mono-latin-500-normal.woff2", "500"],
  ["JetBrains Mono", "fonts/jetbrains-mono-latin-700-normal.woff2", "700"],
];

export const MONO = '"JetBrains Mono"';
export const SANS = '"Inter"';

export type Land = { polygons: number[][][] };

export type Assets = { land: Land };

let assetsPromise: Promise<Assets> | null = null;

const loadAll = async (): Promise<Assets> => {
  await Promise.all(
    FONTS.map(async ([family, file, weight]) => {
      const face = new FontFace(family, `url(${staticFile(file)}) format("woff2")`, {
        weight,
        style: "normal",
      });
      await face.load();
      (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
    }),
  );
  // Make sure canvas 2D sees the faces (some engines resolve lazily).
  await Promise.all(
    FONTS.map(([family, , weight]) => document.fonts.load(`${weight} 32px "${family}"`)),
  );
  const res = await fetch(staticFile("data/ne_50m_land.json"));
  const land = (await res.json()) as Land;
  return { land };
};

export const getAssets = () => {
  if (!assetsPromise) assetsPromise = loadAll();
  return assetsPromise;
};

export const useAssets = () => {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [handle] = useState(() => delayRender("Loading fonts and Natural Earth data"));
  useEffect(() => {
    let alive = true;
    getAssets()
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
};

// ---------------------------------------------------------------------------
// Land helpers

/** Trace all land polygons into a 2D path using a lon/lat -> x/y projection. */
export const traceLand = (
  ctx: CanvasRenderingContext2D,
  land: Land,
  project: (lon: number, lat: number) => [number, number],
) => {
  ctx.beginPath();
  for (const poly of land.polygons) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length; i += 2) {
        const [x, y] = project(ring[i], ring[i + 1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
  }
};

const maskCache = new Map<string, LandMask>();

export type LandMask = {
  w: number;
  h: number;
  data: Uint8ClampedArray;
  /** 0..1 coverage at lon/lat (equirectangular lookup, nearest texel). */
  at: (lon: number, lat: number) => number;
};

/** Equirectangular land mask, cached per size. */
export const landMask = (land: Land, w = 2048, h = 1024): LandMask => {
  const key = `${w}x${h}`;
  const hit = maskCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  traceLand(ctx, land, (lon, lat) => [((lon + 180) / 360) * w, ((90 - lat) / 180) * h]);
  ctx.fill("evenodd");
  const img = ctx.getImageData(0, 0, w, h).data;
  const data = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) data[i] = img[i * 4];
  const mask: LandMask = {
    w,
    h,
    data,
    at: (lon, lat) => {
      let x = Math.floor(((lon + 180) / 360) * w);
      x = ((x % w) + w) % w;
      const y = Math.min(h - 1, Math.max(0, Math.floor(((90 - lat) / 180) * h)));
      return data[y * w + x] / 255;
    },
  };
  maskCache.set(key, mask);
  return mask;
};
