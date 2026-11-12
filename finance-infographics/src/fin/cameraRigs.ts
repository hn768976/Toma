import * as THREE from "three";
import { lerp } from "../lib/useThreeScene";

export type FinanceRig = {
  name: string;
  fov: number;
  seed: number;
  /** CoC (px) per unit |1 - focus/depth|, as a fraction of frame height. */
  blurK: number;
  /** Max CoC as a fraction of frame height. */
  maxCoc: number;
  focus: (t: number) => number;
  apply: (camera: THREE.PerspectiveCamera, t: number, duration: number) => void;
};

/**
 * V1 – matches the reference: an almost locked-off camera slowly pushing into
 * the field of data with a faint lateral float.
 */
export const SLOW_PUSH: FinanceRig = {
  name: "Slow Push",
  fov: 50,
  seed: 11,
  blurK: 0.0068,
  maxCoc: 0.03,
  focus: () => 9,
  apply: (camera, t) => {
    camera.position.set(
      Math.sin(t * 0.13) * 0.35,
      Math.sin(t * 0.09 + 1.2) * 0.2,
      10 - t * 0.32,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(camera.position.x * 0.5, camera.position.y * 0.5, camera.position.z - 20);
  },
};

/**
 * V2 – alternative camera movement: a sweeping orbital glide around the data
 * field. The camera arcs ~70° around a pivot while dollying in and banking, so
 * the flat infographic cards are seen at changing angles with strong parallax.
 */
export const ORBIT_GLIDE: FinanceRig = {
  name: "Orbit Glide",
  fov: 46,
  seed: 11,
  blurK: 0.0068,
  maxCoc: 0.03,
  focus: (t) => lerp(10, 8.5, Math.min(1, t / 30)),
  apply: (camera, t, duration) => {
    const k = Math.min(1, Math.max(0, t / duration));
    const e = k * k * (3 - 2 * k);
    const yaw = THREE.MathUtils.degToRad(lerp(-48, 44, e));
    const radius = lerp(15, 11, e);
    const pivot = new THREE.Vector3(0, 0, -4 - t * 0.12);
    camera.position.set(
      pivot.x + Math.sin(yaw) * radius,
      pivot.y + lerp(1.6, -1.2, e) + Math.sin(t * 0.4) * 0.15,
      pivot.z + Math.cos(yaw) * radius,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(pivot);
    camera.rotateZ(THREE.MathUtils.degToRad(lerp(7, -7, e)));
  },
};
