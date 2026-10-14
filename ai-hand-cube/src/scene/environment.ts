// Procedural HDR environment for reflections, generated once with PMREM.
// A dark room tinted by the palette, with a soft key softbox above, a bright
// glow where the cube sits and cool rim strips at the sides/back.
import * as THREE from "three";
import type { Palette } from "../versions";

export const buildEnvironment = (gl: THREE.WebGLRenderer, p: Palette) => {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(p.background).multiplyScalar(1.6),
      side: THREE.BackSide,
    }),
  );
  scene.add(room);
  // floor-ish lower hemisphere a bit darker, upper slightly lighter via panels
  const addPanel = (
    color: THREE.ColorRepresentation,
    intensity: number,
    w: number,
    h: number,
    pos: [number, number, number],
  ) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(intensity),
        side: THREE.DoubleSide,
      }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  // key softbox above, slightly in front
  addPanel("#ffffff", 3.0, 14, 8, [0, 12, 6]);
  // soft white strip front-left for long highlights along fingers
  addPanel("#ffffff", 1.6, 4, 14, [-10, 6, 10]);
  // cube glow above the hand (strong, tinted)
  addPanel(p.circuit, 2.0, 6, 6, [0, 9, 0]);
  // front fill (camera side), dim
  addPanel(p.glow, 2.5, 20, 8, [0, 3, 20]);
  // cool rim strips left/right/back
  addPanel(p.rim, 3.0, 3, 16, [-14, 4, -8]);
  addPanel(p.rim, 3.0, 3, 16, [14, 4, -8]);
  addPanel(p.hud, 1.6, 20, 6, [0, 2, -18]);
  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromScene(scene, 0.02, 0.1, 100);
  pmrem.dispose();
  return rt.texture;
};
