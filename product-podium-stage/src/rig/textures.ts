/**
 * Procedural surface textures.
 *
 * Generated as DataTextures rather than shipped as image files: they are
 * seeded from the look id, so they are identical across a look's two palettes
 * and reproducible on any machine, and the project stays free of bitmap
 * assets. The noise is tileable, so a texture can repeat across a large wall
 * without a visible seam.
 *
 * A plain flat backdrop colour is the tell that gives away a cheap render -
 * these supply the faint tonal drift and micro-relief that make the plaster
 * and concrete read as real surfaces.
 */

import * as THREE from "three";
import { mulberry32 } from "../lib/random";

/**
 * Tileable value noise.
 *
 * Lattice coordinates are wrapped modulo `period`, so the field repeats
 * exactly every `period` units and a texture built from it tiles seamlessly.
 */
const makeValueNoise = (seed: number) => {
  const rng = mulberry32(seed);
  const permutation = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = base[i];
    base[i] = base[j];
    base[j] = tmp;
  }
  for (let i = 0; i < 512; i++) permutation[i] = base[i & 255];

  const hash = (x: number, y: number) =>
    permutation[(permutation[x & 255] + y) & 255] / 255;

  const fade = (t: number) => t * t * (3 - 2 * t);

  return (x: number, y: number, period: number): number => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const x0 = ((xi % period) + period) % period;
    const y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period;
    const y1 = (y0 + 1) % period;
    const u = fade(xf);
    const v = fade(yf);
    const a = hash(x0, y0);
    const b = hash(x1, y0);
    const c = hash(x0, y1);
    const d = hash(x1, y1);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };
};

export interface NoiseTextureOptions {
  size?: number;
  seed: number;
  /** Lattice cells across the texture at the lowest octave. Must be integer. */
  basePeriod?: number;
  octaves?: number;
  /** 0 = flat grey, 1 = full range. */
  contrast?: number;
  /** Mid-point the variation sits around. */
  level?: number;
  /** Adds sparse bright/dark specks - reads as aggregate in concrete. */
  speckle?: number;
}

/**
 * Renders fbm into a single-channel-equivalent RGBA byte array.
 * Returned separately from the textures so one buffer can back both the sRGB
 * colour map and the linear roughness/bump maps.
 */
export const buildNoiseData = ({
  size = 1024,
  seed,
  basePeriod = 4,
  octaves = 5,
  contrast = 0.22,
  level = 0.88,
  speckle = 0,
}: NoiseTextureOptions): Uint8Array => {
  const noise = makeValueNoise(seed);
  const speckleRng = mulberry32(seed ^ 0x9e3779b9);
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let sum = 0;
      let amplitude = 1;
      let total = 0;
      for (let o = 0; o < octaves; o++) {
        // Lattice period doubles with frequency, so every octave shares the
        // same one-texture world period and the whole stack tiles.
        const frequency = basePeriod * Math.pow(2, o);
        sum += noise(u * frequency, v * frequency, frequency) * amplitude;
        total += amplitude;
        amplitude *= 0.5;
      }
      let value = level + (sum / total - 0.5) * 2 * contrast;

      if (speckle > 0) {
        const r = speckleRng();
        if (r > 0.9985) value += speckle;
        else if (r < 0.0015) value -= speckle;
      }

      const byte = Math.max(0, Math.min(255, Math.round(value * 255)));
      const at = (y * size + x) * 4;
      data[at] = byte;
      data[at + 1] = byte;
      data[at + 2] = byte;
      data[at + 3] = 255;
    }
  }
  return data;
};

const makeTexture = (
  data: Uint8Array,
  size: number,
  colorSpace: THREE.ColorSpace,
  repeat: [number, number],
  anisotropy: number,
): THREE.DataTexture => {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
};

export interface SurfaceTextures {
  /** sRGB, for `map` - supplies the faint tonal drift. */
  color: THREE.DataTexture;
  /** Linear, for `roughnessMap` and `bumpMap`. */
  linear: THREE.DataTexture;
  dispose: () => void;
}

/**
 * One noise field exposed as the two textures a PBR material needs. The same
 * bytes back both; only the colour space and intended slot differ, which is
 * why they cannot be a single texture object.
 */
export const buildSurfaceTextures = (
  options: NoiseTextureOptions & { repeat?: [number, number]; anisotropy?: number },
): SurfaceTextures => {
  const size = options.size ?? 1024;
  const data = buildNoiseData(options);
  const repeat = options.repeat ?? [1, 1];
  const anisotropy = options.anisotropy ?? 8;
  const color = makeTexture(data, size, THREE.SRGBColorSpace, repeat, anisotropy);
  const linear = makeTexture(
    // A second view over the same bytes; three needs distinct texture objects
    // because colour space is a property of the texture, not the sampler.
    data,
    size,
    THREE.NoColorSpace,
    repeat,
    anisotropy,
  );
  return {
    color,
    linear,
    dispose: () => {
      color.dispose();
      linear.dispose();
    },
  };
};
