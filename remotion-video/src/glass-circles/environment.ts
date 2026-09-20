import {
  DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
} from "three/webgpu";
import type { GlassVariant } from "./variants";

const ENV_WIDTH = 1024;
const ENV_HEIGHT = 512;

/** Shortest signed distance between two longitudes given in 0..1 turns. */
const wrapDelta = (a: number): number => {
  const d = a - Math.round(a);
  return d;
};

/**
 * Builds the HDR lighting environment as an equirectangular float texture.
 *
 * It is generated rather than loaded so the whole piece stays self-contained and
 * so light positions are art-directable per variant. The layout matches three's
 * `equirectUV`: u runs from atan2(z, x), v from asin(y), with v=0 at the nadir.
 *
 * Values are linear radiance and deliberately exceed 1.0 inside the light cores
 * -- that headroom is what produces the blown-out rim arcs and feeds the bloom.
 */
export const createEnvironmentTexture = (variant: GlassVariant): DataTexture => {
  const { up, horizon, down, lights } = variant.environment;
  const data = new Float32Array(ENV_WIDTH * ENV_HEIGHT * 4);

  for (let y = 0; y < ENV_HEIGHT; y++) {
    const v = (y + 0.5) / ENV_HEIGHT;
    // Base sky: nadir -> horizon -> zenith.
    const t = v < 0.5 ? v * 2 : (v - 0.5) * 2;
    const baseR = v < 0.5 ? down[0] + (horizon[0] - down[0]) * t : horizon[0] + (up[0] - horizon[0]) * t;
    const baseG = v < 0.5 ? down[1] + (horizon[1] - down[1]) * t : horizon[1] + (up[1] - horizon[1]) * t;
    const baseB = v < 0.5 ? down[2] + (horizon[2] - down[2]) * t : horizon[2] + (up[2] - horizon[2]) * t;

    for (let x = 0; x < ENV_WIDTH; x++) {
      const u = (x + 0.5) / ENV_WIDTH;
      let r = baseR;
      let g = baseG;
      let b = baseB;

      for (let i = 0; i < lights.length; i++) {
        const light = lights[i];
        const du = wrapDelta(u - light.u);
        const dv = v - light.v;
        // Rotate into the strip's own frame so it can lie at an angle.
        const a = light.tilt * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const su = du * ca - dv * sa;
        const sv = du * sa + dv * ca;
        const d2 = (su / light.width) ** 2 + (sv / light.height) ** 2;
        if (d2 > 9) {
          continue;
        }
        // Gaussian core with a soft skirt, so the light has a hot centre and
        // still falls off smoothly enough to avoid banding in the reflections.
        const falloff = Math.exp(-d2 * 1.6);
        const value = falloff * light.intensity;
        r += light.color[0] * value;
        g += light.color[1] * value;
        b += light.color[2] * value;
      }

      const o = (y * ENV_WIDTH + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 1;
    }
  }

  const texture = new DataTexture(data, ENV_WIDTH, ENV_HEIGHT, RGBAFormat, FloatType);
  texture.mapping = EquirectangularReflectionMapping;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};
