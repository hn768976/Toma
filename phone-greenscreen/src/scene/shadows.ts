import * as THREE from "three";
import { PHONE } from "../phone/buildPhone";

/**
 * Shadow textures computed with plain math (no canvas, no randomness), so
 * every render thread builds byte-identical textures.
 * RGB is black, alpha holds the shadow density.
 */
const alphaTexture = (size: [number, number], alpha: (u: number, v: number) => number) => {
  const [w, h] = size;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = alpha((x + 0.5) / w, (y + 0.5) / h);
      data[(y * w + x) * 4 + 3] = Math.round(Math.min(1, Math.max(0, a)) * 255);
    }
  }
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.colorSpace = THREE.NoColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
};

/** Soft elliptical contact shadow (two gaussians: a tighter core plus a wide falloff). */
export const contactShadowTexture = () =>
  alphaTexture([256, 256], (u, v) => {
    const x = (u - 0.5) * 2;
    const y = (v - 0.5) * 2;
    const r2 = x * x + y * y;
    const a = 0.65 * Math.exp(-r2 * 9) + 0.35 * Math.exp(-r2 * 3.5);
    // fade the square edge out completely
    return a * (1 - Math.pow(Math.min(1, r2), 4));
  });

/** Blurred rounded rectangle for the grid's drop shadows. */
export const GRID_SHADOW_PAD = 0.3;
export const roundedRectShadowTexture = (blur: number) => {
  const { W, H, R } = PHONE;
  const tw = W + 2 * GRID_SHADOW_PAD;
  const th = H + 2 * GRID_SHADOW_PAD;
  return alphaTexture([128, 256], (u, v) => {
    const px = Math.abs((u - 0.5) * tw);
    const py = Math.abs((v - 0.5) * th);
    const qx = px - (W / 2 - R);
    const qy = py - (H / 2 - R);
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
    const inside = Math.min(Math.max(qx, qy), 0);
    const sd = outside + inside - R;
    // smooth (erf-like) falloff across the edge
    return 0.5 * (1 - Math.tanh((sd / blur) * 1.1));
  });
};
