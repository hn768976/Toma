import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { makeLines, Seg } from "../engine/lines";
import { mulberry32, range } from "../engine/random";
import { LookFactory } from "../engine/Stage";
import { SlatColors } from "../versions";

// Look 4 - Diagonal Slats.
// ~20 long bevelled satin strips at 35 degrees, at slightly different
// depths. A large soft area light sweeps across them and fine glints run
// along a few slat edges. Camera almost still with a tiny closed drift.
//
// Loop: light sweep, glints and drift are whole sine/fract cycles over 600.

export type SlatParams = { colors: SlatColors };

const LOOP = 600;
const ANGLE = THREE.MathUtils.degToRad(35);
const LENGTH = 26;
const THICK = 0.22;

const buildSlats = () => {
  const rng = mulberry32(0x51a7);
  const slats: { y: number; w: number; z: number; bevel: number; tilt: number }[] = [];
  // Cover the frame's extent perpendicular to the slats (~10 units).
  let y = -5.8;
  while (y < 5.8) {
    const w = range(rng, 0.38, 1.0);
    const r = rng();
    const z = r < 0.4 ? 0 : r < 0.7 ? 0.07 : r < 0.9 ? 0.14 : 0.21;
    // a small tilt about the long axis lifts one edge, like louvres
    slats.push({ y: y + w / 2, w, z, bevel: range(rng, 0.02, 0.04), tilt: range(rng, 0.06, 0.16) });
    y += w + 0.008;
  }
  const glints = [3, 7, 11, 14, 17].map((i, k) => ({
    slat: Math.min(i, slats.length - 1),
    phase: rng(),
    cycles: k % 2 === 0 ? 1 : 2,
    dir: k % 2 === 0 ? 1 : -1,
  }));
  return { slats, glints };
};
const SLATS = buildSlats();

const GLINT_MOD = /* glsl */ `
uniform float uT;
float lineMod(float u, vec4 p) {
  float pos = fract(p.x + uT * p.y * p.z);
  float d = abs(fract(u - pos + 0.5) - 0.5);
  return exp(-pow(d / 0.045, 2.0)) + 0.25 * exp(-pow(d / 0.16, 2.0));
}
`;

let rectLibReady = false;

export const slatsLook: LookFactory<SlatParams> = ({ assets, params, renderer }) => {
  if (!rectLibReady) {
    RectAreaLightUniformsLib.init();
    rectLibReady = true;
  }
  const c = params.colors;
  const white = new THREE.Color(c.slat).getHSL({ h: 0, s: 0, l: 0 }).l > 0.5;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(c.backdrop);
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 1, 60);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(assets.hdri!).texture;
  pmrem.dispose();

  const group = new THREE.Group();
  group.rotation.z = ANGLE;
  scene.add(group);

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(c.backdrop), roughness: 0.9 }),
  );
  back.position.z = -0.25;
  back.receiveShadow = true;
  group.add(back);

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(c.slat),
    roughness: 0.4,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 0.35,
    sheen: 0.3,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(c.light),
    envMap: env,
    envMapIntensity: white ? 0.25 : 0.05,
  });
  SLATS.slats.forEach((s) => {
    const geo = new RoundedBoxGeometry(LENGTH, s.w, THICK, 4, s.bevel);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, s.y, s.z);
    m.rotation.x = -s.tilt;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  });

  // Large soft area light sweeping across, plus a weaker counter-sweep.
  const lightCol = new THREE.Color(c.light);
  const sweep = new THREE.RectAreaLight(lightCol, white ? 1.6 : 0.3, 12, 6);
  sweep.position.set(0, 0, 3.2);
  scene.add(sweep);
  const sweep2 = new THREE.RectAreaLight(lightCol, white ? 0.8 : 0.08, 9, 5);
  sweep2.position.set(0, 0, 3.6);
  scene.add(sweep2);

  // Grazing key light with soft shadows separates the depth layers.
  const key = new THREE.DirectionalLight(lightCol, white ? 1.8 : 0.9);
  key.position.set(-3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 25;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.01;
  scene.add(key);
  scene.add(new THREE.AmbientLight(lightCol, white ? 0.2 : 0.45));

  // Glints travelling along a few slat edges.
  const uT = { value: 0 };
  const glintSegs: Seg[] = SLATS.glints.map((g) => {
    const s = SLATS.slats[g.slat];
    const y = s.y + s.w / 2 - s.bevel * 0.6;
    const z = s.z + THICK / 2 - s.bevel * 0.35;
    return {
      a: [-LENGTH / 2, y, z + 0.002],
      b: [LENGTH / 2, y, z + 0.002],
      color: new THREE.Color(c.glint),
      intensity: white ? 0.9 : 1.2,
      widthA: 0.0016,
      param: [g.phase, g.cycles, g.dir, 0],
    };
  });
  const glints = makeLines(glintSegs, {
    worldWidth: false,
    softness: 0.6,
    lineMod: GLINT_MOD,
    uniforms: { uT },
    minHalfPx: 0.6,
  });
  glints.renderOrder = 5;
  group.add(glints);

  const update = (frame: number) => {
    const t = (frame % LOOP) / LOOP;
    const a = t * Math.PI * 2;
    // Sweep: across the frame and back once per loop, travelling along a
    // diagonal perpendicular-ish to the slats.
    sweep.position.set(Math.sin(a) * 7.5, Math.sin(a) * -1.6 + 0.6, 3.2);
    sweep.lookAt(sweep.position.x * 0.6, sweep.position.y * 0.6, 0);
    sweep2.position.set(-Math.sin(a * 2 + 1.1) * 6, Math.cos(a) * 1.8 - 0.6, 3.6);
    sweep2.lookAt(sweep2.position.x * 0.5, sweep2.position.y * 0.5, 0);
    uT.value = t;
    camera.position.set(0.12 * Math.sin(a), 0.08 * Math.cos(a), 12);
    camera.lookAt(0.04 * Math.sin(a), 0.03 * Math.cos(a), 0);
  };

  return { scene, camera, update, dispose: () => env.dispose() };
};
