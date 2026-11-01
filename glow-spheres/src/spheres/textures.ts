import * as THREE from "three";
import type { Random } from "../lib/random";

/**
 * Equirectangular stripe texture: horizontal bands in UV space become
 * latitude rings on a sphere – stripes around one axis with bull's-eyes at
 * the poles, exactly like the reference spheres.
 */
export const createStripeTexture = (colors: string[], rand: Random) => {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  let y = 0;
  let i = rand.int(0, colors.length - 1);
  while (y < canvas.height) {
    const h = rand.range(18, 58);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(0, Math.floor(y), canvas.width, Math.ceil(h) + 1);
    y += h;
    i += rand.int(1, colors.length - 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};
