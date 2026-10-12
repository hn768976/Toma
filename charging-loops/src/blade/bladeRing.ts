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

// Shape, framing and light. Matched to the reference by side-by-side
// comparison: the slabs there are thinner and taller than a 1 x 0.18 x 0.62
// box, and the camera sits lower than 50 deg so the broad faces read.
export const BLADE_PARAMS = {
  radius: 1.6, // slab centre radius (inner edge 1.1): the reference's hole is wide
  thick: 0.13,
  height: 0.7,
  yaw: 14, // turn about each slab's own vertical axis
  tilt: 8, // outward lean
  elev: 38, // camera elevation, deg
  dist: 4.0,
  tx: 0,
  ty: 0.15,
  tz: -0.2,
  fov: 40,
  band: 6, // horizon band in the environment: lights the faces
  top: 30, // high strip behind: bevel edge lines
  sky: 7, // high band all round: bright top edges on every slab
  rim: 60,
  exposure: 1.5,
};

export const makeStripEnv = (
  gl: THREE.WebGLRenderer,
  strips: { color: THREE.Color; intensity: number; pos: [number, number, number]; size: [number, number]; lookAt?: [number, number, number] }[],
  bands: { color: THREE.Color; intensity: number; y0: number; y1: number; radius: number; up?: boolean }[] = [],
) => {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0, 0, 0);
  for (const band of bands) {
    // open cylinder seen from inside, brightest at its lower edge
    const g = new THREE.CylinderGeometry(band.radius, band.radius, band.y1 - band.y0, 64, 8, true);
    const cols: number[] = [];
    const pa = g.getAttribute("position");
    for (let i = 0; i < pa.count; i++) {
      let t = (pa.getY(i) + (band.y1 - band.y0) / 2) / (band.y1 - band.y0); // 0 bottom .. 1 top
      if (band.up) t = 1 - t; // brightest at the top edge instead
      const k = band.intensity * Math.pow(Math.min(1, Math.max(0, 1 - t)), 1.5);
      cols.push(band.color.r * k, band.color.g * k, band.color.b * k);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
    m.position.y = (band.y0 + band.y1) / 2;
    env.add(m);
  }
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
  (row: BladeRingRow, tune: Partial<typeof BLADE_PARAMS> = {}): LookFactory =>
  (gl, aspect) => {
    const P = { ...BLADE_PARAMS, ...tune };
    const THICK = P.thick;
    const HEIGHT = P.height;
    RectAreaLightUniformsLib.init();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0, 0, 0);
    const strip = new THREE.Color(row.strip);
    const rimC = new THREE.Color(row.rim);

    const envRT = makeStripEnv(
      gl,
      [
        // long strip high behind the ring: catches the bevelled top edges
        { color: strip, intensity: P.top, pos: [0, 6, -7], size: [16, 1.2] },
        // two soft strips (left low, right high) sweep across the faces
        { color: strip, intensity: P.band * 1.6, pos: [-6, -1.5, -3], size: [2.5, 14], lookAt: [0, 0.3, 0] },
        { color: rimC, intensity: P.band * 1.2, pos: [6, 2.5, 2], size: [2.0, 12], lookAt: [0, 0.3, 0] },
      ],
      [
        // a soft band all round the horizon: the vertical faces reflect it
        { color: strip, intensity: P.band, y0: -2.5, y1: 1.2, radius: 9 },
        // a high band all round: every slab top shows a bright edge line
        { color: rimC, intensity: P.sky, y0: 4, y1: 9, radius: 7, up: true },
      ],
    );
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

    const rim = new THREE.RectAreaLight(rimC, P.rim, 8, 1.2);
    rim.position.set(0, 3.2, -3.4);
    rim.lookAt(0, 0, 0);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(P.fov, aspect, 0.1, 50);

    // Per-slab local transform: stand on edge at RADIUS, tilt 12 deg outward
    // about the base, then yaw 25 deg about its own vertical axis.
    const local = new THREE.Matrix4()
      .makeTranslation(P.radius, 0, 0)
      .multiply(new THREE.Matrix4().makeRotationZ(-P.tilt * DEG))
      .multiply(new THREE.Matrix4().makeTranslation(0, HEIGHT / 2, 0))
      .multiply(new THREE.Matrix4().makeRotationY(P.yaw * DEG));
    const m = new THREE.Matrix4();
    const rotY = new THREE.Matrix4();

    const camTarget = new THREE.Vector3(P.tx, P.ty, P.tz);
    const camDist = P.dist;
    const camElev = P.elev * DEG;

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
          exposure: P.exposure,
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
