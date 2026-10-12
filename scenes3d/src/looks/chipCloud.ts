import * as THREE from "three";
import { BundleSpec, buildFibreKit, FibrePalette, padsOf, PlateSpec, THICK } from "../kit/fibreKit";
import { LookInstance } from "../kit/post";
import { LOOP, mulberry32 } from "../kit/random";

// A periodic 3D lattice of chip plates joined by short fibre bundles. The
// seeded pattern repeats every N cells across and every NV levels; the
// camera glides diagonally exactly one period per loop.

const SIZE = 1.0;
const SX = 1.6 * SIZE; // horizontal spacing
const SY = 1.2 * SIZE; // vertical spacing
const N = 3;
const NV = 3;

type CellSeed = { dx: number; dz: number; dy: number; tiltX: number; tiltZ: number; yaw: number; variant: number; bundles: number };

const CELLS: CellSeed[] = (() => {
  const rng = mulberry32(7171);
  const out: CellSeed[] = [];
  for (let i = 0; i < N * N * NV; i++) {
    out.push({
      dx: (rng() - 0.5) * 0.25,
      dz: (rng() - 0.5) * 0.25,
      dy: (rng() - 0.5) * 0.25,
      tiltX: (rng() - 0.5) * 0.12,
      tiltZ: (rng() - 0.5) * 0.12,
      yaw: (rng() - 0.5) * 0.25,
      variant: rng() < 0.6 ? 0 : 1,
      bundles: rng() < 0.55 ? 1 : 2,
    });
  }
  return out;
})();

const mod = (a: number, n: number) => ((a % n) + n) % n;
const cellSeed = (i: number, j: number, k: number) => CELLS[(mod(k, NV) * N + mod(j, N)) * N + mod(i, N)];
const cellId = (i: number, j: number, k: number) => (mod(k, NV) * N + mod(j, N)) * N + mod(i, N);

const START = new THREE.Vector3(0.3, 1.25, 0.2);
const TRAVEL = new THREE.Vector3(N * SX, 0, N * SX);
const HEADING = THREE.MathUtils.degToRad(-58); // look direction (yaw)
const PITCH = THREE.MathUtils.degToRad(-24);

const camAt = (t: number, cam: THREE.PerspectiveCamera) => {
  const a = t * Math.PI * 2;
  cam.position.copy(START).addScaledVector(TRAVEL, t);
  cam.position.y += 0.08 * Math.sin(a);
  cam.rotation.order = "YXZ";
  cam.rotation.set(PITCH + 0.015 * Math.sin(a + 0.6), HEADING + 0.03 * Math.sin(a), 0);
  cam.updateMatrixWorld();
};

const plateMatrix = (i: number, j: number, k: number) => {
  const s = cellSeed(i, j, k);
  // Stagger levels by a third of a cell so column gaps never line up.
  const st = mod(k, NV) * 0.32;
  return new THREE.Matrix4()
    .makeTranslation(i * SX + s.dx + st, k * SY + s.dy, j * SX + s.dz + st * 0.6)
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(s.tiltX, s.yaw, s.tiltZ)));
};

const buildLayout = (aspect: number) => {
  // Keep only cells the camera can see somewhere along its path.
  const cam = new THREE.PerspectiveCamera(34, aspect, 0.1, 17);
  const frustums: THREE.Frustum[] = [];
  const positions: THREE.Vector3[] = [];
  for (let s = 0; s <= 16; s++) {
    camAt(s / 16, cam);
    cam.updateProjectionMatrix();
    const f = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
    );
    frustums.push(f);
    positions.push(cam.position.clone());
  }
  const visible = (p: THREE.Vector3) => {
    const sph = new THREE.Sphere(p, 1.4 * SIZE);
    return frustums.some((f, i) => f.intersectsSphere(sph) && positions[i].distanceTo(p) < 17);
  };
  const plates: PlateSpec[] = [];
  const keys = new Map<string, PlateSpec>();
  for (let i = -16; i <= 22; i++)
    for (let j = -16; j <= 22; j++)
      for (let k = -14; k <= 0; k++) {
        const c = new THREE.Vector3(i * SX, k * SY, j * SX);
        if (!visible(c)) continue;
        const s = cellSeed(i, j, k);
        const p: PlateSpec = { variant: s.variant, size: SIZE, matrix: plateMatrix(i, j, k) };
        plates.push(p);
        keys.set(`${i},${j},${k}`, p);
      }
  const bundles: BundleSpec[] = [];
  keys.forEach((p, key) => {
    const [i, j, k] = key.split(",").map(Number);
    const s = cellSeed(i, j, k);
    const rng = mulberry32(400 + cellId(i, j, k));
    const from = padsOf(p, -1);
    const below = new THREE.Vector3(0, THICK / 2, 0).applyMatrix4(plateMatrix(i, j, k - 1));
    for (let b = 0; b < s.bundles; b++) {
      const a = from[b % from.length];
      // Land straight below on the next plate's top face (a collar marks
      // the joint), so bundles hang near-vertically as in the reference.
      const t = { pos: new THREE.Vector3(a.pos.x + (rng() - 0.5) * 0.2, below.y, a.pos.z + (rng() - 0.5) * 0.2), r: a.r };
      bundles.push({
        from: a.pos,
        to: t.pos,
        padR: a.r * 1.2,
        toR: 0.3 + rng() * 0.12,
        count: 12 + Math.floor(rng() * 9),
        seed: cellId(i, j, k) * 10 + b,
        hang: false,
        width: 0.0055,
      });
    }
  });
  return { plates, bundles };
};

export const createChipCloud = (P: FibrePalette, gl: THREE.WebGLRenderer): LookInstance => {
  const scene = new THREE.Scene();
  const depthScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 40);
  const { plates, bundles } = buildLayout(16 / 9);
  const kit = buildFibreKit(gl, P, plates, bundles, scene);
  scene.add(kit.group);
  depthScene.add(kit.depthGroup);
  return {
    scene,
    camera,
    clearColor: kit.clearColor,
    post: {
      focus: 5.5,
      cocScale: 9,
      maxCoc: 9,
      nearScale: 1.4,
      bloomStrength: 0.3,
      bloomThreshold: 0.9,
      exposure: 1.0,
      vignette: 0.3,
      grain: 0.015,
      acesMix: 0.2,
    },
    update: (frame, w, h, k) => {
      const f = frame % LOOP;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      camAt(f / LOOP, camera);
      kit.update(f, w, h, k, camera);
    },
    draw: (g) => {
      g.render(scene, camera);
      g.render(depthScene, camera);
    },
    dispose: kit.dispose,
  };
};
