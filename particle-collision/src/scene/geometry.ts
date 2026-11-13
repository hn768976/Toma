import * as THREE from "three";
import { mulberry32 } from "../lib/random";

export const RIBBON_PARTICLES = 150_000; // per ribbon
export const GLOW_PARTICLES = 2_500; // per ribbon (large, faint haze sprites)
export const DUST_PARTICLES = 1_400;

// Builds one static BufferGeometry holding both ribbons + dust. All motion is
// done in the vertex shader from these attributes.
export const buildParticleGeometry = (seed = 7) => {
  const rand = mulberry32(seed);
  const total = 2 * (RIBBON_PARTICLES + GLOW_PARTICLES) + DUST_PARTICLES;
  const params = new Float32Array(total * 4);
  const rnd = new Float32Array(total * 4);
  let i = 0;
  const push = (u: number, v: number, rid: number, kind: number) => {
    params.set([u, v, rid, kind], i * 4);
    rnd.set([rand(), rand(), rand(), rand()], i * 4);
    i++;
  };

  for (let r = 0; r < 2; r++) {
    for (let k = 0; k < RIBBON_PARTICLES; k++) {
      const u = rand();
      let v: number;
      const pick = rand();
      if (pick < 0.42) {
        // dense, bright leading edge
        v = Math.pow(rand(), 2.5) * 0.12;
      } else if (pick < 0.85) {
        // streak rows across the sheet (gives the fine "scan-line" texture)
        const rows = 70;
        v = Math.round(Math.pow(rand(), 1.15) * rows) / rows;
        v += (rand() - 0.5) * 0.004;
      } else {
        v = Math.pow(rand(), 1.3);
      }
      push(u, Math.min(Math.max(v, 0), 1), r, 0);
    }
    for (let k = 0; k < GLOW_PARTICLES; k++) {
      push(rand(), Math.pow(rand(), 3) * 0.35, r, 1);
    }
  }
  for (let k = 0; k < DUST_PARTICLES; k++) {
    push(rand(), rand(), 2, 0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(total * 3), 3));
  geo.setAttribute("aParams", new THREE.BufferAttribute(params, 4));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rnd, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return geo;
};

// Ribbon spines (cubic Bezier control points) and sheet width vectors at
// u = 0 and u = 1. The two ribbons cross near the origin, forming the "X".
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const RIBBONS = {
  // Ribbons lie roughly in the horizontal plane with their sheets extending
  // away from camera, so an elevated view shows broad sheets and a low view
  // collapses them to bright edge-on filaments.
  A: {
    ctrl: [v3(-6.0, 4.2, 2.4), v3(-2.6, 1.7, 1.0), v3(0.8, -0.9, -0.6), v3(3.8, -3.2, -2.4)],
    w0: v3(-1.4, 0.5, -3.4),
    w1: v3(-1.0, 0.3, -2.4),
  },
  B: {
    ctrl: [v3(-6.2, 0.8, -1.4), v3(-2.0, -1.4, -0.2), v3(2.2, -1.4, 0.7), v3(4.6, 3.4, 1.6)],
    w0: v3(0.9, 0.4, -3.4),
    w1: v3(0.7, 0.2, -2.4),
  },
};

// Where the two ribbon spines pass each other: the visual "collision" point
// that both camera moves are framed around.
export const CROSSING: [number, number, number] = [0.13, -0.5, -0.15];
