import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";

// Equirectangular land mask from Natural Earth 1:110m land (world-atlas, ISC).
// Longitudes -180..180 span the width; latitudes MASK_TOP..MASK_BOTTOM span the height.
// Antarctica is left out entirely. The frame crop (land from about +83 to -58 deg, with the
// small dark margins the references have) is applied in the LED shader.
export const MASK_TOP = 90;
export const MASK_BOTTOM = -62;

const PX_PER_DEG = 4; // 1440 x 564 raster: 12 px per LED at 120 LEDs across

let cached: THREE.DataTexture | null = null;

const blurH = (src: Float32Array, dst: Float32Array, w: number, h: number, k: number[]) => {
  const r = (k.length - 1) / 2;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) {
        const xx = (((x + i) % w) + w) % w; // wraps across the antimeridian
        s += src[row + xx] * k[i + r];
      }
      dst[row + x] = s;
    }
  }
};

const blurV = (src: Float32Array, dst: Float32Array, w: number, h: number, k: number[]) => {
  const r = (k.length - 1) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) {
        const yy = Math.min(h - 1, Math.max(0, y + i));
        s += src[yy * w + x] * k[i + r];
      }
      dst[y * w + x] = s;
    }
  }
};

const gaussian = (sigma: number) => {
  const r = Math.ceil(sigma * 3);
  const k: number[] = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v);
    sum += v;
  }
  return k.map((v) => v / sum);
};

// Built once per page, synchronously, then cached. Callers gate the first frame on it with
// delayRender/continueRender.
export const getLandMask = (): THREE.DataTexture => {
  if (cached) return cached;
  const w = 360 * PX_PER_DEG;
  const h = (MASK_TOP - MASK_BOTTOM) * PX_PER_DEG;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  const topo = land110 as unknown as Topology<{ land: GeometryCollection }>;
  const geo = feature(topo, topo.objects.land);
  const fc: GeoJSON.Feature[] =
    geo.type === "FeatureCollection" ? geo.features : [geo as unknown as GeoJSON.Feature];
  const X = (lon: number) => ((lon + 180) / 360) * w;
  const Y = (lat: number) => ((MASK_TOP - lat) / (MASK_TOP - MASK_BOTTOM)) * h;
  ctx.beginPath();
  for (const f of fc) {
    const g = f.geometry;
    if (!g) continue;
    const polys =
      g.type === "Polygon"
        ? [g.coordinates]
        : g.type === "MultiPolygon"
          ? g.coordinates
          : [];
    for (const poly of polys as number[][][][]) {
      for (const ring of poly) {
        // Skip Antarctica (all of it lies below the crop anyway; its ring runs along -90).
        if (ring.every(([, lat]) => lat < -60)) continue;
        // Rings that cross the antimeridian (Russia, Fiji) jump by ~360 deg between
        // neighbouring points: unwrap them into one continuous ring, then draw it again
        // shifted by 360 deg so both halves land on the map.
        const un: [number, number][] = [];
        let off = 0;
        ring.forEach(([lon, lat], i) => {
          if (i > 0) {
            const d = lon + off - un[i - 1][0];
            if (d > 180) off -= 360;
            else if (d < -180) off += 360;
          }
          un.push([lon + off, lat]);
        });
        const minLon = Math.min(...un.map((p) => p[0]));
        const maxLon = Math.max(...un.map((p) => p[0]));
        const shifts = [0];
        if (maxLon > 180) shifts.push(-360);
        if (minLon < -180) shifts.push(360);
        for (const sh of shifts) {
          un.forEach(([lon, lat], i) => {
            if (i === 0) ctx.moveTo(X(lon + sh), Y(lat));
            else ctx.lineTo(X(lon + sh), Y(lat));
          });
          ctx.closePath();
        }
      }
    }
  }
  ctx.fill("evenodd");
  const img = ctx.getImageData(0, 0, w, h).data;
  const a = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = img[i * 4] / 255;
  // ~1 LED of softening (LED pitch is 3 deg = 12 px; sigma 0.35 LED) so coastline LEDs
  // pick up partial brightness.
  const b = new Float32Array(w * h);
  const k = gaussian(4.2);
  blurH(a, b, w, h, k);
  blurV(b, a, w, h, k);
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(Math.min(1, Math.max(0, a[i])) * 255);
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.flipY = false; // row 0 = MASK_TOP, sampled with v = 0 at the top
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
};
