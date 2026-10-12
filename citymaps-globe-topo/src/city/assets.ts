// Built-once city data and textures (per browser tab).
import * as THREE from "three";
import { CityStyle, drawCity } from "./draw";
import { City, generateCity } from "./generate";

const cities = new Map<number, City>();
export const getCity = (seed: number) => {
  let c = cities.get(seed);
  if (!c) {
    c = generateCity({ seed });
    cities.set(seed, c);
  }
  return c;
};

const canvases = new Map<string, HTMLCanvasElement>();
export const getCityCanvas = (seed: number, style: CityStyle) => {
  const key = `${seed}:${JSON.stringify(style)}`;
  let c = canvases.get(key);
  if (!c) {
    c = drawCity(getCity(seed), style);
    canvases.set(key, c);
  }
  return c;
};

// Mipmapped, anisotropic, repeat-wrapped texture; uploaded immediately.
export const makeCityTexture = (renderer: THREE.WebGLRenderer, canvas: HTMLCanvasElement) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false; // texture v follows canvas y (down)
  renderer.initTexture(tex);
  return tex;
};
