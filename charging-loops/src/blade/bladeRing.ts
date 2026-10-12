import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { DEG, TAU } from "../common/random";
import { LookFactory } from "../three/ThreeLook";
import { BladeRingRow } from "../versions";

// Look 1: 30 bevelled metal slabs fanned like turbine blades, seen from
// ~50 degrees above. The ring turns 36 deg (= 3 slab pitches) per 600 frames.

export const SLABS = 30;
const PITCH = 360 / SLABS; // 12 deg
const TURN_PER_LOOP = PITCH * 3; // 36 deg
const LENGTH = 1;
const THICK = 0.18;
const HEIGHT = 0.62;
const RADIUS = 1.15;

export const makeStripEnv = (
  gl: THREE.WebGLRenderer,
  strips: { color: THREE.Color; intensity: number; pos: [number, number, number]; size: [number, number]; lookAt?: [number, number, number] }[],
) => {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0, 0, 0);
  for (const s of strips) {
    const m = new THREE.MeshBasicMaterial({ color: s.color.clone().multiplyScalar(s.intensity), side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(s.size[0], s.size[1]), m);
    p.position.set(...s.pos);
    p.lookAt(...(s.lookAt ?? [0, 0, 0]));
    env.add(p);
  }
  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromScene(env, 0.035, 0.1, 50);
  pmrem.dispose();
  return rt;
};

export const makeBladeRing =
  (row: BladeRingRow): LookFactory =>
  (gl, aspect) => {
    RectAreaLightUniformsLib.init();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0, 0, 0);
    const strip = new THREE.Color(row.strip);
    const rimC = new THREE.Color(row.rim);

    const envRT = makeStripEnv(gl, [
      // long strip high behind the ring: catches the bevelled top edges
      { color: strip, intensity: 18, pos: [0, 6, -7], size: [16, 1.2] },
      // two soft strips below the horizon: the vertical slab faces reflect
      // these, giving the blue gradient on the faces
      { color: strip, intensity: 3.5, pos: [-6, -3.5, -3], size: [2.5, 14], lookAt: [0, 0.3, 0] },
      { color: strip, intensity: 2.2, pos: [6, -3, 2], size: [2.5, 14], lookAt: [0, 0.3, 0] },
    ]);
    scene.environment = envRT.texture;

    const geo = new RoundedBoxGeometry(LENGTH, HEIGHT, THICK, 4, 0.02 * LENGTH);
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(row.base),
      metalness: 0.85,
      roughness: 0.28,
      clearcoat: 0.3,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.0,
    });
    const ring = new THREE.InstancedMesh(geo, mat, SLABS);
    ring.frustumCulled = false;
    scene.add(ring);

    const rim = new THREE.RectAreaLight(rimC, 30, 8, 1.2);
    rim.position.set(0, 3.2, -3.4);
    rim.lookAt(0, 0, 0);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(36, aspect, 0.1, 50);

    // Per-slab local transform: stand on edge at RADIUS, tilt 12 deg outward
    // about the base, then yaw 25 deg about its own vertical axis.
    const local = new THREE.Matrix4()
      .makeTranslation(RADIUS, 0, 0)
      .multiply(new THREE.Matrix4().makeRotationZ(-12 * DEG))
      .multiply(new THREE.Matrix4().makeTranslation(0, HEIGHT / 2, 0))
      .multiply(new THREE.Matrix4().makeRotationY(25 * DEG));
    const m = new THREE.Matrix4();
    const rotY = new THREE.Matrix4();

    const camTarget = new THREE.Vector3(0, 0.3, -0.45);
    const camDist = 3.05;
    const camElev = 44 * DEG;

    return {
      scene,
      camera,
      update: (frame) => {
        const turn = (TURN_PER_LOOP * frame) / 600;
        for (let i = 0; i < SLABS; i++) {
          const a = ((i * PITCH + turn) % 360) * DEG;
          rotY.makeRotationY(a);
          m.multiplyMatrices(rotY, local);
          ring.setMatrixAt(i, m);
        }
        ring.instanceMatrix.needsUpdate = true;

        // tiny closed drift, one cycle per loop, +/-1 deg
        const ph = (TAU * (frame % 600)) / 600;
        const az = 1 * DEG * Math.sin(ph);
        const el = camElev + 0.6 * DEG * Math.sin(2 * ph);
        camera.position.set(
          camTarget.x + camDist * Math.cos(el) * Math.sin(az),
          camTarget.y + camDist * Math.sin(el),
          camTarget.z + camDist * Math.cos(el) * Math.cos(az),
        );
        camera.lookAt(camTarget);
        camera.updateMatrixWorld();

        return {
          focusDist: camDist - 0.4,
          focusDead: 0.5,
          focusRange: 2.2,
          maxBlur: 0.006,
          exposure: 1.0,
          vignette: 0.25,
          grain: 0.015,
          blackCut: 1,
        };
      },
      dispose: () => {
        envRT.dispose();
        geo.dispose();
        mat.dispose();
      },
    };
  };
