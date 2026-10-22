import { geoGraticule10, geoPath } from "d3-geo";
import type { FeatureCollection, MultiPolygon } from "geojson";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { continueRender, delayRender, staticFile, useVideoConfig } from "remotion";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import land50 from "world-atlas/land-50m.json";
import { makeProjection, MapCamera, MILLER_YMAX } from "./projection";
import { WorldPalette } from "./palette";
import { buildDetailTile } from "./texture";

// Natural Earth 1:50m land polygons (public domain) via world-atlas.
const topo = land50 as unknown as Topology<{ land: GeometryCollection }>;
const LAND = feature(topo, topo.objects.land) as unknown as FeatureCollection<MultiPolygon>;
const GRATICULE = geoGraticule10();

let reliefPromise: Promise<ImageData> | null = null;
let detailCache: Float32Array | null = null;

/** Loads the baked greyscale relief texture once per tab. */
const loadRelief = () => {
  reliefPromise ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
    };
    img.onerror = () => reject(new Error("Failed to load land-relief.jpg"));
    img.src = staticFile("map/land-relief.jpg");
  });
  return reliefPromise;
};
const colorCache = new Map<string, { tex: HTMLCanvasElement; detail: HTMLCanvasElement }>();

const DETAIL = 512;

/** Colourises the shared luminance textures for a palette (cached). */
const getTextures = (pal: WorldPalette, relief: ImageData) => {
  const key = JSON.stringify([pal.landLo, pal.landHi]);
  const hit = colorCache.get(key);
  if (hit) return hit;
  detailCache ??= buildDetailTile(DETAIL);
  const tex = document.createElement("canvas");
  tex.width = relief.width;
  tex.height = relief.height;
  const tctx = tex.getContext("2d")!;
  const img = tctx.createImageData(relief.width, relief.height);
  const n = relief.width * relief.height;
  for (let i = 0; i < n; i++) {
    const l = relief.data[i * 4] / 255;
    img.data[i * 4] = pal.landLo[0] + (pal.landHi[0] - pal.landLo[0]) * l;
    img.data[i * 4 + 1] = pal.landLo[1] + (pal.landHi[1] - pal.landLo[1]) * l;
    img.data[i * 4 + 2] = pal.landLo[2] + (pal.landHi[2] - pal.landLo[2]) * l;
    img.data[i * 4 + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  const detail = document.createElement("canvas");
  detail.width = DETAIL;
  detail.height = DETAIL;
  const dctx = detail.getContext("2d")!;
  const dimg = dctx.createImageData(DETAIL, DETAIL);
  for (let i = 0; i < detailCache.length; i++) {
    const v = Math.max(0, Math.min(255, 128 + (detailCache[i] - 0.5) * 260));
    dimg.data[i * 4] = v;
    dimg.data[i * 4 + 1] = v;
    dimg.data[i * 4 + 2] = v;
    dimg.data[i * 4 + 3] = 255;
  }
  dctx.putImageData(dimg, 0, 0);
  const out = { tex, detail };
  colorCache.set(key, out);
  return out;
};

export type MapLook = {
  /** 0..1 extra land brightness ("highlight" beat). */
  bright: number;
  /** Optional focus rectangle (design px) — outside is dimmed, inside lifted. */
  focus?: { x: number; y: number; w: number; h: number; dim: number; lift: number };
  /** 0..1 reveal for the opening glitch (random horizontal bands). */
  reveal: number;
  revealSeed: number;
};

const drawScene = (
  ctx: CanvasRenderingContext2D,
  cam: MapCamera,
  w: number,
  h: number,
  pal: WorldPalette,
  look: MapLook,
  textures: { tex: HTMLCanvasElement; detail: HTMLCanvasElement },
) => {
  const ds = w / 1920; // backing px per design px
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, w * 0.7);
  g.addColorStop(0, pal.ocean[1]);
  g.addColorStop(1, pal.ocean[0]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const proj = makeProjection(cam, w, h);
  const path = geoPath(proj, ctx);

  ctx.strokeStyle = pal.grid;
  ctx.lineWidth = 1 * ds;
  ctx.beginPath();
  path(GRATICULE);
  ctx.stroke();

  // Land: clip to coastlines, then paint the relief texture in projection space.
  ctx.save();
  ctx.beginPath();
  path(LAND);
  ctx.clip();
  const s = proj.scale();
  const [tx, ty] = proj.translate();
  const { tex, detail } = textures;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.setTransform((s * 2 * Math.PI) / tex.width, 0, 0, (s * 2 * MILLER_YMAX) / tex.height, tx - s * Math.PI, ty - s * MILLER_YMAX);
  ctx.drawImage(tex, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // World-locked fine detail, faded in as we zoom so the texture never looks soft.
  const pat = ctx.createPattern(detail, "repeat")!;
  const tile = s * 0.09; // ~5° of longitude per tile
  pat.setTransform(new DOMMatrix([tile / DETAIL, 0, 0, tile / DETAIL, tx, ty]));
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = Math.min(0.6, 0.25 + 0.2 * (cam.k - 1));
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  const pat2 = ctx.createPattern(detail, "repeat")!;
  const tile2 = s * 0.023;
  pat2.setTransform(new DOMMatrix([tile2 / DETAIL, 0, 0, tile2 / DETAIL, tx + 37, ty + 91]));
  ctx.globalAlpha = Math.min(0.3, 0.08 + 0.12 * (cam.k - 1));
  ctx.fillStyle = pat2;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "screen";
  if (look.bright > 0) {
    ctx.globalAlpha = look.bright * 0.45;
    ctx.fillStyle = "rgb(200,210,210)";
    ctx.fillRect(0, 0, w, h);
  }
  if (look.focus && look.focus.lift > 0) {
    const f = look.focus;
    ctx.globalAlpha = f.lift;
    ctx.fillStyle = "rgb(120,130,130)";
    ctx.fillRect(f.x * ds, f.y * ds, f.w * ds, f.h * ds);
  }
  ctx.restore();

  ctx.strokeStyle = pal.coast;
  ctx.lineWidth = 1.1 * ds;
  ctx.beginPath();
  path(LAND);
  ctx.stroke();

  if (look.focus && look.focus.dim > 0) {
    const f = look.focus;
    ctx.fillStyle = `rgba(0,0,0,${f.dim})`;
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(f.x * ds, f.y * ds, f.w * ds, f.h * ds);
    ctx.fill("evenodd");
  }

  // Vignette.
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, w * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
};

/**
 * Canvas 2D world map. `cams` holds one camera per motion-blur sub-sample;
 * with several entries the samples are averaged into the final frame.
 */
export const MapCanvas: React.FC<{
  cams: MapCamera[];
  palette: WorldPalette;
  look: MapLook;
  /** Per-sample screen displacement (design px) for the final smear pass. */
  smear?: { x: number; y: number };
}> = ({ cams, palette, look, smear }) => {
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);
  const [relief, setRelief] = useState<ImageData | null>(null);
  const [handle] = useState(() => delayRender("Loading map relief"));
  useEffect(() => {
    loadRelief()
      .then((r) => setRelief(r))
      .catch((err) => {
        console.error(err);
        throw err;
      });
  }, []);
  useEffect(() => {
    if (relief) continueRender(handle);
  }, [relief, handle]);
  const textures = useMemo(() => (relief ? getTextures(palette, relief) : null), [palette, relief]);
  const scratch = useMemo(() => document.createElement("canvas"), []);

  useLayoutEffect(() => {
    if (!textures) return;
    const ctx = ref.current!.getContext("2d")!;
    if (cams.length === 1) {
      drawScene(ctx, cams[0], bw, bh, palette, look, textures);
    } else {
      scratch.width = bw;
      scratch.height = bh;
      const sctx = scratch.getContext("2d")!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      cams.forEach((c, i) => {
        drawScene(sctx, c, bw, bh, palette, look, textures);
        ctx.globalAlpha = 1 / (i + 1);
        ctx.drawImage(scratch, 0, 0);
      });
      if (smear) {
        // Box-filter along the motion direction across one sample step.
        const k = bw / 1920;
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.globalAlpha = 1;
        sctx.globalCompositeOperation = "copy";
        sctx.drawImage(ref.current!, 0, 0);
        sctx.globalCompositeOperation = "source-over";
        const taps = [-0.5, -0.25, 0.25, 0.5];
        taps.forEach((t, i) => {
          ctx.globalAlpha = 1 / (i + 2);
          ctx.drawImage(scratch, smear.x * t * k, smear.y * t * k);
        });
      }
      ctx.globalAlpha = 1;
    }
    // Opening glitch: black out random horizontal bands.
    if (look.reveal < 1) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#000";
      const bands = 18;
      for (let i = 0; i < bands; i++) {
        const r = Math.abs(Math.sin((i + 1) * 91.7 + look.revealSeed * 13.1)) % 1;
        if (r > look.reveal) {
          const y0 = (i / bands) * bh;
          const xoff = (Math.sin(i * 7.3 + look.revealSeed) * 0.5 + 0.5) * bw * (1 - look.reveal);
          ctx.fillRect(look.reveal > 0.5 ? xoff : 0, y0, bw, bh / bands + 1);
        }
      }
    }
  });

  return <canvas ref={ref} width={bw} height={bh} style={{ position: "absolute", inset: 0, width, height }} />;
};
