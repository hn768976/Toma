import {
  DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  LinearFilter,
  PMREMGenerator,
  RGBAFormat,
  Texture,
  WebGLRenderer,
} from 'three';
import type { VersionConfig } from './versions';

/**
 * Procedural equirect environment: a vertical gradient plus a few soft blobs
 * standing in for studio boxes.
 *
 * Built locally rather than fetched — an HDRI download would be a non-deterministic
 * dependency in a headless render, and this only needs to supply soft wrap light
 * and a believable specular response.
 */
export const buildEnvironment = (
  gl: WebGLRenderer,
  cfg: VersionConfig['env'],
): Texture => {
  const W = 128;
  const H = 64;
  const data = new Float32Array(W * H * 4);

  for (let y = 0; y < H; y++) {
    // theta: 0 at zenith, pi at nadir
    const theta = ((y + 0.5) / H) * Math.PI;
    const t = Math.cos(theta) * 0.5 + 0.5; // 1 at top
    const smooth = t * t * (3 - 2 * t);
    for (let x = 0; x < W; x++) {
      const phi = ((x + 0.5) / W) * Math.PI * 2 - Math.PI;
      const dir: [number, number, number] = [
        Math.sin(theta) * Math.sin(phi),
        Math.cos(theta),
        Math.sin(theta) * Math.cos(phi),
      ];

      let r = cfg.bottom[0] + (cfg.top[0] - cfg.bottom[0]) * smooth;
      let g = cfg.bottom[1] + (cfg.top[1] - cfg.bottom[1]) * smooth;
      let b = cfg.bottom[2] + (cfg.top[2] - cfg.bottom[2]) * smooth;

      for (const blob of cfg.blobs) {
        const len = Math.hypot(...blob.dir);
        const d =
          (dir[0] * blob.dir[0] + dir[1] * blob.dir[1] + dir[2] * blob.dir[2]) /
          len;
        // Soft-edged cap: 1 at the centre, 0 outside `size`.
        const k = Math.max(0, (d - (1 - blob.size)) / blob.size);
        const w = k * k * (3 - 2 * k);
        r += blob.color[0] * w;
        g += blob.color[1] * w;
        b += blob.color[2] * w;
      }

      const o = (y * W + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 1;
    }
  }

  const tex = new DataTexture(data, W, H, RGBAFormat, FloatType);
  tex.mapping = EquirectangularReflectionMapping;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;

  const pmrem = new PMREMGenerator(gl);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromEquirectangular(tex);
  tex.dispose();
  pmrem.dispose();
  return target.texture;
};
