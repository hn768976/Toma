/**
 * Star catalogue, generated once at module level from a seeded mulberry32.
 * - near field: stars in a cube around the camera, wrapped along the travel
 *   axis, so they stream past (and streak) during the warp;
 * - far field: directions on the sky (infinitely far, never streak), with a
 *   denser Milky Way band.
 */
import * as THREE from "three";
import { mulberry32 } from "../shared/random";

export const NEAR_COUNT = 20000;
export const FAR_COUNT = 20000;
export const HALF = 500; // near-field half size (world units); wrap period = 2*HALF
export const BAND_NORMAL = new THREE.Vector3(0.32, 0.86, 0.4).normalize();

const rand = mulberry32(0x5eed42);

const pickColor = (): [number, number, number] => {
  const r = rand();
  if (r < 0.52) return [1.0, 1.0, 1.0]; // white
  if (r < 0.76) return [0.76, 0.85, 1.0]; // blue-white
  if (r < 0.91) return [1.0, 0.93, 0.76]; // faint yellow
  if (r < 0.97) return [1.0, 0.8, 0.58]; // orange
  return [1.0, 0.52, 0.42]; // red
};

const gauss = () => {
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const generate = () => {
  const total = NEAR_COUNT + FAR_COUNT;
  const star = new Float32Array(total * 4);
  const props = new Float32Array(total * 4);
  const color = new Float32Array(total * 3);

  // basis for the Milky Way band
  const n = BAND_NORMAL;
  const t1 = new THREE.Vector3(1, 0, 0).cross(n).normalize();
  const t2 = n.clone().cross(t1).normalize();

  for (let i = 0; i < total; i++) {
    const far = i >= NEAR_COUNT;
    if (!far) {
      let x = 0;
      let y = 0;
      // keep a tube around the travel axis clear so no star hits the lens
      do {
        x = (rand() * 2 - 1) * HALF;
        y = (rand() * 2 - 1) * HALF;
      } while (x * x + y * y < 36);
      const z = (rand() * 2 - 1) * HALF;
      star.set([x, y, z, 0], i * 4);
      const mag = Math.pow(rand(), 3.2);
      props.set([0.75 + 0.75 * rand(), 0.35 + 1.6 * mag, rand(), 0], i * 4);
    } else {
      let d: THREE.Vector3;
      if (rand() < 0.42) {
        // Milky Way band: gaussian in latitude, patchy in longitude
        const lon = rand() * Math.PI * 2;
        const lat = gauss() * 0.11;
        d = t1
          .clone()
          .multiplyScalar(Math.cos(lon) * Math.cos(lat))
          .add(t2.clone().multiplyScalar(Math.sin(lon) * Math.cos(lat)))
          .add(n.clone().multiplyScalar(Math.sin(lat)));
      } else {
        const zz = rand() * 2 - 1;
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(1 - zz * zz);
        d = new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), zz);
      }
      d.normalize();
      star.set([d.x, d.y, d.z, 1], i * 4);
      const mag = Math.pow(rand(), 4.0);
      // a few standout bright stars
      const big = rand() < 0.012;
      props.set([big ? 1.6 + rand() : 0.6 + 0.5 * rand(), big ? 2.4 : 0.3 + 1.6 * mag, rand(), 0], i * 4);
    }
    color.set(pickColor(), i * 3);
  }

  return { star, props, color, total };
};

// Generated exactly once per page, at module load — same stars on every frame/thread.
const DATA = generate();

export const buildStarGeometry = () => {
  const { star, props, color, total } = DATA;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute("aStar", new THREE.InstancedBufferAttribute(star, 4));
  g.setAttribute("aProps", new THREE.InstancedBufferAttribute(props, 4));
  g.setAttribute("aColor", new THREE.InstancedBufferAttribute(color, 3));
  g.instanceCount = total;
  return g;
};
