import * as THREE from "three";
import type { LandRings } from "./assets";

export type Ctx = CanvasRenderingContext2D;

export const makeCanvas = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d", { willReadFrequently: false }) as Ctx;
  return { canvas, ctx };
};

/** Canvas -> texture with mipmaps and full anisotropic filtering, so small
 *  text and thin lines stay crisp (and don't crawl) on tilted planes. */
export const canvasTexture = (canvas: HTMLCanvasElement, gl: THREE.WebGLRenderer) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
  tex.colorSpace = THREE.NoColorSpace;
  tex.premultiplyAlpha = false;
  tex.needsUpdate = true;
  return tex;
};

export const font = (weight: number, px: number, family: "Inter" | "JetBrains Mono" = "Inter", italic = false) =>
  `${italic ? "italic " : ""}${weight} ${Math.max(1, px).toFixed(2)}px "${family}"`;

// Miller cylindrical projection, used for every world map.
export const millerY = (latDeg: number) => {
  const p = (latDeg * Math.PI) / 180;
  return 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * p));
};

export type MapRect = { x: number; y: number; w: number; h: number; latTop: number; latBottom: number };

export const projector = (r: MapRect) => {
  const yT = millerY(r.latTop);
  const yB = millerY(r.latBottom);
  return (lon: number, lat: number): [number, number] => [
    r.x + ((lon + 180) / 360) * r.w,
    r.y + ((yT - millerY(Math.max(-85, Math.min(85, lat)))) / (yT - yB)) * r.h,
  ];
};

export const landPath = (ctx: Ctx, rings: LandRings, r: MapRect) => {
  const p = projector(r);
  ctx.beginPath();
  for (const ring of rings) {
    // Skip Antarctica (cropped by every reference map).
    if (ring.length && ring[0][1] < -60 && ring.every(([, la]) => la < -55)) continue;
    let prevLon = ring[0][0];
    ring.forEach(([lon, lat], i) => {
      const [x, y] = p(lon, lat);
      if (i === 0 || Math.abs(lon - prevLon) > 180) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      prevLon = lon;
    });
    ctx.closePath();
  }
};

export const roundRect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

export const rgba = (hex: string, a = 1) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export const hexVec = (hex: string, mult = 1) => {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r * mult, c.g * mult, c.b * mult);
};
