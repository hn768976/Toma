import * as THREE from 'three/webgpu';
import { smootherstep } from '../engine/easing';
import type { CameraKey, Theme } from '../themes';
import type { FrameState } from '../timeline';

export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  update: (s: FrameState) => void;
  /** Distance from the camera to the package — drives the focus plane. */
  focusDistance: () => number;
}

const sample = (keys: CameraKey[], t: number) => {
  if (t <= keys[0].t) return keys[0];
  const last = keys[keys.length - 1];
  if (t >= last.t) return last;

  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].t < t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  // Smootherstep between keys: zero velocity *and* zero acceleration at each
  // key, so the move never visibly "clicks" as it crosses one.
  const k = smootherstep(a.t, b.t, t);

  const lerp3 = (p: [number, number, number], q: [number, number, number]) =>
    [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k] as [number, number, number];

  return {
    t,
    position: lerp3(a.position, b.position),
    target: lerp3(a.target, b.target),
    fov: a.fov + (b.fov - a.fov) * k,
  };
};

export const createCamera = (theme: Theme, aspect: number): CameraRig => {
  const camera = new THREE.PerspectiveCamera(theme.camera[0].fov, aspect, 0.5, 600);
  const target = new THREE.Vector3();
  let distance = 40;

  return {
    camera,
    update: (s) => {
      const key = sample(theme.camera, s.seconds);
      camera.position.set(
        key.position[0] + s.drift[0],
        key.position[1] + s.drift[1],
        key.position[2] + s.drift[2],
      );
      target.set(key.target[0], key.target[1], key.target[2]);
      camera.lookAt(target);
      if (camera.fov !== key.fov) {
        camera.fov = key.fov;
        camera.updateProjectionMatrix();
      }
      // Focus rides the package while it descends, then rests on the socket.
      const focus = new THREE.Vector3(0, Math.min(s.chipY, 6), 0);
      distance = camera.position.distanceTo(focus);
    },
    focusDistance: () => distance,
  };
};
