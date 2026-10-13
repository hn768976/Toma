import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { defaultPost } from "../engine/post";
import { FULLSCREEN_VERT, fullscreenMesh, lin } from "../engine/fullscreen";
import { LookFactory } from "../engine/Stage";
import { TAU, phaseOf } from "../engine/rng";

// Look 3 — a long wave of thin upright slats. The path is fixed; each slat's
// top/bottom heights and roll follow two travelling waves (whole wavelengths
// per 600 frames), so the band twists and curls and the loop is exact.

export type SlatParams = {
  glow: string;
  bgTop: string;
  bgBottom: string;
  key: string;
};

const COUNT = 420;
const DEPTH = 0.62; // ≈2.7× the pitch, so neighbouring blades just overlap in view // slat depth across the band

// Fixed path, sampled once at module level (no randomness involved).
const PATH = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(-50, 0, -24),
    new THREE.Vector3(-24, 0, 0.8),
    new THREE.Vector3(-6, 0, 1.9),
    new THREE.Vector3(8, 0, -1.9),
    new THREE.Vector3(17, 0, 0.3),
    // the tail curls back toward the camera and under: the second, lower strand
    new THREE.Vector3(21, 0, 4.5),
    new THREE.Vector3(16, 0, 7.5),
    new THREE.Vector3(9, 0, 8.5),
  ],
  false,
  "centripetal",
);
const SLATS = Array.from({ length: COUNT }, (_, i) => {
  const u = i / (COUNT - 1);
  const p = PATH.getPointAt(u);
  const t = PATH.getTangentAt(u);
  t.y = 0;
  t.normalize();
  // each slat is yawed off the path so its broad face reads like a fanned step
  const yaw = 1.0; // louvre-like: blades turned ~57° off the path
  const n = new THREE.Vector3(-t.z, 0, t.x);
  const ty = t.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(n, Math.sin(yaw));
  const ny = n.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(t, -Math.sin(yaw));
  return { u, p, t: ty, n: ny };
});
const LENGTH = PATH.getLength();
const SPACING = LENGTH / (COUNT - 1);
const THICK = SPACING / 4; // thickness ≈ 1/3 of the gap between slats

/** Top edge, bottom edge and roll of slat at path position u, phase t. */
const wave = (u: number, t: number) => {
  // arc length along the path; wavelengths in world units
  const s = u * LENGTH;
  const a = TAU * (s / 24 - 1 * t);
  const b = TAU * (s / 13 + 1 * t);
  const c = TAU * (s / 40 - 2 * t);
  const top = 1.6 + 2.6 * Math.sin(a + 2.89) + 0.35 * Math.sin(b + 0.3) + 0.2 * Math.sin(c);
  const height = 7.5 + 1.0 * Math.sin(a + 4.39) + 0.4 * Math.sin(c + 1.1);
  const roll = 0.45 * Math.sin(a + 4.19) + 0.15 * Math.sin(b - 0.7);
  return { top, bottom: top - height, roll };
};

const BG_FRAG = /* glsl */ `
uniform vec3 top;
uniform vec3 bottom;
uniform vec3 glow;
uniform float aspect;
varying vec2 vUv;
void main() {
  vec3 c = mix(bottom, top * 0.75, smoothstep(0.1, 0.85, vUv.y));
  // soft lift behind the band, right of centre
  vec2 q = (vUv - vec2(0.78, 0.55)) * vec2(aspect, 1.0);
  c += bottom * 1.5 * exp(-dot(q, q) * 4.0);
  // darker top-left corner
  vec2 k = (vUv - vec2(0.0, 1.0)) * vec2(aspect, 1.0);
  c *= 0.55 + 0.45 * smoothstep(0.2, 1.4, length(k));
  c += glow * 0.012 * exp(-dot(q, q) * 6.0);
  gl_FragColor = vec4(c, 1.0);
}`;

