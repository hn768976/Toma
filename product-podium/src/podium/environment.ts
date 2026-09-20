/**
 * Environment map.
 *
 * Reflections in look 1's glass and look 2's floor need something to reflect.
 * A downloaded studio HDRI would put a recognisable softbox or window in
 * those reflections — visibly wrong for a stage a buyer will composite onto,
 * and a licence question on top. Instead this builds a neutral studio
 * gradient as a floating-point equirectangular map: a broad overhead
 * source, a soft front fill, a darker floor, and no object of any kind.
 *
 * It is generated in-project, so there is nothing to attribute and nothing
 * to download at render time. See the README for how to swap in a Poly Haven
 * HDRI instead if you want one.
 */
import * as THREE from "three";

export type EnvironmentOptions = {
  /** Overall multiplier on the map. */
  intensity: number;
  /** Linear-space colour of the broad overhead source. */
  top: [number, number, number];
  /** Linear-space colour at the horizon. */
  horizon: [number, number, number];
  /** Linear-space colour below the horizon. */
  bottom: [number, number, number];
  /** Optional tinted lobes, as [azimuthDeg, elevationDeg, sizeDeg, r, g, b]. */
  lobes?: [number, number, number, number, number, number][];
};

const WIDTH = 256;
const HEIGHT = 128;

const cache = new Map<string, THREE.DataTexture>();

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const studioEnvironment = (o: EnvironmentOptions) => {
  const key = JSON.stringify(o);
  const hit = cache.get(key);
  if (hit) return hit;

  const data = new Float32Array(WIDTH * HEIGHT * 4);
  const lobes = o.lobes ?? [];

  for (let y = 0; y < HEIGHT; y++) {
    // theta: 0 at the zenith, PI at the nadir.
    const theta = ((y + 0.5) / HEIGHT) * Math.PI;
    const up = Math.cos(theta); // +1 zenith, -1 nadir
    for (let x = 0; x < WIDTH; x++) {
      const phi = ((x + 0.5) / WIDTH) * Math.PI * 2 - Math.PI;

      // Three-stop vertical gradient, smooth at both joins.
      let r: number;
      let g: number;
      let b: number;
      if (up >= 0) {
        const t = smoothstep(0, 1, up);
        r = o.horizon[0] + (o.top[0] - o.horizon[0]) * t;
        g = o.horizon[1] + (o.top[1] - o.horizon[1]) * t;
        b = o.horizon[2] + (o.top[2] - o.horizon[2]) * t;
      } else {
        const t = smoothstep(0, 1, -up);
        r = o.horizon[0] + (o.bottom[0] - o.horizon[0]) * t;
        g = o.horizon[1] + (o.bottom[1] - o.horizon[1]) * t;
        b = o.horizon[2] + (o.bottom[2] - o.horizon[2]) * t;
      }

      for (const [azDeg, elDeg, sizeDeg, lr, lg, lb] of lobes) {
        const az = (azDeg * Math.PI) / 180;
        const el = (elDeg * Math.PI) / 180;
        // Angular distance to the lobe centre.
        const cosD =
          Math.sin(el) * up +
          Math.cos(el) * Math.sin(theta) * Math.cos(phi - az);
        const d = Math.acos(Math.min(1, Math.max(-1, cosD)));
        // Cosine-squared falloff: broad and edgeless, so nothing in the map
        // ever reads as a rectangle with a border.
        const w = Math.pow(
          Math.max(0, Math.cos(Math.min(Math.PI / 2, (d / ((sizeDeg * Math.PI) / 180)) * (Math.PI / 2)))),
          2,
        );
        r += lr * w;
        g += lg * w;
        b += lb * w;
      }

      const i = (y * WIDTH + x) * 4;
      data[i] = r * o.intensity;
      data[i + 1] = g * o.intensity;
      data[i + 2] = b * o.intensity;
      data[i + 3] = 1;
    }
  }

  const tex = new THREE.DataTexture(
    data,
    WIDTH,
    HEIGHT,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.NoColorSpace; // already linear
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
};
