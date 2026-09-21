/**
 * Thin-film thickness map for look 5.
 *
 * three samples `iridescenceThicknessMap` to vary film thickness across a
 * surface; without one the whole material sits at a single thickness and every
 * bubble shifts hue in unison. A smooth value-noise map spreads thickness over
 * the useful 100-400nm band, which is where the interference colours run pink
 * through magenta into gold -- the range the reference stays inside.
 *
 * Generated once at module-evaluation time from the seeded PRNG, so it is the
 * same on every render thread.
 */
import * as THREE from 'three';
import { Rng } from './random';

const SIZE = 128;
const GRID = 8;

const smoothstep = (edge: number) => edge * edge * (3 - 2 * edge);

export const buildIridescenceThicknessMap = (seed: number): THREE.DataTexture => {
  const rng = new Rng(seed);
  const lattice: number[] = Array.from({ length: (GRID + 1) * (GRID + 1) }, () => rng.next());
  const at = (x: number, y: number) => lattice[(y % (GRID + 1)) * (GRID + 1) + (x % (GRID + 1))];

  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const gx = (x / SIZE) * GRID;
      const gy = (y / SIZE) * GRID;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = smoothstep(gx - x0);
      const fy = smoothstep(gy - y0);
      const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
      const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
      const value = top * (1 - fy) + bottom * fy;
      const byte = Math.round(value * 255);
      const i = (y * SIZE + x) * 4;
      // three reads the green channel; the others are filled for clarity.
      data[i] = byte;
      data[i + 1] = byte;
      data[i + 2] = byte;
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
};
