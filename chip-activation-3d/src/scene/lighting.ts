import * as THREE from 'three/webgpu';
import type { Theme } from '../themes';
import type { FrameState } from '../timeline';

export interface LightingResult {
  group: THREE.Group;
  update: (s: FrameState) => void;
  dispose: () => void;
}

/**
 * A three-point rig plus hemisphere fill.
 *
 * No shadow maps: on a software rasteriser a shadow pass costs as much as
 * the beauty pass, and the references' contact shadows are soft enough that
 * the baked blob under the package reads correctly.
 */
export const createLighting = (theme: Theme): LightingResult => {
  const group = new THREE.Group();
  const l = theme.lighting;

  const ambient = new THREE.AmbientLight(new THREE.Color(l.ambient), l.ambientIntensity);
  group.add(ambient);

  const hemi = new THREE.HemisphereLight(
    new THREE.Color(l.skyColor),
    new THREE.Color(l.groundColor),
    l.hemiIntensity,
  );
  group.add(hemi);

  const key = new THREE.DirectionalLight(new THREE.Color(l.keyColor), l.keyIntensity);
  key.position.set(...l.keyPosition);
  group.add(key);

  const rim = new THREE.DirectionalLight(new THREE.Color(l.rimColor), l.rimIntensity);
  rim.position.set(...l.rimPosition);
  group.add(rim);

  const fill = new THREE.DirectionalLight(new THREE.Color(l.fillColor), l.fillIntensity);
  fill.position.set(-14, 18, 30);
  group.add(fill);

  // Bounce light rising off the board once the routing is energised.
  const bounce = new THREE.PointLight(new THREE.Color(theme.board.traceGlowColor), 0, 90, 2);
  bounce.position.set(0, 5, 0);
  group.add(bounce);

  return {
    group,
    update: (s) => {
      bounce.intensity = s.energy * 13 + s.flash * 45;
      // The key dips very slightly at the impact so the flash reads harder.
      key.intensity = l.keyIntensity * (1 - s.flash * 0.18);
    },
    dispose: () => {
      ambient.dispose();
      hemi.dispose();
      key.dispose();
      rim.dispose();
      fill.dispose();
      bounce.dispose();
    },
  };
};
