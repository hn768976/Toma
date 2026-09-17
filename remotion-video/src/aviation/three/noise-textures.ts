import { clamp, float, floor, fract, mix, mod, texture, vec2 } from "three/tsl";
import type { TSL } from "./tsl";
import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
  UnsignedByteType,
} from "three/webgpu";

/**
 * Cloud volumes are sampled dozens of times per pixel, so the noise they read
 * is baked into textures on the CPU once instead of being evaluated in the
 * shader. On a software rasteriser that difference is the whole budget: a
 * trilinear texture fetch is cheap, eight `sin()` calls per octave are not.
 *
 * The layout follows the standard Perlin-Worley arrangement — a low-frequency
 * base that decides where a cloud is, and progressively finer Worley octaves
 * that erode its edges into cauliflower.
 */

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Deterministic 3D integer hash, tiling on `period` so the volume wraps. */
const hash3 = (x: number, y: number, z: number, period: number, seed: number) => {
  const xi = ((x % period) + period) % period;
  const yi = ((y % period) + period) % period;
  const zi = ((z % period) + period) % period;
  let h = seed ^ Math.imul(xi, 374761393) ^ Math.imul(yi, 668265263) ^ Math.imul(zi, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Tiling gradient (Perlin) noise. */
const perlin = (x: number, y: number, z: number, period: number, seed: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = fade(xf);
  const v = fade(yf);
  const w = fade(zf);

  const grad = (cx: number, cy: number, cz: number, dx: number, dy: number, dz: number) => {
    // 12 edge-midpoint gradients, selected by the hash.
    const h = Math.floor(hash3(cx, cy, cz, period, seed) * 12) % 12;
    const gx = h < 4 ? (h & 1 ? -1 : 1) : h < 8 ? 0 : h & 1 ? -1 : 1;
    const gy = h < 4 ? (h & 2 ? -1 : 1) : h < 8 ? (h & 1 ? -1 : 1) : 0;
    const gz = h < 4 ? 0 : h < 8 ? (h & 2 ? -1 : 1) : h & 2 ? -1 : 1;
    return gx * dx + gy * dy + gz * dz;
  };

  const x0 = lerp(
    lerp(grad(xi, yi, zi, xf, yf, zf), grad(xi + 1, yi, zi, xf - 1, yf, zf), u),
    lerp(grad(xi, yi + 1, zi, xf, yf - 1, zf), grad(xi + 1, yi + 1, zi, xf - 1, yf - 1, zf), u),
    v,
  );
  const x1 = lerp(
    lerp(grad(xi, yi, zi + 1, xf, yf, zf - 1), grad(xi + 1, yi, zi + 1, xf - 1, yf, zf - 1), u),
    lerp(
      grad(xi, yi + 1, zi + 1, xf, yf - 1, zf - 1),
      grad(xi + 1, yi + 1, zi + 1, xf - 1, yf - 1, zf - 1),
      u,
    ),
    v,
  );
  return lerp(x0, x1, w) * 0.5 + 0.5;
};

/**
 * Tiling Worley (cellular) noise, returned inverted so that 1 sits at the cell
 * centres — that is the orientation that reads as billowing cloud rather than
 * as a cracked surface.
 */
const worley = (x: number, y: number, z: number, cells: number, seed: number) => {
  const px = x * cells;
  const py = y * cells;
  const pz = z * cells;
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const iz = Math.floor(pz);
  let best = 1e9;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx;
        const cy = iy + dy;
        const cz = iz + dz;
        const fx = cx + hash3(cx, cy, cz, cells, seed);
        const fy = cy + hash3(cx, cy, cz, cells, seed ^ 0x9e3779b9);
        const fz = cz + hash3(cx, cy, cz, cells, seed ^ 0x85ebca6b);
        const ddx = fx - px;
        const ddy = fy - py;
        const ddz = fz - pz;
        const d = ddx * ddx + ddy * ddy + ddz * ddz;
        if (d < best) best = d;
      }
    }
  }
  return 1 - Math.min(1, Math.sqrt(best));
};

const worleyFbm = (x: number, y: number, z: number, base: number, seed: number) =>
  worley(x, y, z, base, seed) * 0.625 +
  worley(x, y, z, base * 2, seed + 1) * 0.25 +
  worley(x, y, z, base * 4, seed + 2) * 0.125;

const perlinFbm = (x: number, y: number, z: number, period: number, octaves: number, seed: number) => {
  let sum = 0;
  let amp = 0.5;
  let total = 0;
  let freq = period;
  for (let o = 0; o < octaves; o++) {
    sum += perlin(x * freq, y * freq, z * freq, freq, seed + o * 17) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / total;
};

const remap = (v: number, lowIn: number, highIn: number, lowOut: number, highOut: number) =>
  lowOut + ((v - lowIn) / (highIn - lowIn)) * (highOut - lowOut);

/**
 * A volume stored as a grid of 2D slices.
 *
 * The obvious representation is a `Data3DTexture`, and that is what this used
 * to be. On three's WebGPU backend it generates correct WGSL — the sampler is
 * declared `texture_3d<f32>` — but the bind group is built with a 2D texture
 * view, which the device rejects; the pipeline is then invalid and the sky
 * renders as nothing at all. Slicing the volume into a 2D atlas sidesteps the
 * binding entirely and costs one extra bilinear fetch per lookup, since the
 * depth interpolation moves into the shader.
 */
export type VolumeAtlas = {
  readonly texture: DataTexture;
  /** Edge length of the cube, in voxels. */
  readonly size: number;
  readonly tilesX: number;
  readonly tilesY: number;
};

/** Packs a cube of voxels into a `tilesX` x `tilesY` grid of slices. */
const packVolume = (
  size: number,
  tilesX: number,
  tilesY: number,
  write: (x: number, y: number, z: number, out: Uint8Array, offset: number) => void,
): VolumeAtlas => {
  const width = size * tilesX;
  const height = size * tilesY;
  const data = new Uint8Array(width * height * 4);
  for (let z = 0; z < size; z++) {
    const tileX = (z % tilesX) * size;
    const tileY = Math.floor(z / tilesX) * size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        write(x, y, z, data, ((tileY + y) * width + tileX + x) * 4);
      }
    }
  }
  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  // Wrapping is handled per tile in the shader, so the atlas itself must clamp
  // — repeat would pull a neighbouring slice across the tile border.
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, size, tilesX, tilesY };
};

