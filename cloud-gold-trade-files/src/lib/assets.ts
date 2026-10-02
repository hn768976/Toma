import { staticFile } from "remotion";
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

// Studio HDRI: Poly Haven "Studio Small 03" (CC0), see public/hdri/LICENSE.md
export const HDRI_URL = staticFile("hdri/studio_small_03_1k.hdr");

export async function loadStudioEnv(gl: THREE.WebGLRenderer): Promise<THREE.Texture> {
  const tex = await new HDRLoader().setDataType(THREE.HalfFloatType).loadAsync(HDRI_URL);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(gl);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
  return env;
}

export async function loadJSON<T>(path: string): Promise<T> {
  const res = await fetch(staticFile(path));
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return (await res.json()) as T;
}

/** Canvas -> texture helper (sRGB colour data). */
export function canvasTexture(c: HTMLCanvasElement | OffscreenCanvas, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c as HTMLCanvasElement);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return [c, ctx];
}
