import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Fonts and Natural Earth land data, loaded once per render tab behind
 * delayRender/continueRender. Everything derived from them is deterministic.
 */

export type Ring = [number, number][]; // [lon, lat] degrees

export interface Assets {
  rings: Ring[]; // outer + inner rings of all land polygons
  /** Equirectangular land mask, `maskW × maskH`, 1 byte per pixel (0/255). */
  mask: Uint8Array;
  maskW: number;
  maskH: number;
  /** Test lon/lat (degrees) against the land mask. */
  isLand: (lon: number, lat: number) => boolean;
}

export const FONT = {
  inter: "Inter Var",
  mono: "JetBrains Mono Var",
  card: "Kode Mono Var",
} as const;

const loadFonts = async () => {
  const faces = [
    new FontFace(FONT.inter, `url(${staticFile("fonts/Inter.ttf")})`, {
      weight: "100 900",
    }),
    new FontFace(FONT.mono, `url(${staticFile("fonts/JetBrainsMono.ttf")})`, {
      weight: "100 800",
    }),
    new FontFace(FONT.card, `url(${staticFile("fonts/KodeMono.ttf")})`, {
      weight: "400 700",
    }),
  ];
  await Promise.all(faces.map((f) => f.load()));
  faces.forEach((f) => (document.fonts as unknown as Set<FontFace>).add(f));
  // Make sure the Canvas 2D text path has the faces resolved at the weights we use.
  await Promise.all(
    [
      `400 32px "${FONT.inter}"`,
      `600 32px "${FONT.inter}"`,
      `700 32px "${FONT.inter}"`,
      `400 32px "${FONT.mono}"`,
      `600 32px "${FONT.mono}"`,
      `500 32px "${FONT.card}"`,
    ].map((f) => document.fonts.load(f)),
  );
};

const MASK_W = 2048;
const MASK_H = 1024;

const loadLand = async (): Promise<Omit<Assets, "isLand">> => {
  const res = await fetch(staticFile("data/ne_50m_land.geojson"));
  const gj = (await res.json()) as {
    features: { geometry: { type: string; coordinates: unknown } }[];
  };
  const rings: Ring[] = [];
  for (const f of gj.features) {
    const g = f.geometry;
    if (g.type === "Polygon") {
      for (const r of g.coordinates as Ring[]) rings.push(r);
    } else if (g.type === "MultiPolygon") {
      for (const p of g.coordinates as Ring[][]) for (const r of p) rings.push(r);
    }
  }
  const c = document.createElement("canvas");
  c.width = MASK_W;
  c.height = MASK_H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, MASK_W, MASK_H);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  for (const r of rings) {
    r.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * MASK_W;
      const y = ((90 - lat) / 180) * MASK_H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
  ctx.fill("evenodd");
  const img = ctx.getImageData(0, 0, MASK_W, MASK_H).data;
  const mask = new Uint8Array(MASK_W * MASK_H);
  for (let i = 0; i < mask.length; i++) mask[i] = img[i * 4] > 127 ? 255 : 0;
  return { rings, mask, maskW: MASK_W, maskH: MASK_H };
};

let assetsPromise: Promise<Assets> | null = null;

export const loadAssets = (): Promise<Assets> => {
  if (!assetsPromise) {
    assetsPromise = Promise.all([loadFonts(), loadLand()]).then(([, land]) => ({
      ...land,
      isLand: (lon: number, lat: number) => {
        let x = Math.floor(((lon + 180) / 360) * land.maskW);
        x = ((x % land.maskW) + land.maskW) % land.maskW;
        const y = Math.min(
          land.maskH - 1,
          Math.max(0, Math.floor(((90 - lat) / 180) * land.maskH)),
        );
        return land.mask[y * land.maskW + x] > 0;
      },
    }));
  }
  return assetsPromise;
};

/** Hook-free helper used by LookCanvas: holds a delayRender until assets resolve. */
export const waitForAssets = (label: string) => {
  const handle = delayRender(`Loading fonts + Natural Earth (${label})`);
  return loadAssets().then((a) => {
    continueRender(handle);
    return a;
  });
};
