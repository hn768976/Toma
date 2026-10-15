// Procedural HDR studio environment for reflections, generated once with
// PMREM. Polished metal needs structure to reflect: a dark floor, a bright
// horizon band, a graded sky, long white strip lights with dark gaps between
// them, a large soft overhead box and the cube's coloured glow above.
import * as THREE from "three";
import type { Palette } from "../versions";

export const buildEnvironment = (gl: THREE.WebGLRenderer, p: Palette) => {
  const scene = new THREE.Scene();
  // graded dome: dark floor -> bright horizon -> palette-tinted sky
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(50, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uSky: { value: new THREE.Color(p.glow).lerp(new THREE.Color("#8fa6c8"), 0.5).multiplyScalar(0.55) },
        uHorizon: { value: new THREE.Color("#c9d6ea").multiplyScalar(0.9) },
        uFloor: { value: new THREE.Color(p.background).multiplyScalar(0.6) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSky; uniform vec3 uHorizon; uniform vec3 uFloor;
        varying vec3 vDir;
        void main() {
          float y = vDir.y;
          vec3 c = y > 0.0
            ? mix(uHorizon, uSky, smoothstep(0.0, 0.45, y))
            : mix(uHorizon * 0.35, uFloor, smoothstep(0.0, 0.12, -y));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(dome);
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
  // large soft overhead box
  addPanel("#ffffff", 1.6, 16, 10, [0, 14, 2]);
  // long white strip lights at several angles (crisp bands on polished metal)
  addPanel("#ffffff", 5.0, 1.2, 18, [-12, 5, 8]);
  addPanel("#ffffff", 4.0, 1.0, 18, [12, 6, 6]);
  addPanel("#ffffff", 3.5, 18, 0.9, [0, 9, 12]);
  addPanel("#ffffff", 3.0, 0.8, 16, [-6, 4, 14]);
  // cube glow above the hand (tinted)
  addPanel(p.circuit, 3.0, 5, 5, [0, 9, 0]);
  // cool rim strips behind
  addPanel(p.rim, 3.5, 2, 16, [-14, 4, -8]);
  addPanel(p.rim, 3.5, 2, 16, [14, 4, -8]);
  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromScene(scene, 0.0, 0.1, 100);
  pmrem.dispose();
  return rt.texture;
};
