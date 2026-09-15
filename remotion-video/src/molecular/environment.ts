import * as THREE from "three";

/**
 * Procedural studio environment.
 *
 * The references are all lit like a product shot: a broad sky gradient plus a
 * couple of soft boxes that land as the bright specular crescents on every
 * sphere. Rather than ship an HDRI (and fetch it at render time, which would
 * make renders non-deterministic and network-dependent), we synthesise an
 * equirectangular float texture and run it through PMREM. It is a few hundred
 * KB of arithmetic, identical on every machine and every frame.
 */

export type EnvLight = {
  /** Horizontal placement, 0..1 around the sphere. */
  u: number;
  /** Vertical placement, 0 = top pole, 1 = bottom pole. */
  v: number;
  /** Angular radius in radians. */
  size: number;
  intensity: number;
  color: [number, number, number];
  /** >1 squashes the blob horizontally into a strip light. */
  aspect?: number;
};

export type EnvSpec = {
  top: [number, number, number];
  horizon: [number, number, number];
  bottom: [number, number, number];
  lights: EnvLight[];
};

const EQUIRECT_WIDTH = 256;
const EQUIRECT_HEIGHT = 128;

const mixColor = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Shortest distance between two 0..1 wrapped coordinates. */
const wrappedDelta = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 1;
  return d > 0.5 ? 1 - d : d;
};

export const buildEquirectTexture = (
  spec: EnvSpec,
  exposure: number,
): THREE.DataTexture => {
  const data = new Float32Array(EQUIRECT_WIDTH * EQUIRECT_HEIGHT * 4);

  for (let y = 0; y < EQUIRECT_HEIGHT; y++) {
    const v = (y + 0.5) / EQUIRECT_HEIGHT;

    // Two-stop vertical gradient: top -> horizon over the upper half,
    // horizon -> bottom over the lower half.
    const base =
      v < 0.5
        ? mixColor(spec.top, spec.horizon, smoothstep(v * 2))
        : mixColor(spec.horizon, spec.bottom, smoothstep((v - 0.5) * 2));

    for (let x = 0; x < EQUIRECT_WIDTH; x++) {
      const u = (x + 0.5) / EQUIRECT_WIDTH;

      let r = base[0];
      let g = base[1];
      let b = base[2];

      for (const light of spec.lights) {
        const aspect = light.aspect ?? 1;
        // Horizontal distance is scaled by sin(theta) so blobs near the poles
        // do not smear into rings.
        const theta = v * Math.PI;
        const du = (wrappedDelta(u, light.u) * Math.PI * 2 * Math.sin(theta)) / aspect;
        const dv = (v - light.v) * Math.PI;
        const dist = Math.sqrt(du * du + dv * dv);

        const falloff = Math.exp(-(dist * dist) / (2 * light.size * light.size));
        if (falloff > 0.0005) {
          const amount = falloff * light.intensity;
          r += light.color[0] * amount;
          g += light.color[1] * amount;
          b += light.color[2] * amount;
        }
      }

      const i = (y * EQUIRECT_WIDTH + x) * 4;
      data[i] = r * exposure;
      data[i + 1] = g * exposure;
      data[i + 2] = b * exposure;
      data[i + 3] = 1;
    }
  }

  const texture = new THREE.DataTexture(
    data,
    EQUIRECT_WIDTH,
    EQUIRECT_HEIGHT,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};