export type CloudNoise = {
  readonly shape: VolumeAtlas;
  readonly detail: VolumeAtlas;
  readonly weather: DataTexture;
  dispose(): void;
};

let cached: CloudNoise | null = null;

/**
 * Builds (and memoises, since every shot in a render shares them) the three
 * textures the cloud march needs.
 *
 * - `shape`   base shape volume: R is the Perlin-Worley mix, GBA are Worley
 *             octaves used to erode the base into rounded lobes.
 * - `detail`  high-frequency Worley volume for the wispy edges.
 * - `weather` 2D map: R coverage, G cloud type (stratus..cumulus), B a slow
 *             density modulation so the deck is not uniform.
 */
export const getCloudNoise = (size = 96): CloudNoise => {
  if (cached) return cached;

  const shape = packVolume(size, 12, 8, (x, y, z, out, i) => {
    const u = x / size;
    const v = y / size;
    const w = z / size;
    const p = perlinFbm(u, v, w, 4, 5, 1337);
    const w0 = worleyFbm(u, v, w, 4, 21);
    const w1 = worleyFbm(u, v, w, 8, 22);
    const w2 = worleyFbm(u, v, w, 16, 23);
    // Perlin-Worley: a Perlin body carved by the inverse Worley field.
    const pw = remap(p, w0 - 1, 1, 0, 1);
    out[i] = Math.max(0, Math.min(255, Math.round(pw * 255)));
    out[i + 1] = Math.round(w0 * 255);
    out[i + 2] = Math.round(w1 * 255);
    out[i + 3] = Math.round(w2 * 255);
  });

  const detail = packVolume(32, 8, 4, (x, y, z, out, i) => {
    const u = x / 32;
    const v = y / 32;
    const w = z / 32;
    out[i] = Math.round(worleyFbm(u, v, w, 4, 71) * 255);
    out[i + 1] = Math.round(worleyFbm(u, v, w, 8, 72) * 255);
    out[i + 2] = Math.round(worleyFbm(u, v, w, 16, 73) * 255);
    out[i + 3] = 255;
  });

  const wSize = 256;
  const weatherData = new Uint8Array(wSize * wSize * 4);
  for (let y = 0; y < wSize; y++) {
    for (let x = 0; x < wSize; x++) {
      const u = x / wSize;
      const v = y / wSize;
      const coverage = perlinFbm(u, v, 0.31, 3, 5, 555);
      const type = perlinFbm(u, v, 0.77, 2, 3, 909);
      const swell = perlinFbm(u, v, 0.11, 6, 4, 4242);
      const i = (y * wSize + x) * 4;
      weatherData[i] = Math.round(Math.max(0, Math.min(1, remap(coverage, 0.35, 0.85, 0, 1))) * 255);
      weatherData[i + 1] = Math.round(Math.max(0, Math.min(1, type)) * 255);
      weatherData[i + 2] = Math.round(Math.max(0, Math.min(1, swell)) * 255);
      weatherData[i + 3] = 255;
    }
  }
  const weather = new DataTexture(weatherData, wSize, wSize, RGBAFormat, UnsignedByteType);
  weather.minFilter = LinearMipmapLinearFilter;
  weather.magFilter = LinearFilter;
  weather.wrapS = RepeatWrapping;
  weather.wrapT = RepeatWrapping;
  weather.generateMipmaps = true;
  weather.needsUpdate = true;

  cached = {
    shape,
    detail,
    weather,
    dispose: () => {
      shape.texture.dispose();
      detail.texture.dispose();
      weather.dispose();
      cached = null;
    },
  };
  return cached;
};

/**
 * Samples a {@link VolumeAtlas} as if it were a 3D texture.
 *
 * `p` is in volume space and tiles at every integer. The two bracketing slices
 * are fetched with hardware bilinear filtering and blended in the shader, which
 * reproduces trilinear interpolation exactly. In-tile coordinates are clamped
 * half a texel from the border so filtering can never reach into a neighbouring
 * slice — and because the baked noise is itself seamless, the edge texel it
 * clamps to is the one wrapping would have supplied anyway.
 */
export const sampleVolume = (atlas: VolumeAtlas, p: TSL): TSL => {
  const { size, tilesX, tilesY } = atlas;
  const uvw = fract(p);
  const depth = float(size);

  // Voxel centres sit at (i + 0.5) / size, so the slice index is offset by half.
  const slicePosition = uvw.z.mul(depth).sub(0.5);
  const slice = floor(slicePosition);
  const blend = slicePosition.sub(slice);

  const inset = 0.5 / size;
  const local = clamp(uvw.xy, inset, 1 - inset);

  const fetch = (index: TSL): TSL => {
    const wrapped = mod(mod(index, depth).add(depth), depth);
    const column = mod(wrapped, float(tilesX));
    const row = floor(wrapped.div(tilesX));
    return texture(
      atlas.texture,
      vec2(column.add(local.x).div(tilesX), row.add(local.y).div(tilesY)),
    ) as unknown as TSL;
  };

  return mix(fetch(slice as TSL), fetch(slice.add(1) as TSL), blend) as TSL;
};
