import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { makeStripEnv } from "../blade/bladeRing";
import { DEG } from "../common/random";
import { LookFactory } from "../three/ThreeLook";
import { PlateArcRow } from "../versions";

// Look 2: 48 rounded-square plates stacked round a circle (like torus
// slices), twisted so the stack fans. Only the upper arc is in frame.
// The ring turns 3 plate pitches (22.5 deg) per 600 frames.

const PLATES = 48;
const PITCH = 360 / PLATES; // 7.5 deg
const TURN_PER_LOOP = PITCH * 3;
const RING_R = 2.4;
const SIZE = 1;
const CORNER = 0.22;
const THICK = 0.12;

// Framing parameters (camera at origin looking down -Z).
export const PLATE_FRAMING = {
  fov: 42,
  center: [0.62, -1.62, -2.75] as [number, number, number],
  yaw: 24, // left side of the ring swings toward the camera
  pitch: -20, // look at the ring from ~20 deg below its plane's facing
  twist: 35, // about each plate's radial axis
  spin: 45, // about each plate's own normal: square reads as a diamond
};

const roundedSquare = (s: number, r: number) => {
  const h = s / 2;
  const sh = new THREE.Shape();
  sh.moveTo(-h + r, -h);
  sh.lineTo(h - r, -h);
  sh.quadraticCurveTo(h, -h, h, -h + r);
  sh.lineTo(h, h - r);
  sh.quadraticCurveTo(h, h, h - r, h);
  sh.lineTo(-h + r, h);
  sh.quadraticCurveTo(-h, h, -h, h - r);
  sh.lineTo(-h, -h + r);
  sh.quadraticCurveTo(-h, -h, -h + r, -h);
  return sh;
};

export const makePlateArc =
  (row: PlateArcRow): LookFactory =>
  (gl, aspect) => {
    RectAreaLightUniformsLib.init();
    const F = PLATE_FRAMING;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0, 0, 0);
    const strip = new THREE.Color(row.strip);

    const envRT = makeStripEnv(gl, [
      // broad soft strip upper left: lights the near plate faces (satin)
      { color: strip, intensity: 9, pos: [-5, 5, 1], size: [3, 14], lookAt: [0, -1, -2.75] },
      // thin strip far right: thin bright highlight on each rounded edge
      { color: strip, intensity: 16, pos: [6, 1, -4], size: [0.5, 14], lookAt: [0, -1, -2.75] },
      { color: strip, intensity: 2, pos: [0, -6, 1], size: [14, 2], lookAt: [0, -1, -2.75] },
    ]);
    scene.environment = envRT.texture;

    const geo = new THREE.ExtrudeGeometry(roundedSquare(SIZE - 0.08, CORNER - 0.04), {
      depth: THICK - 0.08,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 8,
      curveSegments: 12,
    });
    geo.center();
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(row.base),
      metalness: 0.75,
      roughness: 0.3,
      clearcoat: 0.3,
      clearcoatRoughness: 0.25,
    });
    const plates = new THREE.InstancedMesh(geo, mat, PLATES);
    plates.frustumCulled = false;

    const ring = new THREE.Group();
    ring.position.set(...F.center);
    ring.rotation.set(F.pitch * DEG, F.yaw * DEG, 0, "YXZ");
    ring.add(plates);
    scene.add(ring);

    const key = new THREE.DirectionalLight(new THREE.Color(row.key), 3.2);
    key.position.set(-5, 4, 2);
    scene.add(key);
    const rim = new THREE.RectAreaLight(new THREE.Color(row.rim), 18, 6, 1.2);
    rim.position.set(2, 3, -7);
    rim.lookAt(...F.center);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(F.fov, aspect, 0.1, 50);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld();

    // local plate: XY face, thickness Z. Twist about radial (X), spin about
    // the normal (Z), then map X -> radial, Y -> ring axis, Z -> tangent.
    const localRot = new THREE.Matrix4()
      .makeRotationX(F.twist * DEG)
      .multiply(new THREE.Matrix4().makeRotationZ(F.spin * DEG));
    const basis = new THREE.Matrix4();
    const m = new THREE.Matrix4();
    const rr = new THREE.Vector3();
    const ax = new THREE.Vector3(0, 0, 1);
    const tg = new THREE.Vector3();

    return {
      scene,
      camera,
      update: (frame) => {
        const turn = (TURN_PER_LOOP * frame) / 600;
        for (let i = 0; i < PLATES; i++) {
          const a = ((i * PITCH + turn) % 360) * DEG;
          rr.set(Math.cos(a), Math.sin(a), 0);
          tg.set(Math.sin(a), -Math.cos(a), 0); // right-handed basis
          basis.makeBasis(rr, ax, tg);
          basis.setPosition(rr.x * RING_R, rr.y * RING_R, 0);
          m.multiplyMatrices(basis, localRot);
          plates.setMatrixAt(i, m);
        }
        plates.instanceMatrix.needsUpdate = true;
        ring.updateMatrixWorld(true);
        return {
          focusDist: 2.2,
          focusDead: 0.4,
          focusRange: 2.5,
          maxBlur: 0.007,
          exposure: 1.0,
          vignette: 0.2,
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