export const createSlatRibbon: LookFactory<SlatParams> = (params, gl) => {
  RectAreaLightUniformsLib.init();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 2, 80);
  const glow = lin(params.glow);

  const bgMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: BG_FRAG,
    uniforms: {
      top: { value: lin(params.bgTop) },
      bottom: { value: lin(params.bgBottom) },
      glow: { value: glow },
      aspect: { value: 16 / 9 },
    },
    depthWrite: false,
  });
  scene.add(fullscreenMesh(bgMat));

  // procedural environment for the metal: dark room, warm/cool panels
  const envScene = new THREE.Scene();
  const envSphere = new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: lin(params.bgTop) }, bottom: { value: lin(params.bgBottom) } },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(bottom, top, h * 0.5 + 0.5) * 5.0, 1.0); }`,
    }),
  );
  envScene.add(envSphere);
  const panel = (color: THREE.Color, k: number, pos: THREE.Vector3, size: [number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    envScene.add(m);
  };
  panel(glow, 1.2, new THREE.Vector3(0, -5, -6), [10, 3]);
  // the warm underglow as the metal faces see it (low, to the side): drives the orange rims
  panel(glow, 9, new THREE.Vector3(8, -3, 3), [3.5, 1.4]);
  panel(lin(params.key), 2.6, new THREE.Vector3(5, 7, 2), [6, 4]);
  panel(lin(params.key), 1.6, new THREE.Vector3(3, 2, 8), [8, 5]);
  const pmrem = new THREE.PMREMGenerator(gl);
  const envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;
  pmrem.dispose();

  const mat = new THREE.MeshStandardMaterial({
    color: lin("#2A2E36"),
    metalness: 0.7,
    roughness: 0.35,
    envMapIntensity: 3.0,
  });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(box, mat, COUNT);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // warm (or cyan) area light below and behind, aimed up and toward the camera
  const under = new THREE.RectAreaLight(glow, 0.9, 12, 3);
  under.position.set(1.5, -2.5, -4.5);
  under.lookAt(1.5, 2.0, 3);
  scene.add(under);
  const under2 = new THREE.RectAreaLight(glow, 0.5, 10, 3);
  under2.position.set(8, -3.5, -3);
  under2.lookAt(4, 2, 4);
  scene.add(under2);
  const keyL = new THREE.DirectionalLight(lin(params.key), 6.0);
  keyL.position.set(6, 10, 4);
  scene.add(keyL);
  scene.add(new THREE.HemisphereLight(lin(params.bgBottom), new THREE.Color(0, 0, 0), 1.8));
  const fillL = new THREE.DirectionalLight(lin(params.key), 0.9);
  fillL.position.set(-5, 3, 10);
  scene.add(fillL);
  const leftL = new THREE.DirectionalLight(lin(params.key), 1.3);
  leftL.position.set(-12, 5, 3);
  scene.add(leftL);

  const m4 = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const up = new THREE.Vector3();
  const nn = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  return {
    scene,
    camera,
    update: (frame, w, h) => {
      const t = phaseOf(frame);
      for (let i = 0; i < COUNT; i++) {
        const s = SLATS[i];
        const { top, bottom, roll } = wave(s.u, t);
        const cr = Math.cos(roll);
        const sr = Math.sin(roll);
        // roll the slat about the path tangent
        up.set(0, cr, 0).addScaledVector(s.n, sr);
        nn.set(0, -sr, 0).addScaledVector(s.n, cr);
        basis.makeBasis(s.t, up, nn);
        const mid = (top + bottom) / 2;
        pos.copy(s.p).addScaledVector(up, mid);
        scl.set(THICK, top - bottom, DEPTH);
        m4.copy(basis).scale(scl).setPosition(pos);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
      const w0 = TAU * t;
      camera.aspect = w / h;
      bgMat.uniforms.aspect.value = w / h;
      camera.position.set(-0.4 + 0.5 * Math.sin(w0), 6.2 + 0.2 * Math.sin(w0 + 0.7), 13.5 + 0.4 * Math.cos(w0));
      camera.lookAt(0.2 * Math.sin(w0 + 1), 0.3, 0);
      camera.updateProjectionMatrix();
    },
    post: () => ({
      ...defaultPost(),
      focus: 13.5,
      dofFar: 0.0025,
      dofNear: 0.003,
      dofRange: 3,
      bloom: 0.15,
      bloomThreshold: 0.6,
      vignette: 0.35,
      exposure: 1.0,
    }),
    dispose: () => {
      box.dispose();
      mat.dispose();
      bgMat.dispose();
      envRT.dispose();
    },
  };
};
