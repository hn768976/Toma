import {useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {
  DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  LinearFilter,
  PMREMGenerator,
  RGBAFormat,
  Texture,
} from 'three';

/**
 * A small procedural sky/ground gradient, prefiltered into an environment map.
 *
 * Metals reflect their surroundings; with nothing to reflect, the pole renders
 * near black. It also supplies the soft indirect light that lets the fabric's
 * sheen read at grazing angles.
 *
 * Built with useMemo rather than an effect, and handed to each material
 * explicitly rather than through `scene.environment`: <ThreeCanvas/> draws the
 * frame from a mount effect and never redraws, so anything installed after
 * that first draw would simply be missing.
 */
export const useEnvironment = (): Texture => {
  const gl = useThree((s) => s.gl);

  return useMemo(() => {
    const w = 64; // equirectangular is 2:1
    const h = 32;
    const data = new Float32Array(w * h * 4);
    const sky = [0.30, 0.50, 0.82];
    const horizon = [0.80, 0.86, 0.92];
    const ground = [0.24, 0.23, 0.21];

    for (let y = 0; y < h; y++) {
      const v = y / (h - 1); // 0 at the zenith, 1 at the nadir
      let c: number[];
      if (v < 0.5) {
        const k = Math.pow(v / 0.5, 0.7);
        c = sky.map((s, i) => s + (horizon[i] - s) * k);
      } else {
        const k = Math.min(1, (v - 0.5) / 0.22);
        c = horizon.map((s, i) => s + (ground[i] - s) * k);
      }
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        data[o] = c[0];
        data[o + 1] = c[1];
        data[o + 2] = c[2];
        data[o + 3] = 1;
      }
    }

    const tex = new DataTexture(data, w, h, RGBAFormat, FloatType);
    tex.mapping = EquirectangularReflectionMapping;
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearFilter;
    tex.needsUpdate = true;

    const pmrem = new PMREMGenerator(gl);
    const rt = pmrem.fromEquirectangular(tex);
    pmrem.dispose();
    tex.dispose();
    return rt.texture;
  }, [gl]);
};
